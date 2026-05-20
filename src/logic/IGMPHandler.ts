import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { multicastIPToMAC } from './MulticastEngine';

export class IGMPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket, incomingInterfaceId: string): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };

    // 1. Host Logic
    if (['pc', 'server'].includes(receiverNode.type)) {
      if (packet.type === 'query') {
        const joinedGroups = receiverNode.joinedGroups || [];
        joinedGroups.forEach(group => {
          update.addPackets?.push({
            from: receiverNode.id,
            to: 'BROADCAST',
            senderIP: receiverNode.interfaces[0].ip,
            targetIP: group,
            senderMAC: receiverNode.interfaces[0].mac,
            targetMAC: multicastIPToMAC(group),
            protocol: 'IGMP',
            type: 'report',
            status: 'pending',
            fromInterfaceId: receiverNode.interfaces[0].id,
            originatingInterfaceId: receiverNode.interfaces[0].id,
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
    ingressPortId: string
  ): {
    updatedIgmpTable?: Record<string, string[]>;
    updatedIgmpExpires?: Record<string, Record<string, number>>;
    updatedMrouterPortId?: string | null;
    updatedMrouterPortExpiresAt?: number | null;
    updatedQuerierStandby?: boolean;
  } {
    const table = { ...(node.igmpSnoopingTable || {}) };
    const expires = { ...(node.igmpSnoopingExpires || {}) };
    
    // 1. Handle Query (Querier Election & mrouter Port Learning)
    if (packet.type === 'query') {
      const agingTime = (node.igmpSnoopingAgingTime || 30) * 1000;
      const result: any = {
        updatedMrouterPortId: ingressPortId,
        updatedMrouterPortExpiresAt: Date.now() + (agingTime * 2)
      };

      // Querier Election
      if (node.igmpQuerierEnabled && packet.senderIP) {
        const myIP = node.managementIP || '';
        const peerIP = packet.senderIP;

        const ipToLong = (ip: string): number => {
          if (!ip) return 0xFFFFFFFF;
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
          const myMAC = node.interfaces[0]?.mac || '';
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

  static createQuery(currentNode: NetNode): NetPacket {
    const matchingIface = currentNode.interfaces[0];
    const senderIP = currentNode.managementIP || (matchingIface ? matchingIface.ip : '0.0.0.0');
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
      fromInterfaceId: faceId,
      originatingInterfaceId: faceId,
      id: `p_igmp_q_${Date.now()}`,
      progress: 0
    };
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

  static getMulticastEgressPorts(node: NetNode, groupIP: string, ingressPortId: string): string[] {
    const snoopingTable = node.igmpSnoopingTable || {};
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
