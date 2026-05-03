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

  static handleSnooping(node: NetNode, packet: NetPacket, ingressPortId: string): { updatedIgmpTable?: Record<string, string[]> } {
    const table = { ...(node.igmpSnoopingTable || {}) };
    const groupIP = packet.payload?.group || packet.targetIP;
    const isReport = packet.type === 'report' || packet.type === 'membership-report';
    const isLeave = packet.type === 'leave' || packet.type === 'leave-group';

    if (isReport) {
      const currentPorts = table[groupIP] || [];
      if (!currentPorts.includes(ingressPortId)) {
        table[groupIP] = [...currentPorts, ingressPortId];
        return { updatedIgmpTable: table };
      }
    } else if (isLeave) {
      const currentPorts = table[groupIP] || [];
      const updatedPorts = currentPorts.filter(p => p !== ingressPortId);
      if (updatedPorts.length === 0) delete table[groupIP];
      else table[groupIP] = updatedPorts;
      return { updatedIgmpTable: table };
    }

    return {};
  }

  static createQuery(currentNode: NetNode): NetPacket {
    const matchingIface = currentNode.interfaces[0];
    return {
      from: currentNode.id, to: 'BROADCAST', senderIP: matchingIface.ip, targetIP: '224.0.0.1', senderMAC: matchingIface.mac, targetMAC: multicastIPToMAC('224.0.0.1'), protocol: 'IGMP', type: 'query', status: 'pending', fromInterfaceId: matchingIface.id, originatingInterfaceId: matchingIface.id, id: `p_igmp_q_${Date.now()}`, progress: 0
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
