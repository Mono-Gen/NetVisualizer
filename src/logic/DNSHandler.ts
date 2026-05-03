import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { findEgressInterface } from './networkUtils';

export class DNSHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };

    // 1. Server Logic
    if (receiverNode.type === 'dns' || receiverNode.dnsRecords) {
      if (packet.protocol === 'DNS' || packet.destinationPort === 53) {
        const hostname = (packet.payload?.hostname || '').toLowerCase();
        const ip = receiverNode.dnsRecords?.[hostname];
        if (ip) {
          update.addPackets?.push({
            from: receiverNode.id,
            senderIP: packet.targetIP,
            targetIP: packet.senderIP,
            targetMAC: '',
            protocol: 'DNS',
            type: 'response',
            sourcePort: 53,
            destinationPort: packet.sourcePort,
            payload: { hostname, ip },
            status: 'pending',
            ttl: 64,
            id: `p_dns_r_${Date.now()}`,
            progress: 0
          } as any);
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `DNS Query for "${hostname}" resolved to ${ip}` });
        } else if (packet.type === 'query' || packet.type === 'request') {
          update.addLogs?.push({ 
            time: new Date().toLocaleTimeString(), 
            ...packet, 
            status: 'error', 
            info: `DNS Query for "${hostname}" failed (NXDOMAIN)` 
          });
        }
      }
    }

    // 2. Client Logic (Caching)
    if ((packet.type === 'response' || packet.type === 'reply') && (packet.protocol === 'DNS' || packet.sourcePort === 53) && packet.payload?.ip) {
      const cache = { ...(receiverNode.dnsCache || {}) };
      cache[packet.payload.hostname] = packet.payload.ip;
      update.nodes![receiverNode.id] = { dnsCache: cache };
      update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `DNS Response: ${packet.payload.hostname} is ${packet.payload.ip}. Cache updated.` });
    }

    return update;
  }

  static createQuery(fromNode: NetNode, dnsServerIP: string, hostname: string): NetPacket {
    const egressIface = findEgressInterface(fromNode, dnsServerIP);
    return {
      from: fromNode.id, senderIP: egressIface.ip, targetIP: dnsServerIP, protocol: 'DNS', type: 'query', sourcePort: Math.floor(1024 + Math.random() * 60000), destinationPort: 53, payload: { hostname }, status: 'pending', ttl: 64, originatingInterfaceId: egressIface.id, id: `p_dns_q_${Date.now()}`, progress: 0
    };
  }
}
