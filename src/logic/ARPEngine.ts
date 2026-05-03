import type { NetNode, NetPacket, NetInterface, EngineUpdate } from '../types/network';
import { determineNextHop } from './L3Layer';
import { isInSameSubnet } from './networkUtils';

/**
 * Logic for Address Resolution Protocol
 */
export class ARPEngine {
  
  static handle(
    receiverNode: NetNode,
    packet: NetPacket,
    pendingPackets: NetPacket[]
  ): EngineUpdate {
    const update: EngineUpdate = { 
      nodes: {}, 
      addPackets: [], 
      addLogs: [],
      pendingPacketsUpdate: {}
    };

    // Learn the sender (ONLY if in the same subnet)
    const rxIface = receiverNode.interfaces.find(i => i.id === packet.toInterfaceId) || receiverNode.interfaces[0];
    if (rxIface && isInSameSubnet(packet.senderIP, rxIface.ip, rxIface.subnet)) {
      const updatedArpTable = { 
        ...(receiverNode.arpTable || {}), 
        [packet.senderIP]: packet.senderMAC 
      };
      update.nodes![receiverNode.id] = { arpTable: updatedArpTable };
    }

    // 1. Handle ARP Request -> Generate Reply
    if (packet.type === 'request') {
      const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP);
      
      if (matchingIface) {
        update.addLogs?.push({
          ...packet,
          status: 'received',
          info: `ARP Request Match! ${receiverNode.label} is sending Reply.`
        });

        update.addPackets?.push({
          from: receiverNode.id,
          to: packet.from, 
          senderIP: matchingIface.ip,
          targetIP: packet.senderIP,
          senderMAC: matchingIface.mac,
          targetMAC: packet.senderMAC,
          protocol: 'ARP',
          type: 'reply',
          status: 'pending',
          fromInterfaceId: matchingIface.id,
          originatingInterfaceId: matchingIface.id,
          id: `p_arp_reply_${Date.now()}`,
          progress: 0
        });
      } else {
        update.addLogs?.push({
          ...packet,
          status: 'dropped',
          info: `ARP Request for ${packet.targetIP} ignored by ${receiverNode.label}`
        } as any);
      }
    }

    // 2. Handle ARP Reply -> Release Pending
    if (packet.type === 'reply') {
      update.addLogs?.push({ 
        ...packet, 
        status: 'received', 
        info: `ARP Reply Received: ${packet.senderIP} is at ${packet.senderMAC}` 
      });

      const resolvedIP = packet.senderIP;
      const released = pendingPackets.filter(p => {
        // Need to check if the pending packet belongs to this node
        if (p.from !== receiverNode.id) return false;
        
        const iface = receiverNode.interfaces.find(i => i.id === p.fromInterfaceId);
        return iface && determineNextHop(iface, p.targetIP).nextHopIP === resolvedIP;
      });

      if (released.length > 0) {
        update.pendingPacketsUpdate = { removeIds: released.map(r => r.id) };
        released.forEach(p => {
          update.addPackets?.push({ ...p, targetMAC: packet.senderMAC, status: 'pending', progress: 0 });
        });
      }
    }

    return update;
  }

  static createRequest(
    sourceNode: NetNode,
    sourceIface: NetInterface,
    targetIP: string
  ): NetPacket {
    return {
      from: sourceNode.id,
      to: 'BROADCAST', 
      senderIP: sourceIface.ip,
      targetIP: targetIP,
      senderMAC: sourceIface.mac,
      targetMAC: 'FF:FF:FF:FF:FF:FF',
      protocol: 'ARP',
      type: 'request',
      status: 'pending',
      fromInterfaceId: sourceIface.id,
      originatingInterfaceId: sourceIface.id,
      id: `p_arp_req_${Date.now()}`,
      progress: 0
    };
  }
}
