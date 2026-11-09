import type { NetNode, NetPacket, NetLink, EngineUpdate, VlanState } from '../types/network';
import { patchVlanState, isVlanSwitch, egressTag } from '../logic/vlan';
import { processL2 } from '../logic/L2Layer';
import { processL3, determineNextHop } from '../logic/L3Layer';
import { ARPEngine } from '../logic/ARPEngine';
import { ICMPHandler } from '../logic/ICMPHandler';
import { IGMPHandler } from '../logic/IGMPHandler';
import { UDPHandler } from '../logic/UDPHandler';
import { TCPHandler } from '../logic/TCPHandler';
import { DNSHandler } from '../logic/DNSHandler';
import { generateId } from '../logic/networkUtils';
import { isMulticastIP, multicastIPToMAC } from '../logic/MulticastEngine';
import { isInSameSubnet } from '../logic/networkUtils';
import { L2_TTL_DEFAULT } from '../logic/simLimits';
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
        const targetIP = ['switch', 'l3switch'].includes(receiverNode.type) && receiverNode.managementIP
          ? receiverNode.managementIP
          : rxIface?.ip || '';
        const targetSubnet = ['switch', 'l3switch'].includes(receiverNode.type) && receiverNode.managementSubnet
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
      
      // NAT(戻り): 外側ポートに届いた、変換表にある応答は、内側のアドレスへ戻してから通常の転送へ進める。
      // 表に無い外からの通信は破棄する(「外から中へは入れない」)。
      const natOutside = natOutsideInterface(receiverNode);
      if (natOutside && packet.toInterfaceId === natOutside.id) {
        const restored = translateInbound(receiverNode, packet);
        if (restored) {
          const port = (p: NetPacket) => (p.protocol === 'ICMP' ? p.icmpId : p.destinationPort);
          update.addLogs?.push({ ...packet, status: 'sent', info: `NAT: reply to ${packet.targetIP}:${port(packet) ?? 0} sent back to ${restored.targetIP}:${port(restored) ?? 0}` });
          packet = restored;
        } else if (shouldDropUntranslated(receiverNode, packet, packet.toInterfaceId)) {
          update.addLogs?.push({ ...packet, status: 'error', info: `NAT: dropped ${packet.protocol} from ${packet.senderIP} to ${packet.targetIP}: no matching translation (not a reply to an inside host)` });
          return update;
        }
      }

      // A. Check L3 (Routing/Filtering)
      const l3Result = processL3(receiverNode, packet);
      
      if (l3Result.action === 'drop') {
        if (l3Result.log) update.addLogs?.push({ ...packet, status: 'error', info: l3Result.log.info });
        if (l3Result.errorType) {
          const res = this.prepareTransmission(receiverNode, ICMPHandler.createError(receiverNode, packet, l3Result.errorType), allNodes, allLinks);
          this.mergeUpdates(update, res);
        }
        return update;
      }

      if (l3Result.action === 'reply') {
        protoUpdate = ICMPHandler.handle(receiverNode, packet);
      } else if (l3Result.action === 'forward' && l3Result.egressInterfaceId) {
        // Forwarding Logic
        const egressIface = receiverNode.interfaces.find(i => i.id === l3Result.egressInterfaceId);
        let routedPacket: NetPacket = { 
          ...packet, 
          from: receiverNode.id, 
          targetMAC: '', 
          senderMAC: egressIface?.mac || '', 
          originatingInterfaceId: l3Result.egressInterfaceId, 
          ttl: (packet.ttl || 64) - 1,
          status: 'pending' as const
        };
        // NAT(行き): 内側のポートで受けて、外側ポートから出すとき、送信元を書き換えて変換表に記録する
        const natOut = natOutsideInterface(receiverNode);
        if (natOut && l3Result.egressInterfaceId === natOut.id && packet.toInterfaceId !== natOut.id) {
          const tr = translateOutbound(receiverNode, routedPacket);
          if (tr) {
            if (tr.created) {
              const port = (p: NetPacket) => (p.protocol === 'ICMP' ? p.icmpId : p.sourcePort);
              update.addLogs?.push({ ...packet, status: 'sent', info: `NAT: ${packet.senderIP}:${port(packet) ?? 0} is now ${tr.packet.senderIP}:${port(tr.packet) ?? 0}` });
            }
            routedPacket = tr.packet;
            update.nodes![receiverNode.id] = { ...(update.nodes![receiverNode.id] || {}), natTable: tr.table };
          }
        }
        const res = this.prepareTransmission(receiverNode, routedPacket, allNodes, allLinks);
        protoUpdate = res;
      } else {
        // Packet is FOR ME - Dispatch to specific protocol handler
        switch (packet.protocol) {
          case 'ARP': protoUpdate = ARPEngine.handle(receiverNode, packet, pendingPackets); break;
          case 'ICMP': protoUpdate = ICMPHandler.handle(receiverNode, packet); break;
          case 'UDP': 
          case 'DHCP': 
          case 'DNS':
          case 'mDNS':
            protoUpdate = UDPHandler.handle(receiverNode, packet); break;
          case 'TCP': protoUpdate = TCPHandler.handle(receiverNode, packet); break;
          case 'IGMP': protoUpdate = IGMPHandler.handle(receiverNode, packet, packet.toInterfaceId || ''); break;
        }
      }

      // Merge protoUpdate entirely BEFORE handling addPackets
      this.mergeUpdates(update, {
        nodes: protoUpdate.nodes,
        addLogs: protoUpdate.addLogs,
        removePacketIds: protoUpdate.removePacketIds,
        pendingPacketsUpdate: protoUpdate.pendingPacketsUpdate
      });

      if (update.nodes && update.nodes[receiverNode.id]) {
        Object.assign(receiverNode, update.nodes[receiverNode.id]);
      }

      if (protoUpdate.addPackets) {
        const rawPackets = [...protoUpdate.addPackets];
        rawPackets.forEach(p => {
          const res = this.prepareTransmission(receiverNode, p, allNodes, allLinks);
          this.mergeUpdates(update, res);
        });
      }
    }

    return update;
  }

  static prepareTransmission(sourceNode: NetNode, packetData: any, allNodes: NetNode[], allLinks: NetLink[], isInternalFlood: boolean = false): EngineUpdate {
    const update: EngineUpdate = { addPackets: [], addLogs: [], pendingPacketsUpdate: { add: [] } };
    
    const sourceIface = packetData.originatingInterfaceId 
      ? sourceNode.interfaces.find(i => i.id === packetData.originatingInterfaceId)
      : sourceNode.interfaces.find(i => i.ip === packetData.senderIP) || sourceNode.interfaces[0];

    if (!sourceIface) return update;

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
