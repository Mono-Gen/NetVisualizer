import type { NetPacket, NetNode, EngineUpdate } from '../../types/network';
import { NetworkEngine } from '../../engine/NetworkEngine';
import { TCPHandler } from '../../logic/TCPHandler';
import { IGMPHandler } from '../../logic/IGMPHandler';
import { DHCPHandler } from '../../logic/DHCPHandler';
import { findEgressInterface } from '../../logic/networkUtils';

export const createPacketSlice = (set: any, get: any) => ({
  packets: [],
  pendingPackets: [],

  sendPacket: (packetData: any) => {
    const { nodes, links } = get();
    const sourceNode = nodes.find((n: NetNode) => n.id === packetData.from);
    if (!sourceNode) return;

    // Loopback interception: If target is self or localhost, do not send over wire
    const isLoopback = packetData.targetIP === '127.0.0.1' || sourceNode.interfaces.some((i: any) => i.ip === packetData.targetIP);
    if (isLoopback) {
      set((state: any) => {
        const newLog = { 
          id: `log_${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          protocol: packetData.protocol || 'System',
          type: 'info',
          status: 'success',
          senderIP: packetData.senderIP,
          targetIP: packetData.targetIP,
          info: `Loopback test successful. ${packetData.protocol || 'Packet'} processed internally.`
        };
        return { packetLogs: [newLog, ...(state.packetLogs || [])].slice(0, 50) };
      });
      return;
    }

    const result = NetworkEngine.prepareTransmission(sourceNode, packetData, nodes, links);
    
    set((state: any) => {
      const updates: any = {};
      if (result.addPackets) updates.packets = [...state.packets, ...result.addPackets];
      if (result.pendingPacketsUpdate?.add) updates.pendingPackets = [...state.pendingPackets, ...result.pendingPacketsUpdate.add];
      if (result.addLogs) {
        // Reverse to ensure the very latest sub-event is at the top
        const newLogs = [...result.addLogs].reverse().map(l => ({ ...l, id: `log_${Math.random()}` }));
        updates.packetLogs = [...newLogs, ...(state.packetLogs || [])].slice(0, 50);
      }
      return updates;
    });
  },

  dnsPendingPings: {} as Record<string, string[]>,

  resolveAndPing: (nodeId: string, input: string) => {
    const { nodes, sendPacket } = get();
    const node = nodes.find((n: NetNode) => n.id === nodeId);
    if (!node) return;

    // Sanitize input: convert full-width to half-width and trim
    const sanitizedInput = input.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();
    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(sanitizedInput);

    if (isIP) {
      const egressIface = findEgressInterface(node, sanitizedInput);
      sendPacket({
        from: nodeId,
        senderIP: egressIface.ip,
        targetIP: sanitizedInput,
        senderMAC: egressIface.mac,
        targetMAC: '',
        protocol: 'ICMP',
        type: 'echo-request',
        status: 'pending'
      });
      return;
    }

    const hostname = sanitizedInput;
    if (node.dnsCache?.[hostname]) {
      const targetIP = node.dnsCache[hostname];
      const egressIface = findEgressInterface(node, targetIP);
      sendPacket({
        from: nodeId,
        senderIP: egressIface.ip,
        targetIP: targetIP,
        senderMAC: egressIface.mac,
        targetMAC: '',
        protocol: 'ICMP',
        type: 'echo-request',
        status: 'pending'
      });
      return;
    }

    // Find the first interface that has a DNS server configured
    const ifaceWithDNS = node.interfaces.find(i => i.dns && i.dns.trim() !== '');
    const dnsServerIP = ifaceWithDNS?.dns;

    if (!dnsServerIP) {
      // Fallback: If no DNS server, try mDNS automatically
      get().sendmDNSQuery(nodeId, hostname);
      return;
    }

    // Add to pending - mapping hostname to this node's ID
    set((state: any) => ({
      dnsPendingPings: {
        ...state.dnsPendingPings,
        [hostname.toLowerCase()]: [...(state.dnsPendingPings[hostname.toLowerCase()] || []), nodeId]
      }
    }));

    const sourceIface = ifaceWithDNS || node.interfaces[0];

    // Send ONLY the DNS Query. Do NOT send ICMP yet.
    sendPacket({
      from: nodeId,
      senderIP: sourceIface.ip,
      targetIP: dnsServerIP,
      senderMAC: sourceIface.mac,
      targetMAC: '',
      protocol: 'DNS',
      type: 'request',
      payload: { hostname: hostname.toLowerCase() },
      status: 'pending',
      ttl: 64,
      originatingInterfaceId: sourceIface.id,
      id: `p_dns_q_${Date.now()}`,
      progress: 0
    } as any);
  },

  handlePacketArrival: (packet: NetPacket) => {
    const { nodes, links, pendingPackets, dnsPendingPings, sendPacket } = get();
    const receiverNode = nodes.find((n: NetNode) => n.id === packet.to);
    if (!receiverNode) return;

    const update = NetworkEngine.handleArrival(receiverNode, packet, nodes, links, pendingPackets);
    get().applyEngineUpdate(update);

    // If this was a DNS response for this node, check pending pings
    // If this was a DNS response, check ALL nodes that were waiting for this hostname
    if (packet.protocol === 'DNS' && packet.type === 'reply' && packet.payload?.ip) {
      const hostname = (packet.payload.hostname || '').toLowerCase();
      const resolvedIP = packet.payload.ip;
      const nodesWaiting = dnsPendingPings[hostname] || [];
      
      nodesWaiting.forEach((waitingNodeId: string) => {
        const waitingNode = nodes.find((n: NetNode) => n.id === waitingNodeId);
        if (waitingNode) {
          // Trigger the ping to the CORRECT resolved IP
          sendPacket({
            from: waitingNodeId,
            senderIP: waitingNode.interfaces[0].ip,
            targetIP: resolvedIP,
            targetMAC: '', 
            senderMAC: waitingNode.interfaces[0].mac,
            protocol: 'ICMP',
            type: 'echo-request',
            status: 'pending'
          });
        }
      });
        
      // Clear pending for this hostname across all nodes
      if (nodesWaiting.length > 0) {
        set((state: any) => ({
          dnsPendingPings: {
            ...state.dnsPendingPings,
            [hostname]: []
          }
        }));
      }
    }
  },

  applyEngineUpdate: (update: EngineUpdate) => {
    set((state: any) => {
      const newState: any = {};
      
      if (update.nodes) {
        newState.nodes = state.nodes.map((n: NetNode) => {
          const nodeUpdate = update.nodes![n.id];
          return nodeUpdate ? { ...n, ...nodeUpdate } : n;
        });
      }

      if (update.addPackets) {
        newState.packets = [...(newState.packets || state.packets), ...update.addPackets];
      }

      if (update.removePacketIds) {
        newState.packets = (newState.packets || state.packets).filter((p: NetPacket) => !update.removePacketIds!.includes(p.id));
      }

      if (update.addLogs) {
        const newLogs = [...update.addLogs].reverse().map(l => ({ ...l, id: `log_${Math.random()}` }));
        newState.packetLogs = [...newLogs, ...(newState.packetLogs || state.packetLogs || [])].slice(0, 50);
      }

      if (update.pendingPacketsUpdate) {
        let newPending = [...state.pendingPackets];
        if (update.pendingPacketsUpdate.clear) newPending = [];
        if (update.pendingPacketsUpdate.removeIds) {
          newPending = newPending.filter(p => !update.pendingPacketsUpdate!.removeIds!.includes(p.id));
        }
        if (update.pendingPacketsUpdate.add) {
          const newAdded = update.pendingPacketsUpdate.add.map(p => ({ ...p, timestamp: p.timestamp || Date.now() }));
          newPending = [...newPending, ...newAdded];
        }
        newState.pendingPackets = newPending;
      }

      return newState;
    });
  },

  removePacket: (id: string) => set((state: any) => ({
    packets: state.packets.filter((p: NetPacket) => p.id !== id)
  })),

  tick: () => {
    const { packets, pendingPackets, handlePacketArrival, nodes } = get();
    const now = Date.now();

    // 1. GC Stale Pending Packets (timeout after 30 seconds)
    if (pendingPackets && pendingPackets.length > 0) {
      const validPending = pendingPackets.filter((p: NetPacket) => !p.timestamp || (now - p.timestamp < 30000));
      if (validPending.length !== pendingPackets.length) {
        set({ pendingPackets: validPending });
      }
    }

    // 2. Packet progress updating
    if (packets.length > 0) {
      const arrivedPackets: NetPacket[] = [];
      const updatedPackets = packets.map((packet: NetPacket) => {
        if (packet.progress >= 1) {
          arrivedPackets.push(packet);
          return null;
        }
        return { ...packet, progress: packet.progress + 0.1 };
      }).filter((p: any) => p !== null);

      set({ packets: updatedPackets });
      arrivedPackets.forEach(p => handlePacketArrival(p));
    }

    // 3. IGMP Snooping & Querier Aging / Processing
    let nodesUpdated = false;
    const updatedNodes = nodes.map((n: NetNode) => {
      let nodeChanged = false;
      let updatedTable = n.igmpSnoopingTable ? { ...n.igmpSnoopingTable } : undefined;
      let updatedExpires = n.igmpSnoopingExpires ? { ...n.igmpSnoopingExpires } : undefined;
      let updatedMrouterId = n.mrouterPortId;
      let updatedMrouterExpires = n.mrouterPortExpiresAt;
      let updatedStandby = n.igmpQuerierStandby;
      
      // mrouter aging
      if (updatedMrouterId && updatedMrouterExpires && now > updatedMrouterExpires) {
        updatedMrouterId = undefined;
        updatedMrouterExpires = undefined;
        nodeChanged = true;
        
        if (n.igmpQuerierEnabled && updatedStandby) {
          updatedStandby = false;
        }
      }
      
      // snooping entries aging
      if (updatedTable && updatedExpires) {
        const newExpires = { ...updatedExpires };
        const newTable = { ...updatedTable };
        let tableChanged = false;

        Object.keys(newExpires).forEach(groupIP => {
          const groupExpires = { ...newExpires[groupIP] };
          let groupChanged = false;
          
          Object.keys(groupExpires).forEach(portId => {
            if (now > groupExpires[portId]) {
              delete groupExpires[portId];
              groupChanged = true;
              nodeChanged = true;
              tableChanged = true;
            }
          });
          
          if (groupChanged) {
            newExpires[groupIP] = groupExpires;
            const activePorts = Object.keys(groupExpires);
            if (activePorts.length === 0) {
              delete newTable[groupIP];
              delete newExpires[groupIP];
            } else {
              newTable[groupIP] = activePorts;
            }
          }
        });

        if (tableChanged) {
          updatedTable = newTable;
          updatedExpires = newExpires;
        }
      }
      
      if (nodeChanged) {
        nodesUpdated = true;
        return {
          ...n,
          igmpSnoopingTable: updatedTable,
          igmpSnoopingExpires: updatedExpires,
          mrouterPortId: updatedMrouterId,
          mrouterPortExpiresAt: updatedMrouterExpires,
          igmpQuerierStandby: updatedStandby
        };
      }
      return n;
    });
   
    if (nodesUpdated) {
      set({ nodes: updatedNodes });
    }

    const currentNodes = nodesUpdated ? updatedNodes : nodes;

    // 4. IGMP Querier Periodic Query Transmission
    currentNodes.forEach((n: NetNode) => {
      if ((n.type === 'switch' || n.type === 'l3switch') && n.igmpQuerierEnabled && !n.igmpQuerierStandby) {
        const intervalMs = (n.igmpQuerierInterval || 60) * 1000;
        const lastTime = (n as any).lastQuerierTime || 0;
        
        if (now - lastTime >= intervalMs) {
          const baseQuery = IGMPHandler.createQuery(n);
          n.interfaces.forEach(iface => {
            const portQuery = {
              ...baseQuery,
              fromInterfaceId: iface.id,
              originatingInterfaceId: iface.id,
              id: `p_igmp_q_${Date.now()}_${iface.id}`
            };
            const transmissionUpdate = NetworkEngine.prepareTransmission(n, portQuery, currentNodes, get().links, true);
            get().applyEngineUpdate(transmissionUpdate);
          });
          
          set((state: any) => ({
            nodes: state.nodes.map((node: NetNode) => 
              node.id === n.id ? { ...node, lastQuerierTime: now } as any : node
            )
          }));
        }
      }
    });

    // 5. Cleanup expired DHCP leases for all DHCP nodes
    currentNodes.filter((n: NetNode) => n.type === 'dhcp').forEach((n: NetNode) => {
      const update = DHCPHandler.cleanupLeases(n);
      if (update.nodes) get().applyEngineUpdate(update);
    });
  },

  startTCPHandshake: (fromId: string, toIP: string, port: number) => {
    const { nodes } = get();
    const fromNode = nodes.find((n: NetNode) => n.id === fromId);
    if (!fromNode) return;

    if (isNaN(port) || !toIP) {
      get().applyEngineUpdate({
        addLogs: [{ time: new Date().toLocaleTimeString(), protocol: 'TCP', type: 'error', status: 'error', info: `Invalid IP or Port. Please check input.` } as any]
      });
      return;
    }

    const { packet, updatedConnections } = TCPHandler.initiateConnection(fromNode, toIP, port, Math.floor(1024 + Math.random() * 60000));
    get().updateNode(fromId, { tcpConnections: updatedConnections });
    get().sendPacket(packet);
  },
  
  sendIGMPQuery: (nodeId: string) => {
    const node = get().nodes.find((n: NetNode) => n.id === nodeId);
    if (!node) return;
    const packet = IGMPHandler.createQuery(node);
    get().sendPacket(packet);
  },

  joinMulticastGroup: (nodeId: string, groupIP: string) => {
    const { nodes } = get();
    const node = nodes.find((n: NetNode) => n.id === nodeId);
    if (!node || (node.joinedGroups || []).includes(groupIP)) return;

    const updatedNodes = nodes.map((n: NetNode) => 
      n.id === nodeId ? { ...n, joinedGroups: [...(n.joinedGroups || []), groupIP] } : n
    );
    set({ nodes: updatedNodes });

    // Send IGMP Report
    const iface = node.interfaces[0];
    const packet = {
      from: nodeId,
      to: '',
      senderIP: iface.ip,
      targetIP: groupIP,
      senderMAC: iface.mac,
      targetMAC: '01:00:5E:00:00:FB', // Generalized for pedagogical use
      protocol: 'IGMP',
      type: 'membership-report',
      payload: { group: groupIP },
      status: 'pending',
      ttl: 1,
      id: `p_igmp_join_${Date.now()}`,
      progress: 0
    };
    get().applyEngineUpdate({ addLogs: [{ time: new Date().toLocaleTimeString(), ...packet, status: 'sent', info: `Joining Multicast Group ${groupIP}` }] });
    get().sendPacket(packet);
  },

  leaveMulticastGroup: (nodeId: string, groupIP: string) => {
    const { nodes } = get();
    const node = nodes.find((n: NetNode) => n.id === nodeId);
    if (!node) return;

    const updatedNodes = nodes.map((n: NetNode) => 
      n.id === nodeId ? { ...n, joinedGroups: (n.joinedGroups || []).filter(g => g !== groupIP) } : n
    );
    set({ nodes: updatedNodes });

    // Send IGMP Leave (pedagogical)
    const iface = node.interfaces[0];
    const packet = {
      from: nodeId,
      to: '',
      senderIP: iface.ip,
      targetIP: '224.0.0.2', // All Routers
      senderMAC: iface.mac,
      targetMAC: '01:00:5E:00:00:02',
      protocol: 'IGMP',
      type: 'leave-group',
      payload: { group: groupIP },
      status: 'pending',
      ttl: 1,
      id: `p_igmp_leave_${Date.now()}`,
      progress: 0
    };
    get().applyEngineUpdate({ addLogs: [{ time: new Date().toLocaleTimeString(), ...packet, status: 'sent', info: `Leaving Multicast Group ${groupIP}` }] });
    get().sendPacket(packet);
  },

  sendUDPMessage: (fromId: string, toIP: string, port: number, message: string) => {
    const { nodes } = get();
    const fromNode = nodes.find((n: NetNode) => n.id === fromId);
    if (!fromNode) return;
    
    if (isNaN(port) || !toIP) {
       get().applyEngineUpdate({
         addLogs: [{ time: new Date().toLocaleTimeString(), protocol: 'UDP', type: 'error', status: 'error', info: `Invalid IP or Port.` } as any]
       });
       return;
    }


    // Simple ephemeral port for source
    const srcPort = Math.floor(1024 + Math.random() * 60000);
    const egressIface = findEgressInterface(fromNode, toIP);
    const packet = {
      from: fromNode.id,
      to: '',
      senderIP: egressIface.ip,
      targetIP: toIP,
      senderMAC: egressIface.mac,
      targetMAC: '',
      protocol: 'UDP',
      type: 'request',
      status: 'pending',
      sourcePort: srcPort,
      destinationPort: port,
      payload: { message },
      ttl: 64,
      id: `p_udp_msg_${Date.now()}`,
      progress: 0
    };
    get().sendPacket(packet);
  },

  requestDHCP: (fromId: string) => {
    const { nodes } = get();
    const fromNode = nodes.find((n: NetNode) => n.id === fromId);
    if (!fromNode) return;
    
    // Use the first interface that lacks an IP or starts with 169.254 as the requesting interface
    const iface = fromNode.interfaces.find(i => i.ip === '' || i.ip.startsWith('169.254.')) || fromNode.interfaces[0];

    // DHCP Discover: Source IP 0.0.0.0, Dest IP 255.255.255.255
    // Source Port 68, Dest Port 67
    const packet = {
      from: fromNode.id,
      to: 'BROADCAST',
      senderIP: '0.0.0.0',
      targetIP: '255.255.255.255',
      senderMAC: iface.mac,
      targetMAC: 'FF:FF:FF:FF:FF:FF',
      protocol: 'DHCP',
      type: 'discover',
      status: 'pending',
      sourcePort: 68,
      destinationPort: 67,
      payload: { 
        type: 'DHCP_DISCOVER',
        xid: `xid_${Math.random().toString(36).substr(2, 9)}` // Generate unique transaction ID
      },
      ttl: 1,
      originatingInterfaceId: iface.id,
      id: `p_dhcp_disc_${Date.now()}`,
      progress: 0
    };
    
    // Add specific sent log for DHCP start
    get().applyEngineUpdate({
      addLogs: [{
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'sent',
        info: 'DHCP DISCOVER sent: Searching for DHCP Server...'
      }]
    });

    get().sendPacket(packet);
  },

  sendmDNSQuery: (fromId: string, hostname: string = 'Web Server') => {
    const { nodes } = get();
    const fromNode = nodes.find((n: any) => n.id === fromId);
    if (!fromNode) return;
    
    // Check if joined mDNS group
    const mDNSGroup = '224.0.0.251';
    if (!fromNode.joinedGroups?.includes(mDNSGroup)) {
      get().applyEngineUpdate({ 
        addLogs: [{ 
          time: new Date().toLocaleTimeString(), 
          protocol: 'mDNS', 
          type: 'error', 
          status: 'error', 
          info: `mDNS discovery failed: Device must join Multicast Group ${mDNSGroup} first!` 
        }] 
      });
      return;
    }

    get().applyEngineUpdate({ 
      addLogs: [{ 
        time: new Date().toLocaleTimeString(), 
        protocol: 'mDNS', 
        type: 'info', 
        status: 'sent', 
        info: `Initiating mDNS discovery for "${hostname}"...` 
      }] 
    });

    const iface = fromNode.interfaces[0];
    const packet = {
      from: fromNode.id,
      to: 'BROADCAST',
      senderIP: iface.ip,
      targetIP: '224.0.0.251',
      senderMAC: iface.mac,
      targetMAC: '01:00:5E:00:00:FB', // Multicast MAC for 224.0.0.251
      protocol: 'mDNS',
      type: 'query',
      status: 'pending',
      sourcePort: 5353,
      destinationPort: 5353,
      payload: { message: `Who is ${hostname}?` },
      ttl: 255,
      originatingInterfaceId: iface.id,
      id: `p_mdns_q_${Date.now()}`,
      progress: 0
    };
    
    get().applyEngineUpdate({
      addLogs: [{
        time: new Date().toLocaleTimeString(),
        ...packet,
        status: 'sent',
        info: `mDNS Query sent: Searching for "${hostname}"...`
      }]
    });
    get().sendPacket(packet);
  },

  sendTCPData: (fromId: string, toIP: string, port: number, message: string) => {
    const { nodes } = get();
    const fromNode = nodes.find((n: NetNode) => n.id === fromId);
    if (!fromNode) return;
    
    const result = TCPHandler.createDataPacket(fromNode, toIP, port, message);
    if (result && result.packet) {
      get().updateNode(fromId, { tcpConnections: result.updatedConnections });
      get().sendPacket(result.packet);
    } else if (result && result.error) {
      get().applyEngineUpdate({
        addLogs: [{
          time: new Date().toLocaleTimeString(),
          protocol: 'TCP',
          type: 'error',
          status: 'error',
          senderIP: fromNode.interfaces[0]?.ip || 'Unknown',
          targetIP: toIP,
          info: result.error
        } as any]
      });
    }
  },

  closeTCPConnection: (fromId: string, toIP: string, port: number) => {
    const { nodes } = get();
    const fromNode = nodes.find((n: NetNode) => n.id === fromId);
    if (!fromNode) return;
    
    const result = TCPHandler.createFinPacket(fromNode, toIP, port);
    if (result) {
      get().updateNode(fromId, { tcpConnections: result.updatedConnections });
      get().sendPacket(result.packet);
    }
  },

  clearTCPSocket: (nodeId: string, remoteIP: string, remotePort: number) => {
    const { nodes } = get();
    const node = nodes.find((n: NetNode) => n.id === nodeId);
    if (!node || !node.tcpConnections) return;
    
    const connKey = `${remoteIP}:${remotePort}`;
    const updatedConnections = { ...node.tcpConnections };
    delete updatedConnections[connKey];
    
    get().updateNode(nodeId, { tcpConnections: updatedConnections });
  },
});
