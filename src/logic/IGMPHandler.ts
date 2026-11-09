import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { multicastIPToMAC } from './MulticastEngine';
import { DEFAULT_VLAN, portsInVlan, querierSourceIp, getVlanState, isTrunkInterface } from './vlan';

export class IGMPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket, incomingInterfaceId: string): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };

    // 1. Host Logic
    if (['pc', 'server'].includes(receiverNode.type)) {
      if (packet.type === 'query') {
        const joinedGroups = receiverNode.joinedGroups || [];
        // レポートは、クエリを受け取ったNICから返す
        const rx = receiverNode.interfaces.find(i => i.id === incomingInterfaceId) || receiverNode.interfaces[0];
        joinedGroups.forEach(group => {
          update.addPackets?.push({
            from: receiverNode.id,
            to: 'BROADCAST',
            senderIP: rx.ip,
            targetIP: group,
            senderMAC: rx.mac,
            targetMAC: multicastIPToMAC(group),
            protocol: 'IGMP',
            type: 'report',
            status: 'pending',
            fromInterfaceId: rx.id,
            originatingInterfaceId: rx.id,
            id: `p_igmp_report_${Date.now()}_${group}`,
            progress: 0
          });
        });
      }
    }

    return update;
  }

  static handleSnooping(
    node: NetNode,
    packet: NetPacket,
    ingressPortId: string,
    vlan: number = DEFAULT_VLAN
  ): {
    updatedIgmpTable?: Record<string, string[]>;
    updatedIgmpExpires?: Record<string, Record<string, number>>;
    updatedMrouterPortId?: string | null;
    updatedMrouterPortExpiresAt?: number | null;
    updatedQuerierStandby?: boolean;
  } {
    // 表は、そのVLANのもの(同じグループでも、VLANが違えば別の表)
    const vlanState = getVlanState(node, vlan);
    const table = { ...(vlanState.igmpSnoopingTable || {}) };
    const expires = { ...(vlanState.igmpSnoopingExpires || {}) };
    
    // 1. Handle Query (Querier Election & mrouter Port Learning)
    if (packet.type === 'query') {
      const agingTime = (node.igmpSnoopingAgingTime || 30) * 1000;
      const result: any = {
        updatedMrouterPortId: ingressPortId, // 受けたポートのVLANの、mrouterポートとして学ぶ
        updatedMrouterPortExpiresAt: Date.now() + (agingTime * 2)
      };

      // Querier Election
      if (node.igmpQuerierEnabled && packet.senderIP) {
        // 選挙は、クエリを受けたVLANごと。自分のIPは、そのVLANでクエリアが使うIP
        const myIP = querierSourceIp(node, vlan);
        const peerIP = packet.senderIP;

        const ipToLong = (ip: string): number => {
          if (!ip || ip === '0.0.0.0') return 0xFFFFFFFF; // IPなし(0.0.0.0)は、選挙では常に負ける
          const parts = ip.split('.').map(Number);
          if (parts.length !== 4 || parts.some(isNaN)) return 0xFFFFFFFF;
          return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
        };

        const myIPLong = ipToLong(myIP);
        const peerIPLong = ipToLong(peerIP);

        if (peerIPLong < myIPLong) {
          result.updatedQuerierStandby = true; // Lost election
        } else if (peerIPLong === myIPLong) {
          // If IP is same or empty, tie-breaker with MAC
          // 相手のクエリの送信元MACは、そのVLANの最初のポートのMAC(createQuery)。自分も同じ基準で比べる
          const myMAC = (node.interfaces.find(i => portsInVlan(node, vlan).includes(i.id)) ?? node.interfaces[0])?.mac || '';
          const peerMAC = packet.senderMAC || '';
          if (peerMAC < myMAC) {
            result.updatedQuerierStandby = true;
          }
        }
      }

      return result;
    }

    // 2. Handle Report/Leave
    const groupIP = packet.payload?.group || packet.targetIP;
    const isReport = packet.type === 'report' || packet.type === 'membership-report';
    const isLeave = packet.type === 'leave' || packet.type === 'leave-group';

    if (isReport) {
      const currentPorts = table[groupIP] || [];
      const updatedPorts = [...currentPorts];
      if (!currentPorts.includes(ingressPortId)) {
        updatedPorts.push(ingressPortId);
      }
      table[groupIP] = updatedPorts;

      if (!expires[groupIP]) expires[groupIP] = {};
      const agingTime = (node.igmpSnoopingAgingTime || 30) * 1000;
      expires[groupIP][ingressPortId] = Date.now() + agingTime;

      return { updatedIgmpTable: table, updatedIgmpExpires: expires };
    } else if (isLeave) {
      // トランクの上の登録は、下流の複数の受信者をまとめたもの。1つのLeaveでは消さず、時間切れを待つ
      if (isTrunkInterface(node.interfaces.find(i => i.id === ingressPortId))) return {};
      const currentPorts = table[groupIP] || [];
      const updatedPorts = currentPorts.filter(p => p !== ingressPortId);
      
      if (updatedPorts.length === 0) {
        delete table[groupIP];
        delete expires[groupIP];
      } else {
        table[groupIP] = updatedPorts;
        if (expires[groupIP]) {
          delete expires[groupIP][ingressPortId];
        }
      }
      return { updatedIgmpTable: table, updatedIgmpExpires: expires };
    }

    return {};
  }

  /** 1つのVLAN用の、一般クエリ(出すポートは呼び出し側が指定。既定はそのVLANの最初のポート) */
  static createQuery(currentNode: NetNode, vlan: number = DEFAULT_VLAN): NetPacket {
    const matchingIface = currentNode.interfaces.find(i => portsInVlan(currentNode, vlan).includes(i.id)) ?? currentNode.interfaces[0];
    const senderIP = querierSourceIp(currentNode, vlan) || '0.0.0.0';
    const senderMAC = matchingIface ? matchingIface.mac : '00:00:00:00:00:00';
    const faceId = matchingIface ? matchingIface.id : 'mgmt';
    return {
      from: currentNode.id,
      to: 'BROADCAST',
      senderIP: senderIP,
      targetIP: '224.0.0.1',
      senderMAC: senderMAC,
      targetMAC: multicastIPToMAC('224.0.0.1'),
      protocol: 'IGMP',
      type: 'query',
      status: 'pending',
      vlanTag: vlan, // トランクから出るときのタグ(アクセスポートから出るときは、エンジンが外す)
      fromInterfaceId: faceId,
      originatingInterfaceId: faceId,
      id: `p_igmp_q_${Date.now()}`,
      progress: 0
    };
  }

  /** そのVLANのポートごとに、クエリを1つずつ作る(手動送信と定期送信で共用) */
  static createQueriesForVlan(currentNode: NetNode, vlan: number): NetPacket[] {
    const base = IGMPHandler.createQuery(currentNode, vlan);
    return portsInVlan(currentNode, vlan).map(ifaceId => ({
      ...base,
      fromInterfaceId: ifaceId,
      originatingInterfaceId: ifaceId,
      id: `p_igmp_q_${Date.now()}_${ifaceId}`
    }));
  }

  static createReport(currentNode: NetNode, groupIP: string): NetPacket {
    const matchingIface = currentNode.interfaces[0];
    return {
      from: currentNode.id, to: 'BROADCAST', senderIP: matchingIface.ip, targetIP: groupIP, senderMAC: matchingIface.mac, targetMAC: multicastIPToMAC(groupIP), protocol: 'IGMP', type: 'report', status: 'pending', fromInterfaceId: matchingIface.id, originatingInterfaceId: matchingIface.id, id: `p_igmp_r_${Date.now()}_${groupIP}`, progress: 0
    };
  }

  static createLeave(currentNode: NetNode, groupIP: string): NetPacket {
    const matchingIface = currentNode.interfaces[0];
    return {
      from: currentNode.id, to: 'BROADCAST', senderIP: matchingIface.ip, targetIP: groupIP, senderMAC: matchingIface.mac, targetMAC: multicastIPToMAC('224.0.0.2'), protocol: 'IGMP', type: 'leave', status: 'pending', fromInterfaceId: matchingIface.id, originatingInterfaceId: matchingIface.id, id: `p_igmp_l_${Date.now()}`, progress: 0
    };
  }

  static getMulticastEgressPorts(node: NetNode, groupIP: string, ingressPortId: string, vlan: number = DEFAULT_VLAN): string[] {
    const snoopingTable = getVlanState(node, vlan).igmpSnoopingTable || {};
    const registeredPorts = snoopingTable[groupIP] || [];
    
    if (registeredPorts.length > 0) {
      return registeredPorts.filter(p => p !== ingressPortId);
    }
    
    // Default to flood if not in table
    return node.interfaces
      .filter(iface => iface.id !== ingressPortId)
      .map(iface => iface.id);
  }
}
