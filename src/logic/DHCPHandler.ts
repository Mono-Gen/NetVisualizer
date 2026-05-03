import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { findEgressInterface } from './networkUtils';

export class DHCPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };
    
    // DHCP Server: only nodes of type 'dhcp' respond to port 67
    if (receiverNode.type === 'dhcp' && receiverNode.dhcpScope) {
      if (packet.destinationPort === 67) {
        return this.handleServerSide(receiverNode, packet);
      }
    }

    // DHCP Client: only PC-type nodes process DHCP replies (port 68)
    // RFC 2131: DHCP clients are hosts, not routers or servers
    if (packet.destinationPort === 68 && receiverNode.type === 'pc') {
      return this.handleClientSide(receiverNode, packet);
    }

    return update;
  }

  private static handleServerSide(server: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };
    const scope = server.dhcpScope!;
    const leases = { ...scope.leases };
    const mac = packet.senderMAC;

    // 1. Handle DISCOVER -> Send OFFER
    if (packet.payload?.type === 'DHCP_DISCOVER') {
      let offeredIp = leases[mac]?.ip;

      if (!offeredIp) {
        // Find next available IP in scope
        offeredIp = this.findAvailableIP(scope);
      }

      if (!offeredIp) {
        update.addLogs?.push({
          time: new Date().toLocaleTimeString(),
          ...packet,
          status: 'error',
          info: `DHCP Pool Exhausted on ${server.label}. Cannot offer IP.`
        });
        return update;
      }

      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'received',
        info: `DHCP DISCOVER received. Offering ${offeredIp}.`
      });

      const matchingIface = server.interfaces[0];
      const offerPacket: NetPacket = {
        from: server.id,
        to: 'BROADCAST',
        senderIP: matchingIface.ip,
        targetIP: '255.255.255.255',
        senderMAC: matchingIface.mac,
        // RFC 2131: OFFER targets the requesting client's MAC
        targetMAC: mac,
        protocol: 'DHCP',
        type: 'response',
        sourcePort: 67,
        destinationPort: 68,
        payload: {
          type: 'DHCP_OFFER', offeredIp,
          gateway: scope.gateway, dns: scope.dns, subnet: scope.subnet,
          // xid: Echo back the client's Transaction ID for matching
          xid: packet.payload?.xid ?? packet.id
        },
        status: 'pending',
        ttl: 1,
        id: `p_dhcp_offer_${Date.now()}`,
        progress: 0
      };
      update.addPackets?.push(offerPacket);
      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...offerPacket,
        status: 'sent',
        info: `DHCP OFFER sent: ${offeredIp}`
      });
      return update;
    }

    // 2. Handle REQUEST -> Send ACK
    if (packet.payload?.type === 'DHCP_REQUEST') {
      const requestedIp = packet.payload.requestedIp;
      
      // Confirm the IP is still available or belongs to this MAC
      const currentOwner = Object.keys(leases).find(k => leases[k].ip === requestedIp);
      if (currentOwner && currentOwner !== mac) {
        update.addLogs?.push({
          time: new Date().toLocaleTimeString(),
          ...packet,
          status: 'error',
          info: `DHCP Conflict: IP ${requestedIp} already assigned to another host.`
        });
        return update;
      }

      // Update lease
      const expiresAt = Date.now() + (scope.leaseTime * 1000);
      leases[mac] = { ip: requestedIp, expiresAt };
      
      update.nodes![server.id] = { 
        dhcpScope: { ...scope, leases } 
      };

      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'received',
        info: `DHCP REQUEST for ${requestedIp} accepted. Sending ACK.`
      });

      const matchingIface = server.interfaces[0];
      const ackPacket: NetPacket = {
        from: server.id,
        to: 'BROADCAST',
        senderIP: matchingIface.ip,
        targetIP: '255.255.255.255',
        senderMAC: matchingIface.mac,
        // RFC 2131: ACK targets the requesting client's MAC
        targetMAC: mac,
        protocol: 'DHCP',
        type: 'response',
        sourcePort: 67,
        destinationPort: 68,
        payload: {
          type: 'DHCP_ACK', assignedIp: requestedIp,
          gateway: scope.gateway, dns: scope.dns, subnet: scope.subnet, leaseTime: scope.leaseTime,
          // Echo back xid for client matching
          xid: packet.payload?.xid ?? packet.id
        },
        status: 'pending',
        ttl: 1,
        id: `p_dhcp_ack_${Date.now()}`,
        progress: 0
      };
      update.addPackets?.push(ackPacket);
      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...ackPacket,
        status: 'sent',
        info: `DHCP ACK sent: ${requestedIp}`
      });
      return update;
    }

    return update;
  }

  private static handleClientSide(client: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };

    // 3. Receive OFFER -> Send REQUEST (only if this OFFER is for me)
    if (packet.payload?.type === 'DHCP_OFFER') {
      const myMAC = client.interfaces[0].mac;
      // RFC 2131 §4.4.1: Client must ignore OFFERs not addressed to its MAC
      if (packet.targetMAC !== myMAC && packet.targetMAC !== 'FF:FF:FF:FF:FF:FF') {
        return update; // Silently ignore: not for this client
      }

      const offeredIp = packet.payload.offeredIp;
      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'received',
        info: `DHCP OFFER received: ${offeredIp}. Sending REQUEST.`
      });

      const iface = client.interfaces[0];
      const reqPacket: NetPacket = {
        from: client.id,
        to: 'BROADCAST',
        senderIP: '0.0.0.0',
        targetIP: '255.255.255.255',
        senderMAC: iface.mac,
        targetMAC: 'FF:FF:FF:FF:FF:FF',
        protocol: 'DHCP',
        type: 'request',
        sourcePort: 68,
        destinationPort: 67,
        payload: {
          type: 'DHCP_REQUEST', requestedIp: offeredIp,
          xid: packet.payload.xid // Echo back xid
        },
        status: 'pending',
        ttl: 1,
        id: `p_dhcp_req_${Date.now()}`,
        progress: 0
      };
      update.addPackets?.push(reqPacket);
      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...reqPacket,
        status: 'sent',
        info: `DHCP REQUEST sent for ${offeredIp}`
      });
      return update;
    }

    // 4. Receive ACK -> Apply Configuration (only if ACK is addressed to me)
    if (packet.payload?.type === 'DHCP_ACK') {
      const myMAC = client.interfaces[0].mac;
      // RFC 2131 §4.4.1: Client must ignore ACKs not addressed to its MAC
      if (packet.targetMAC !== myMAC && packet.targetMAC !== 'FF:FF:FF:FF:FF:FF') {
        return update; // Silently ignore: not for this client
      }

      const assignedIp = packet.payload.assignedIp;
      const updatedInterfaces = [...client.interfaces];
      updatedInterfaces[0] = {
        ...updatedInterfaces[0],
        ip: assignedIp,
        subnet: packet.payload.subnet,
        gateway: packet.payload.gateway,
        dns: packet.payload.dns
      };

      update.nodes![client.id] = { interfaces: updatedInterfaces };
      update.addLogs?.push({
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'received',
        info: `DHCP ACK received. IP configured: ${assignedIp}`
      });
      return update;
    }

    return update;
  }

  private static findAvailableIP(scope: any): string | null {
    const start = this.ipToLong(scope.startIP);
    const end = this.ipToLong(scope.endIP);
    const assigned = Object.values(scope.leases).map((l: any) => this.ipToLong(l.ip));

    for (let i = start; i <= end; i++) {
      if (!assigned.includes(i)) {
        return this.longToIp(i);
      }
    }
    return null;
  }

  private static ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private static longToIp(long: number): string {
    return [
      (long >>> 24) & 0xff,
      (long >>> 16) & 0xff,
      (long >>> 8) & 0xff,
      long & 0xff
    ].join('.');
  }

  // Periodic cleanup of expired leases
  static cleanupLeases(server: NetNode): EngineUpdate {
    if (!server.dhcpScope) return {};
    const now = Date.now();
    const leases = { ...server.dhcpScope.leases };
    let changed = false;

    for (const mac in leases) {
      if (leases[mac].expiresAt < now) {
        const expiredIp = leases[mac].ip;
        delete leases[mac];
        changed = true;
        // Optionally add a log here if needed
      }
    }

    if (changed) {
      return {
        nodes: {
          [server.id]: {
            dhcpScope: { ...server.dhcpScope, leases }
          }
        }
      };
    }
    return {};
  }
}
