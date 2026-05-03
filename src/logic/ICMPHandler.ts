import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { findEgressInterface } from './networkUtils';

export type ICMPErrorType = 'Port Unreachable' | 'Host Unreachable' | 'TTL Expired';

export class ICMPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { addPackets: [], addLogs: [] };

    if (packet.type === 'echo-request') {
      const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP);
      if (matchingIface) {
        update.addLogs?.push({ 
          ...packet, 
          status: 'received', 
          info: `ICMP Echo Request Received by ${receiverNode.label}` 
        });
        
        update.addPackets?.push({
          from: receiverNode.id,
          to: '',
          senderIP: matchingIface.ip,
          targetIP: packet.senderIP,
          senderMAC: matchingIface.mac,
          targetMAC: '',
          protocol: 'ICMP',
          type: 'echo-reply',
          status: 'pending',
          ttl: 64,
          originatingInterfaceId: matchingIface.id,
          id: `p_icmp_reply_${Date.now()}`,
          progress: 0
        });
      }
    } else if (packet.type === 'echo-reply') {
      update.addLogs?.push({ 
        ...packet, 
        status: 'received', 
        info: `ICMP Echo Reply Received from ${packet.senderIP}` 
      });
    } else if (packet.status === 'error') {
      update.addLogs?.push({
        ...packet,
        status: 'error',
        info: `ICMP Error (${packet.type}) from ${packet.senderIP}: ${packet.payload?.errorType || 'Unknown Error'}`
      });
    }

    return update;
  }

  static createError(
    currentNode: NetNode,
    originalPacket: NetPacket,
    errorType: ICMPErrorType
  ): NetPacket {
    let matchingIface = currentNode.interfaces.find(i => i.id === originalPacket.originatingInterfaceId);
    if (!matchingIface) {
      matchingIface = findEgressInterface(currentNode, originalPacket.senderIP);
    }
    
    const type = errorType === 'Host Unreachable' || errorType === 'Port Unreachable' 
      ? 'destination-unreachable' 
      : 'time-exceeded';

    return {
      from: currentNode.id,
      to: '',
      senderIP: matchingIface.ip,
      targetIP: originalPacket.senderIP,
      senderMAC: matchingIface.mac,
      targetMAC: '',
      protocol: 'ICMP',
      type: type,
      status: 'error',
      payload: { errorType, originalProtocol: originalPacket.protocol },
      ttl: 64,
      originatingInterfaceId: matchingIface.id,
      id: `p_icmp_err_${Date.now()}`,
      progress: 0
    };
  }
}
