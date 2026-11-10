import type { NetNode, NetPacket, NetLink, EngineUpdate, VlanState } from '../types/network';
import { patchVlanState, isVlanSwitch, egressTag, portsInVlan, getVlanState } from '../logic/vlan';
import { processL2 } from '../logic/L2Layer';
import { processL3, determineNextHop } from '../logic/L3Layer';
import { ARPEngine } from '../logic/ARPEngine';
import { ICMPHandler } from '../logic/ICMPHandler';
import { IGMPHandler } from '../logic/IGMPHandler';
import { UDPHandler } from '../logic/UDPHandler';
import { TCPHandler } from '../logic/TCPHandler';
import { DNSHandler } from '../logic/DNSHandler';
import { generateId, lookupRoute } from '../logic/networkUtils';
import { isMulticastIP, multicastIPToMAC, isMulticastMAC } from '../logic/MulticastEngine';
import { isInSameSubnet } from '../logic/networkUtils';
import { L2_TTL_DEFAULT } from '../logic/simLimits';
import { isSviMode, sviForVlan, routingView } from '../logic/svi';
import { natOutsideInterface, translateInbound, translateOutbound, shouldDropUntranslated } from '../logic/nat';

let nextIcmpId = 1;

/**
 * Central Network Engine to handle packet processing and state generation
 */
export class NetworkEngine {
  
  static handleArrival(
    receiverNode: NetNode,
    packet: NetPacket,
    allNodes: NetNode[],
    allLinks: NetLink[],
    pendingPackets: NetPacket[]
  ): EngineUpdate {
    let update: EngineUpdate = { 
      removePacketIds: [packet.id],
      nodes: {},
      addPackets: [],
      addLogs: []
    };

    // 1. L2 Layer
    const l2Result = processL2(receiverNode, packet);

    // Merge L2 Updates
    // Why: MAC/IGMP学習は転送可否の判定より前に行われる処理。Dropでも学習結果は保存しないと、
    // 転送先が無いIGMP Report(単一スイッチ構成)が永遠に登録されない。
    if (l2Result.updatedMacTable || l2Result.updatedArpTable || l2Result.updatedIgmpTable || 
        l2Result.updatedIgmpExpires || l2Result.updatedMrouterPortId !== undefined || 
        l2Result.updatedMrouterPortExpiresAt !== undefined || l2Result.updatedQuerierStandby !== undefined) {
      if (!update.nodes![receiverNode.id]) update.nodes![receiverNode.id] = {};
      if (l2Result.updatedArpTable) update.nodes![receiverNode.id].arpTable = l2Result.updatedArpTable;
      // MAC表・スヌーピング表・mrouter・クエリアの状態は、フレームのVLANの入れ物へ書く
      if (l2Result.vlan !== undefined) {
        const patch: Partial<VlanState> = {};
        if (l2Result.updatedMacTable) patch.macTable = l2Result.updatedMacTable;
        if (l2Result.updatedIgmpTable) patch.igmpSnoopingTable = l2Result.updatedIgmpTable;
        if (l2Result.updatedIgmpExpires) patch.igmpSnoopingExpires = l2Result.updatedIgmpExpires;
        if (l2Result.updatedMrouterPortId !== undefined) patch.mrouterPortId = l2Result.updatedMrouterPortId || undefined;
        if (l2Result.updatedMrouterPortExpiresAt !== undefined) patch.mrouterPortExpiresAt = l2Result.updatedMrouterPortExpiresAt || undefined;
        if (l2Result.updatedQuerierStandby !== undefined) patch.querierStandby = l2Result.updatedQuerierStandby;
        if (Object.keys(patch).length > 0) update.nodes![receiverNode.id].vlanState = patchVlanState(receiverNode, l2Result.vlan, patch);
      }
    }

    if (l2Result.action === 'drop') {
      if (l2Result.log) update.addLogs?.push({ ...packet, status: 'error', info: l2Result.log.info });
      return update;
    }

    // Auto-learn MAC / ARP (Only if sender IP and MAC are valid)
    if (['pc', 'router', 'switch', 'l3switch', 'server', 'dns', 'dhcp'].includes(receiverNode.type) && packet.protocol !== 'ARP') {
      if (packet.senderIP && packet.senderMAC) {
        // Find the receiving interface (or default to first if unknown)
        const rxIface = receiverNode.interfaces.find(i => i.id === packet.toInterfaceId) || receiverNode.interfaces[0];
        // SVI方式のL3スイッチは、受けたVLANのSVIのアドレスで判定する
        const rxSvi = isSviMode(receiverNode) ? sviForVlan(receiverNode, l2Result.vlan ?? 1) : undefined;
        const targetIP = rxSvi ? rxSvi.ip : ['switch', 'l3switch'].includes(receiverNode.type) && receiverNode.managementIP
          ? receiverNode.managementIP
          : rxIface?.ip || '';
        const targetSubnet = rxSvi ? rxSvi.subnet : ['switch', 'l3switch'].includes(receiverNode.type) && receiverNode.managementSubnet
          ? receiverNode.managementSubnet
          : rxIface?.subnet || '255.255.255.0';
        
        // ONLY learn if the sender IP is in the SAME subnet as the receiving interface
        // OR if both are APIPA (169.254.x.x)
        const isAPIPA = packet.senderIP.startsWith('169.254.') && targetIP.startsWith('169.254.');
        if (targetIP && (isAPIPA || isInSameSubnet(packet.senderIP, targetIP, targetSubnet))) {
          const currentArpTable = (update.nodes![receiverNode.id] && update.nodes![receiverNode.id].arpTable) || receiverNode.arpTable || {};
          if (currentArpTable[packet.senderIP] !== packet.senderMAC) {
            if (!update.nodes![receiverNode.id]) update.nodes![receiverNode.id] = {};
            update.nodes![receiverNode.id].arpTable = { ...currentArpTable, [packet.senderIP]: packet.senderMAC };
          }
        }
      }
    }

    // L2 Forwarding
    if ((l2Result.action === 'forward' || l2Result.action === 'flood') && l2Result.forwardPorts) {
      if (l2Result.action === 'flood') update.addLogs?.push({ ...packet, status: 'sent', info: `L2 Flood: ${packet.protocol}` });
      
      const currentL2Ttl = packet.l2ttl !== undefined ? packet.l2ttl : L2_TTL_DEFAULT;
      if (currentL2Ttl <= 0) {
        update.addLogs?.push({ ...packet, status: 'error', info: `L2 Loop Detected: Packet dropped by ${receiverNode.label} (L2 TTL expired)` });
      } else {
        l2Result.forwardPorts.forEach(portId => {
          const res = this.prepareTransmission(receiverNode, { ...packet, from: receiverNode.id, originatingInterfaceId: portId, l2ttl: currentL2Ttl - 1, ...(l2Result.vlan !== undefined ? { vlanTag: l2Result.vlan } : {}) }, allNodes, allLinks, true);
          this.mergeUpdates(update, res);
        });
      }

      if (!l2Result.processAtL3) {
        return update;
      }
    }

    // 2. Protocol Dispatcher / L3 Forwarding
    if (l2Result.action === 'process' || l2Result.action === 'flood') {
      let protoUpdate: EngineUpdate = {};

      // SVI方式のL3スイッチ: 受けたVLANのSVIを「受信インターフェース」として、ルーティング用ビューでL3を処理する。
      // そのVLANにSVIが無ければ、L3には上げない(純粋なL2として扱う)。
      let l3Node: NetNode = receiverNode;
      if (isSviMode(receiverNode)) {
        const svi = sviForVlan(receiverNode, l2Result.vlan ?? 1);
        if (!svi) return update;
        l3Node = routingView({ ...receiverNode, ...(update.nodes![receiverNode.id] || {}) });
        packet = { ...packet, toInterfaceId: svi.id };
      }
      
      // NAT(戻り): 外側ポートに届いた、変換表にある応答は、内側のアドレスへ戻してから通常の転送へ進める。
      // 表に無い外からの通信は破棄する(「外から中へは入れない」)。
      const natOutside = natOutsideInterface(l3Node);
      if (natOutside && packet.toInterfaceId === natOutside.id) {
        const restored = translateInbound(l3Node, packet);
        if (restored) {
          const port = (p: NetPacket) => (p.protocol === 'ICMP' ? p.icmpId : p.destinationPort);
          update.addLogs?.push({ ...packet, status: 'sent', info: `NAT: reply to ${packet.targetIP}:${port(packet) ?? 0} sent back to ${restored.targetIP}:${port(restored) ?? 0}` });
          packet = restored;
        } else if (shouldDropUntranslated(l3Node, packet, packet.toInterfaceId)) {
          update.addLogs?.push({ ...packet, status: 'error', info: `NAT: dropped ${packet.protocol} from ${packet.senderIP} to ${packet.targetIP}: no matching translation (not a reply to an inside host)` });
          return update;
        }
      }

      // A. Check L3 (Routing/Filtering)
      const l3Result = processL3(l3Node, packet);
      
      if (l3Result.action === 'drop') {
        if (l3Result.log) update.addLogs?.push({ ...packet, status: 'error', info: l3Result.log.info });
        if (l3Result.errorType) {
          const res = this.prepareTransmission(l3Node, ICMPHandler.createError(l3Node, packet, l3Result.errorType), allNodes, allLinks);
          this.mergeUpdates(update, res);
        }
        return update;
      }

      if (l3Result.action === 'reply') {
        protoUpdate = ICMPHandler.handle(l3Node, packet);
      } else if (l3Result.action === 'forward' && l3Result.egressInterfaceId) {
        // Forwarding Logic
        const egressIface = l3Node.interfaces.find(i => i.id === l3Result.egressInterfaceId);
        let routedPacket: NetPacket = { 
          ...packet, 
          from: l3Node.id, 
          targetMAC: '', 
          senderMAC: egressIface?.mac || '', 
          originatingInterfaceId: l3Result.egressInterfaceId, 
          ttl: (packet.ttl || 64) - 1,
          status: 'pending' as const
        };
        // NAT(行き): 内側のポートで受けて、外側ポートから出すとき、送信元を書き換えて変換表に記録する
        const natOut = natOutsideInterface(l3Node);
        if (natOut && l3Result.egressInterfaceId === natOut.id && packet.toInterfaceId !== natOut.id) {
          const tr = translateOutbound(l3Node, routedPacket);
          if (tr) {
            if (tr.created) {
              const port = (p: NetPacket) => (p.protocol === 'ICMP' ? p.icmpId : p.sourcePort);
              update.addLogs?.push({ ...packet, status: 'sent', info: `NAT: ${packet.senderIP}:${port(packet) ?? 0} is now ${tr.packet.senderIP}:${port(tr.packet) ?? 0}` });
            }
            routedPacket = tr.packet;
            update.nodes![l3Node.id] = { ...(update.nodes![l3Node.id] || {}), natTable: tr.table };
          }
        }
        const res = this.prepareTransmission(l3Node, routedPacket, allNodes, allLinks);
        protoUpdate = res;
      } else {
        // Packet is FOR ME - Dispatch to specific protocol handler
        switch (packet.protocol) {
          case 'ARP': protoUpdate = ARPEngine.handle(l3Node, packet, pendingPackets); break;
          case 'ICMP': protoUpdate = ICMPHandler.handle(l3Node, packet); break;
          case 'UDP': 
          case 'DHCP': 
          case 'DNS':
          case 'mDNS':
            protoUpdate = UDPHandler.handle(l3Node, packet); break;
          case 'TCP': protoUpdate = TCPHandler.handle(l3Node, packet); break;
          case 'IGMP': protoUpdate = IGMPHandler.handle(l3Node, packet, packet.toInterfaceId || ''); break;
        }
      }

      // Merge protoUpdate entirely BEFORE handling addPackets
      this.mergeUpdates(update, {
        nodes: protoUpdate.nodes,
        addLogs: protoUpdate.addLogs,
        removePacketIds: protoUpdate.removePacketIds,
        pendingPacketsUpdate: protoUpdate.pendingPacketsUpdate
      });

      if (update.nodes && update.nodes[l3Node.id]) {
        Object.assign(l3Node, update.nodes[l3Node.id]);
      }

      if (protoUpdate.addPackets) {
        const rawPackets = [...protoUpdate.addPackets];
        rawPackets.forEach(p => {
          // SVI方式: すでにVLANの中へ入れ済みのフレーム(出口が物理ポート)は、もう一度組み立てずにそのまま出す
          if (l3Node !== receiverNode && !l3Node.interfaces.some(i => i.id === p.originatingInterfaceId)) {
            update.addPackets = [...(update.addPackets || []), p];
            return;
          }
          const res = this.prepareTransmission(l3Node, p, allNodes, allLinks);
          this.mergeUpdates(update, res);
        });
      }
    }

    return update;
  }

  static prepareTransmission(sourceNode: NetNode, packetData: any, allNodes: NetNode[], allLinks: NetLink[], isInternalFlood: boolean = false): EngineUpdate {
    const update: EngineUpdate = { addPackets: [], addLogs: [], pendingPacketsUpdate: { add: [] } };
    
    let sourceIface = packetData.originatingInterfaceId 
      ? sourceNode.interfaces.find(i => i.id === packetData.originatingInterfaceId)
      : sourceNode.interfaces.find(i => i.ip === packetData.senderIP) || sourceNode.interfaces[0];

    if (!sourceIface) return update;

    // SVI: 自分が出す返信(pingの応答など)の宛先が、そのSVIのネットワークに無いときは、経路で出口のSVIを選び直す
    // (送信元IPは、問われたSVIのIPのまま。実機の返信と同じ)
    if (sourceIface.sviVlan !== undefined && !packetData.targetMAC && packetData.targetIP !== '255.255.255.255'
        && !isInSameSubnet(sourceIface.ip, packetData.targetIP, sourceIface.subnet)) {
      const route = lookupRoute(sourceNode, packetData.targetIP);
      if (route && route.iface.id !== sourceIface.id) {
        sourceIface = route.iface;
        packetData = { ...packetData, originatingInterfaceId: route.iface.id, senderMAC: route.iface.mac };
      }
    }

    let packet: NetPacket = { 
      ...packetData, 
      id: generateId('p_'), 
      progress: 0, 
      from: sourceNode.id, 
      fromInterfaceId: sourceIface.id, 
      originatingInterfaceId: sourceIface.id, 
      senderMAC: packetData.senderMAC || sourceIface.mac,
      status: packetData.status || 'pending' 
    };

    // VLAN: スイッチのポートから出すときの、タグの符号化(アクセスはタグを外し、トランクはタグを付ける)。
    // 内部のVLAN(packetData.vlanTag)が無い、スイッチ自身のフレームは、VLAN 1 として扱う。
    if (isVlanSwitch(sourceNode)) {
      const tag = egressTag(sourceNode, sourceIface.id, packetData.vlanTag);
      if (tag === undefined) delete packet.vlanTag; else packet.vlanTag = tag;
    }

    // ICMP echo の識別子: 送信元が振る通し番号(応答はこれを引き継ぐ)。NATが、どの要求への応答かを見分けるのに使う
    if (packet.protocol === 'ICMP' && packet.type === 'echo-request' && packet.icmpId === undefined) {
      packet.icmpId = nextIcmpId;
      nextIcmpId = nextIcmpId >= 65535 ? 1 : nextIcmpId + 1;
    }

    const isBroadcast = packet.targetMAC === 'FF:FF:FF:FF:FF:FF' || packet.targetIP === '255.255.255.255';
    if (isMulticastIP(packet.targetIP) && !packet.targetMAC) packet.targetMAC = multicastIPToMAC(packet.targetIP);
    // Only force FF:FF:FF:FF:FF:FF if targetMAC is not already a specific unicast MAC.
    // This preserves DHCP OFFER/ACK which uses targetIP=255.255.255.255 but targetMAC=client MAC (RFC 2131).
    else if (isBroadcast && (!packet.targetMAC || packet.targetMAC === '' || packet.targetMAC === 'FF:FF:FF:FF:FF:FF')) {
      packet.targetMAC = 'FF:FF:FF:FF:FF:FF';
    }

    // ARP Check
    if (['pc', 'router', 'server', 'dns', 'l3switch', 'dhcp'].includes(sourceNode.type) && !isBroadcast && packet.targetMAC === '') {
      const routingResult = determineNextHop(sourceIface, packet.targetIP);
      if (routingResult.error) {
        update.addLogs?.push({ ...packet, status: 'error', info: routingResult.logInfo || routingResult.error });
        return update;
      }
      const nextHopIP = routingResult.nextHopIP;
      const cachedMAC = sourceNode.arpTable?.[nextHopIP];
      if (cachedMAC) {
        packet.targetMAC = cachedMAC;
      } else {
        update.pendingPacketsUpdate!.add?.push(packet);
        const arpReq = ARPEngine.createRequest(sourceNode, sourceIface, nextHopIP);
        const res = this.prepareTransmission(sourceNode, arpReq, allNodes, allLinks, false);
        this.mergeUpdates(update, res);
        return update;
      }
    }

    // Logging Sent - Only log specific high-level protocols to avoid noise
    const isNewOrReleased = !packetData.fromInterfaceId || packetData.status === 'pending';
    if (!isInternalFlood && isNewOrReleased) {
      if (packet.protocol === 'ARP') {
        const info = packet.type === 'request' 
          ? `ARP Request: Who has ${packet.targetIP}? Tell ${packet.senderIP}` 
          : `ARP Reply: ${packet.senderIP} is at ${packet.senderMAC}`;
        update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'sent', info });
      } 
      // General IP/TCP/UDP logs are now handled more specifically by their protocol handlers to avoid redundancy
    }

    // SVIから出るフレーム: 物理リンクではなく、そのVLANの中へ入れる
    if (sourceIface.sviVlan !== undefined) {
      this.mergeUpdates(update, this.injectIntoVlan(sourceNode, sourceIface.sviVlan, packet, allNodes, allLinks));
      return update;
    }

    const link = allLinks.find(l => (l.from === sourceNode.id && l.fromInterfaceId === sourceIface.id) || (l.to === sourceNode.id && l.toInterfaceId === sourceIface.id));
    if (link) {
      packet.to = link.from === sourceNode.id ? link.to : link.from;
      packet.toInterfaceId = link.from === sourceNode.id ? link.toInterfaceId : link.fromInterfaceId;
      update.addPackets?.push(packet);
    } else if (!isInternalFlood) {
      // Only log "No link found" if this wasn't part of a flood/broadcast
      console.warn(`Link lookup failed for ${sourceNode.label} on interface ${sourceIface.name} (${sourceIface.id})`);
      if (packet.protocol !== 'ARP') {
        update.addLogs?.push({ ...packet, status: 'error', info: `No link found on ${sourceIface.name}` });
      }
    }

    return update;
  }

  /**
   * SVIで作ったフレームを、VLAN v の中へ入れる(L3スイッチの内部から、そのVLANのポートへ出す)。
   * 宛先MACがそのVLANのMAC表にあれば1つのポートへ、無い(またはブロードキャスト/マルチキャスト)なら、VLANの全ポートへ。
   * 出すポートで、タグを符号化する(アクセスは外し、トランクは付ける)。
   */
  static injectIntoVlan(viewNode: NetNode, vlan: number, packet: NetPacket, allNodes: NetNode[], allLinks: NetLink[]): EngineUpdate {
    const update: EngineUpdate = { addPackets: [] };
    const real = allNodes.find(n => n.id === viewNode.id);
    if (!real) return update;
    // ポートは実ノード、学習状態(今回のフレームで更新されたもの)はビューから
    const sw: NetNode = { ...real, vlanState: viewNode.vlanState };
    const vlanPorts = portsInVlan(sw, vlan);
    const norm = (m: string) => m.replace(/:/g, '').toLowerCase();
    const macTable = getVlanState(sw, vlan).macTable || {};
    const key = Object.keys(macTable).find(m => norm(m) === norm(packet.targetMAC || ''));
    const learned = key !== undefined && packet.targetMAC !== 'FF:FF:FF:FF:FF:FF' && !isMulticastMAC(packet.targetMAC || '') ? macTable[key] : undefined;
    const outPorts = learned && vlanPorts.includes(learned) ? [learned] : vlanPorts;
    outPorts.forEach((portId, n) => {
      const link = allLinks.find(l => (l.from === sw.id && l.fromInterfaceId === portId) || (l.to === sw.id && l.toInterfaceId === portId));
      if (!link) return;
      const out: NetPacket = {
        ...packet,
        id: n === 0 ? packet.id : generateId('p_'),
        fromInterfaceId: portId,
        originatingInterfaceId: portId,
        l2ttl: L2_TTL_DEFAULT,
        to: link.from === sw.id ? link.to : link.from,
        toInterfaceId: link.from === sw.id ? link.toInterfaceId : link.fromInterfaceId
      };
      const tag = egressTag(sw, portId, vlan);
      if (tag === undefined) delete out.vlanTag; else out.vlanTag = tag;
      update.addPackets!.push(out);
    });
    return update;
  }

  static mergeUpdates(target: EngineUpdate, source: EngineUpdate) {
    if (source.nodes) target.nodes = { ...target.nodes, ...source.nodes };
    if (source.addPackets) target.addPackets = [...(target.addPackets || []), ...source.addPackets];
    if (source.removePacketIds) target.removePacketIds = [...(target.removePacketIds || []), ...source.removePacketIds];
    if (source.addLogs) target.addLogs = [...(target.addLogs || []), ...source.addLogs];
    if (source.pendingPacketsUpdate) {
      if (!target.pendingPacketsUpdate) target.pendingPacketsUpdate = {};
      if (source.pendingPacketsUpdate.clear) target.pendingPacketsUpdate.clear = true;
      if (source.pendingPacketsUpdate.add) target.pendingPacketsUpdate.add = [...(target.pendingPacketsUpdate.add || []), ...source.pendingPacketsUpdate.add];
      if (source.pendingPacketsUpdate.removeIds) target.pendingPacketsUpdate.removeIds = [...(target.pendingPacketsUpdate.removeIds || []), ...source.pendingPacketsUpdate.removeIds];
    }
  }
}
