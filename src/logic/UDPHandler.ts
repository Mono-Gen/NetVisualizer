import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { ICMPHandler } from './ICMPHandler';
import { DHCPHandler } from './DHCPHandler';
import { DNSHandler } from './DNSHandler';
import { findEgressInterface, isInSameSubnet } from './networkUtils';

export class UDPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };

    // Multicast Group Check (RFC Compliance)
    const isMulticastIP = packet.targetIP.startsWith('224.') || packet.targetIP.startsWith('239.');
    if (isMulticastIP) {
      const isJoined = (receiverNode.joinedGroups || []).includes(packet.targetIP);
      if (!isJoined) {
        update.addLogs?.push({ 
          time: new Date().toLocaleTimeString(), 
          ...packet, 
          status: 'dropped', 
          info: `Multicast packet ignored by ${receiverNode.label}: Not a member of group ${packet.targetIP}.` 
        });
        return update;
      }
    }

    // Port check (bypass for mDNS port 5353, DHCP 67, 68)
    const isMDNS = packet.destinationPort === 5353;
    const isDHCPServer = packet.destinationPort === 67;
    const isDHCPClient = packet.destinationPort === 68;
    const isDNS = packet.destinationPort === 53 || packet.sourcePort === 53;
    const isPortOpen = 
      receiverNode.listeningPorts?.some(p => p.port === packet.destinationPort && p.protocol === 'UDP') ||
      receiverNode.services?.some(s => s.port === packet.destinationPort);
    const isUDPBased = ['UDP', 'DHCP', 'DNS', 'mDNS'].includes(packet.protocol);
    if (!isUDPBased) return update;
    if (!isPortOpen && !isMDNS && !isDHCPServer && !isDHCPClient && !isDNS) {
      const isBroadcast = packet.targetIP === '255.255.255.255' || packet.targetMAC === 'FF:FF:FF:FF:FF:FF';
      
      if (isMulticastIP || isBroadcast) {
        update.addLogs?.push({
          time: new Date().toLocaleTimeString(),
          ...packet,
          status: 'dropped',
          info: `UDP ${isMulticastIP ? 'Multicast' : 'Broadcast'} on port ${packet.destinationPort} ignored by ${receiverNode.label} (Port Closed)`
        } as any);
      } else {
        update.addPackets?.push(ICMPHandler.createError(receiverNode, packet, 'Port Unreachable'));
        update.addLogs?.push({
          time: new Date().toLocaleTimeString(),
          ...packet,
          status: 'error',
          info: `UDP Port ${packet.destinationPort} closed. Sending ICMP Port Unreachable.`
        });
      }
      return update;
    }

    // Delegate DHCP to DHCPHandler
    if (isDHCPServer || isDHCPClient) {
      return DHCPHandler.handle(receiverNode, packet);
    }

    // Delegate DNS to DNSHandler
    if (isDNS) {
      const dnsUpdate = DNSHandler.handle(receiverNode, packet);
      return { ...update, ...dnsUpdate };
    }

    if (packet.destinationPort === 7) {
      // Echo Service
      const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP) || receiverNode.interfaces[0];
      update.addPackets?.push({
        from: receiverNode.id,
        to: '',
        senderIP: matchingIface.ip,
        targetIP: packet.senderIP,
        senderMAC: matchingIface.mac,
        targetMAC: '',
        protocol: 'UDP',
        type: 'reply',
        sourcePort: packet.destinationPort,
        destinationPort: packet.sourcePort,
        status: 'pending',
        ttl: 64,
        id: `p_udp_reply_${Date.now()}`,
        progress: 0
      });
      update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `UDP Echo Request received on port ${packet.destinationPort}` });
    } else if (isMDNS) {
      // mDNS Service Discovery Responder
      const queryName = packet.payload?.message?.match(/Who is (.*)\?/)?.[1]?.toLowerCase();
      const myName = receiverNode.label.toLowerCase();

      if (packet.type === 'query') {
        // Respond if the name matches (Allow both servers and PCs to respond)
        if (['server', 'pc'].includes(receiverNode.type) && queryName === myName) {
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `mDNS Query received for "${receiverNode.label}"` });
          const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP) || findEgressInterface(receiverNode, packet.senderIP);
          
          update.addPackets?.push({
            from: receiverNode.id,
            to: '',
            senderIP: matchingIface.ip,
            targetIP: packet.senderIP, // Unicast reply
            senderMAC: matchingIface.mac,
            targetMAC: packet.senderMAC || '',
            protocol: 'mDNS',
            type: 'response',
            sourcePort: 5353,
            destinationPort: 5353,
            payload: { 
              hostname: receiverNode.label,
              ip: matchingIface.ip,
              message: `I am ${receiverNode.label} (${receiverNode.type}) at ${matchingIface.ip}!` 
            },
            status: 'pending',
            ttl: 255,
            originatingInterfaceId: matchingIface.id,
            id: `p_mdns_reply_${Date.now()}`,
            progress: 0
          });
          const replyPacket = update.addPackets![update.addPackets!.length - 1];
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...replyPacket, status: 'sent', info: `mDNS Response sent: I am ${receiverNode.label}` });
        } else {
          // Ignore if name doesn't match or unsupported type
          const isSupportedType = ['server', 'pc'].includes(receiverNode.type);
          const reason = !isSupportedType ? `Unsupported node type (${receiverNode.type})` : `Name mismatch ("${queryName}" vs "${receiverNode.label}")`;
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'dropped', info: `mDNS Query ignored by ${receiverNode.label} (${reason})` } as any);
        }
      } else if (packet.type === 'response') {
        // Client side: Cache the result
        if (packet.payload?.ip && packet.payload?.hostname) {
          const cache = { ...(receiverNode.dnsCache || {}) };
          cache[packet.payload.hostname.toLowerCase()] = packet.payload.ip;
          
          // Force ARP table update as well if in the same subnet (RFC compliant)
          const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP) || receiverNode.interfaces[0];
          const arpTable = { ...(update.nodes![receiverNode.id]?.arpTable || receiverNode.arpTable || {}) };
          
          if (packet.senderIP && packet.senderMAC && isInSameSubnet(packet.senderIP, matchingIface.ip, matchingIface.subnet)) {
            arpTable[packet.senderIP] = packet.senderMAC;
          }

          update.nodes![receiverNode.id] = { 
            ...update.nodes![receiverNode.id],
            dnsCache: cache,
            arpTable: arpTable
          };
          update.addLogs?.push({ 
            time: new Date().toLocaleTimeString(), 
            ...packet, 
            status: 'received', 
            info: `mDNS Response received: ${packet.payload.hostname} is at ${packet.payload.ip}. Cache updated.` 
          });
        }
      }
    } else {
      const msg = packet.payload?.message ? ` - Message: "${packet.payload.message}"` : '';
      update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `UDP Packet received on port ${packet.destinationPort}${msg}` });
    }

    return update;
  }

  static createPacket(
    fromNode: NetNode,
    senderIP: string | null,
    targetIP: string,
    srcPort: number,
    dstPort: number,
    payload: any = null
  ): NetPacket {
    const egressIface = findEgressInterface(fromNode, targetIP);
    return {
      from: fromNode.id,
      to: '',
      senderIP: senderIP || egressIface.ip,
      targetIP,
      senderMAC: egressIface.mac,
      targetMAC: '',
      protocol: 'UDP',
      type: 'request',
      status: 'pending',
      sourcePort: srcPort,
      destinationPort: dstPort,
      payload,
      ttl: 64,
      id: `p_udp_${Date.now()}`,
      progress: 0
    };
  }
}
