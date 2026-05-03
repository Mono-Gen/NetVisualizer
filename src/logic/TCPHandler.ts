import type { NetNode, NetPacket, EngineUpdate } from '../types/network';
import { findEgressInterface } from './networkUtils';

export class TCPHandler {
  
  static handle(receiverNode: NetNode, packet: NetPacket): EngineUpdate {
    const update: EngineUpdate = { nodes: {}, addPackets: [], addLogs: [] };
    const connections = { ...(receiverNode.tcpConnections || {}) };
    const connKey = `${packet.senderIP.trim()}:${packet.sourcePort}`;
    const conn = connections[connKey];
    
    // Find matching interface for our senderMAC
    const matchingIface = receiverNode.interfaces.find(i => i.ip === packet.targetIP.trim());

    // Port check for SYN (New connection request)
    const isSynOnly = packet.flags?.syn && !packet.flags?.ack;
    const isPortOpen = receiverNode.listeningPorts?.some(p => p.port === packet.destinationPort && p.protocol === 'TCP');
    
    if (isSynOnly && !isPortOpen) {
      update.addPackets?.push(this.createReset(receiverNode, packet));
      update.addLogs?.push({ 
        time: new Date().toLocaleTimeString(), 
        ...packet, 
        status: 'error', 
        info: `TCP RST: Port ${packet.destinationPort} closed on ${receiverNode.label}` 
      });
      return update;
    }

    // 0. Handle RST (Reset)
    if (packet.flags?.rst) {
      if (conn) {
        delete connections[connKey];
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        update.addLogs?.push({
          time: new Date().toLocaleTimeString(),
          ...packet,
          status: 'error',
          info: `TCP Connection Reset by peer (${packet.senderIP}). Socket closed.`
        });
      }
      return update;
    }

    // 1. Handle SYN (Handshake Step 1)
    if (packet.flags?.syn && !packet.flags?.ack) {
      const newSeq = Math.floor(Math.random() * 1000);
      connections[connKey] = {
        state: 'SYN_RECEIVED',
        localPort: packet.destinationPort || 0,
        remoteIP: packet.senderIP,
        remotePort: packet.sourcePort || 0,
        seq: newSeq,
        ack: (packet.seq || 0) + 1
      };
      update.nodes![receiverNode.id] = { tcpConnections: connections };
      update.addPackets?.push({
        from: receiverNode.id,
        to: '',
        senderIP: packet.targetIP.trim(),
        targetIP: packet.senderIP.trim(),
        senderMAC: matchingIface?.mac || '',
        targetMAC: '',
        protocol: 'TCP',
        type: 'reply',
        sourcePort: packet.destinationPort,
        destinationPort: packet.sourcePort,
        seq: newSeq,
        ackNum: (packet.seq || 0) + 1,
        flags: { syn: true, ack: true, fin: false },
        status: 'pending',
        ttl: 64,
        id: `p_tcp_synack_${Date.now()}`,
        progress: 0
      });
      update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP SYN Received. Sending SYN-ACK.` });
      return update;
    }

    // 2. Handle SYN-ACK (Handshake Step 2)
    if (packet.flags?.syn && packet.flags?.ack) {
      const pendingConnKey = `${packet.senderIP.trim()}:${packet.sourcePort}`;
      const pendingConn = connections[pendingConnKey];
      if (pendingConn && pendingConn.state === 'SYN_SENT') {
        connections[pendingConnKey] = {
          ...pendingConn,
          state: 'ESTABLISHED',
          seq: packet.ackNum || 0,
          ack: (packet.seq || 0) + 1
        };
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        update.addPackets?.push({
          from: receiverNode.id,
          to: '',
          senderIP: packet.targetIP.trim(),
          targetIP: packet.senderIP.trim(),
          senderMAC: matchingIface?.mac || '',
          targetMAC: packet.senderMAC,
          protocol: 'TCP',
          type: 'reply',
          sourcePort: pendingConn.localPort,
          destinationPort: packet.sourcePort,
          seq: packet.ackNum,
          ackNum: (packet.seq || 0) + 1,
          flags: { syn: false, ack: true, fin: false },
          status: 'pending',
          ttl: 64,
          id: `p_tcp_ack_${Date.now()}`,
          progress: 0
        });
        update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP SYN-ACK Received. Connection ESTABLISHED.` });
        return update;
      }
    }

    // 3. Handle ACK (Handshake Step 3 or Data ACK)
    if (!packet.flags?.syn && packet.flags?.ack && !packet.flags?.fin) {
      if (conn && conn.state === 'SYN_RECEIVED') {
        connections[connKey] = { ...conn, state: 'ESTABLISHED' };
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP ACK Received. Connection ESTABLISHED.` });
        return update;
      }
      
      // If it has payload (PSH), we must ACK it
      if (packet.payload?.message && conn && conn.state === 'ESTABLISHED') {
        connections[connKey] = { ...conn, ack: (packet.seq || 0) + 1 };
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        
        // Generate ACK for the data
        update.addPackets?.push({
          from: receiverNode.id,
          to: '',
          senderIP: packet.targetIP.trim(),
          targetIP: packet.senderIP.trim(),
          senderMAC: matchingIface?.mac || '',
          targetMAC: packet.senderMAC,
          protocol: 'TCP',
          type: 'reply',
          sourcePort: packet.destinationPort,
          destinationPort: packet.sourcePort,
          seq: conn.seq,
          ackNum: (packet.seq || 0) + 1,
          flags: { syn: false, ack: true, fin: false },
          status: 'pending',
          ttl: 64,
          id: `p_tcp_data_ack_${Date.now()}`,
          progress: 0
        });
        update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP Data Received: "${packet.payload.message}". Sending ACK.` });
        return update;
      }
      
      // If it's just an ACK for our FIN
      if (conn && conn.state === 'FIN_WAIT_1') {
        connections[connKey] = { ...conn, state: 'FIN_WAIT_2' };
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        return update;
      }
      if (conn && conn.state === 'LAST_ACK') {
        delete connections[connKey]; // Close connection
        update.nodes![receiverNode.id] = { tcpConnections: connections };
        update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP Connection CLOSED.` });
        return update;
      }
    }

    // 4. Handle FIN (Disconnect Request)
    if (packet.flags?.fin) {
      if (conn) {
        if (conn.state === 'ESTABLISHED' || conn.state === 'FIN_WAIT_2') {
          // Send FIN-ACK
          connections[connKey] = { ...conn, state: 'LAST_ACK', ack: (packet.seq || 0) + 1 };
          update.nodes![receiverNode.id] = { tcpConnections: connections };
          update.addPackets?.push({
            from: receiverNode.id,
            to: '',
            senderIP: packet.targetIP.trim(),
            targetIP: packet.senderIP.trim(),
            senderMAC: matchingIface?.mac || '',
            targetMAC: '',
            protocol: 'TCP',
            type: 'reply',
            sourcePort: packet.destinationPort,
            destinationPort: packet.sourcePort,
            seq: conn.seq,
            ackNum: (packet.seq || 0) + 1,
            flags: { syn: false, ack: true, fin: true },
            status: 'pending',
            ttl: 64,
            id: `p_tcp_finack_${Date.now()}`,
            progress: 0
          });
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP FIN Received. Sending FIN-ACK.` });
          return update;
        } else if (conn.state === 'FIN_WAIT_1') {
          // Received FIN-ACK from server while waiting for ACK
          delete connections[connKey]; // Close connection
          update.nodes![receiverNode.id] = { tcpConnections: connections };
          update.addPackets?.push({
            from: receiverNode.id,
            to: '',
            senderIP: packet.targetIP.trim(),
            targetIP: packet.senderIP.trim(),
            senderMAC: matchingIface?.mac || '',
            targetMAC: '',
            protocol: 'TCP',
            type: 'reply',
            sourcePort: packet.destinationPort,
            destinationPort: packet.sourcePort,
            seq: conn.seq,
            ackNum: (packet.seq || 0) + 1,
            flags: { syn: false, ack: true, fin: false },
            status: 'pending',
            ttl: 64,
            id: `p_tcp_final_ack_${Date.now()}`,
            progress: 0
          });
          update.addLogs?.push({ time: new Date().toLocaleTimeString(), ...packet, status: 'received', info: `TCP FIN-ACK Received. Sending final ACK and closing socket.` });
          return update;
        }
      }
    }

    return update;
  }

  static createReset(receiverNode: NetNode, incomingPacket: NetPacket): NetPacket {
    return {
      from: receiverNode.id,
      to: '',
      senderIP: incomingPacket.targetIP,
      targetIP: incomingPacket.senderIP,
      targetMAC: '',
      protocol: 'TCP',
      type: 'reply',
      sourcePort: incomingPacket.destinationPort,
      destinationPort: incomingPacket.sourcePort,
      seq: 0,
      ackNum: (incomingPacket.seq || 0) + 1,
      flags: { syn: false, ack: true, rst: true, fin: false },
      status: 'error',
      ttl: 64,
      id: `p_tcp_rst_${Date.now()}`,
      progress: 0
    };
  }

  static initiateConnection(fromNode: NetNode, targetIP: string, targetPort: number, localPort: number): { packet: NetPacket, updatedConnections: any } {
    const connections = { ...(fromNode.tcpConnections || {}) };
    const connKey = `${targetIP.trim()}:${targetPort}`;
    const seq = Math.floor(Math.random() * 1000);
    const egressIface = findEgressInterface(fromNode, targetIP.trim());
    connections[connKey] = { state: 'SYN_SENT', localPort, remoteIP: targetIP.trim(), remotePort: targetPort, seq, ack: 0 };
    const packet: NetPacket = {
      from: fromNode.id,
      to: '',
      senderIP: egressIface.ip,
      targetIP: targetIP.trim(),
      senderMAC: egressIface.mac,
      targetMAC: '',
      protocol: 'TCP',
      type: 'request',
      sourcePort: localPort,
      destinationPort: targetPort,
      seq,
      flags: { syn: true, ack: false, fin: false },
      status: 'pending',
      ttl: 64,
      id: `p_tcp_syn_${Date.now()}`,
      progress: 0
    };
    return { packet, updatedConnections: connections };
  }

  static createDataPacket(fromNode: NetNode, targetIP: string, targetPort: number, message: string): { packet: NetPacket, updatedConnections: any } | null {
    const connections = { ...(fromNode.tcpConnections || {}) };
    const connKey = `${targetIP.trim()}:${targetPort}`;
    const conn = connections[connKey];
    
    if (!conn) {
      return { packet: null as any, updatedConnections: connections, error: `No active TCP socket found for ${targetIP.trim()}:${targetPort}. Please click 'TCP Connect' first.` };
    }
    if (conn.state !== 'ESTABLISHED') {
      return { packet: null as any, updatedConnections: connections, error: `TCP socket for ${targetIP.trim()}:${targetPort} is not ESTABLISHED (Current state: ${conn.state}).` };
    }

    const newSeq = conn.seq;
    connections[connKey] = { ...conn, seq: newSeq + 1 }; // Simple sequence increment
    const egressIface = findEgressInterface(fromNode, targetIP.trim());

    const packet: NetPacket = {
      from: fromNode.id,
      to: '',
      senderIP: egressIface.ip,
      targetIP: targetIP.trim(),
      senderMAC: egressIface.mac,
      targetMAC: '',
      protocol: 'TCP',
      type: 'request',
      sourcePort: conn.localPort,
      destinationPort: targetPort,
      seq: newSeq,
      ackNum: conn.ack,
      flags: { syn: false, ack: true, psh: true, fin: false },
      payload: { message },
      status: 'pending',
      ttl: 64,
      id: `p_tcp_data_${Date.now()}`,
      progress: 0
    };
    return { packet, updatedConnections: connections };
  }

  static createFinPacket(fromNode: NetNode, targetIP: string, targetPort: number): { packet: NetPacket, updatedConnections: any } | null {
    const connections = { ...(fromNode.tcpConnections || {}) };
    const connKey = `${targetIP.trim()}:${targetPort}`;
    const conn = connections[connKey];
    
    if (!conn || conn.state !== 'ESTABLISHED') return null;

    connections[connKey] = { ...conn, state: 'FIN_WAIT_1' };
    const egressIface = findEgressInterface(fromNode, targetIP.trim());

    const packet: NetPacket = {
      from: fromNode.id,
      to: '',
      senderIP: egressIface.ip,
      targetIP: targetIP.trim(),
      senderMAC: egressIface.mac,
      targetMAC: '',
      protocol: 'TCP',
      type: 'request',
      sourcePort: conn.localPort,
      destinationPort: targetPort,
      seq: conn.seq,
      ackNum: conn.ack,
      flags: { syn: false, ack: true, fin: true },
      status: 'pending',
      ttl: 64,
      id: `p_tcp_fin_${Date.now()}`,
      progress: 0
    };
    return { packet, updatedConnections: connections };
  }
}
