import type { NetNode, NetPacket, NetInterface } from '../types/network';
import { isInSameSubnet, isGatewayValid, lookupRoute } from './networkUtils';
import type { ICMPErrorType } from './ICMPHandler';
import { isMulticastMAC } from './MulticastEngine';

export interface L3ProcessingResult {
  action: 'send' | 'forward' | 'reply' | 'drop' | 'none';
  nextHopIP?: string;
  egressInterfaceId?: string;
  error?: string;
  errorType?: ICMPErrorType;
  log?: {
    status: 'error' | 'sent';
    info: string;
  };
}

export const processL3 = (
  currentNode: NetNode,
  packet: NetPacket
): L3ProcessingResult => {
  
  // 1. Check if packet is for me (Any of my interfaces or switch management IP)
  const isSwitchManagementIP = ['switch', 'l3switch'].includes(currentNode.type) && 
    currentNode.managementIP && currentNode.managementIP === packet.targetIP;

  const matchingInterface = isSwitchManagementIP 
    ? { ip: currentNode.managementIP!, subnet: currentNode.managementSubnet || '255.255.255.0', mac: currentNode.interfaces[0]?.mac || '', id: 'mgmt', name: 'Management' }
    : currentNode.interfaces.find(iface => iface.ip === packet.targetIP);
  
  if (matchingInterface) {
    if (packet.protocol === 'ICMP' && packet.type === 'echo-request') {
      return { action: 'reply' };
    }
    if (packet.protocol === 'IGMP') {
      return { action: 'none' }; // Handled by IGMPHandler
    }
    return { action: 'none' };
  }

  // 2. Router / L3Switch Forwarding Logic
  if (['router', 'l3switch'].includes(currentNode.type)) {
    // L2-only protocols (IGMP, ARP) must NEVER be routed
    if (['IGMP', 'ARP'].includes(packet.protocol)) {
      return { action: 'none' }; 
    }

    // Multicast packets (224.x.x.x, 239.x.x.x) - link-local multicast must NOT be routed
    // RFC 4607: 224.0.0.0/24 is link-local multicast, never routed
    if (packet.targetIP.startsWith('224.0.0.') || packet.targetIP.startsWith('239.')) {
      return { action: 'none' }; // Let L2 (IGMP Snooping) handle delivery
    }

    // Limited Broadcast (255.255.255.255) must NEVER be routed
    if (packet.targetIP === '255.255.255.255') {
      return { action: 'none' }; // Process locally if needed, but do not forward
    }

    // TTL Handling: Decrement TTL at each L3 hop
    const currentTTL = packet.ttl !== undefined ? packet.ttl : 64;
    if (currentTTL <= 1) {
      return { 
        action: 'drop', 
        errorType: 'TTL Expired',
        log: { status: 'error', info: `Time Exceeded: TTL=0 when forwarding to ${packet.targetIP}` }
      };
    }

    // 経路の検索は、ホストの出口NIC選択と同じ規則(最長プレフィックス一致 → メトリック → 先頭)を使う
    const route = lookupRoute(currentNode, packet.targetIP);
    if (route) {
      return { action: 'forward', nextHopIP: route.nextHopIP, egressInterfaceId: route.iface.id };
    }
    return {
      action: 'drop',
      errorType: 'Host Unreachable',
      log: { status: 'error', info: `Routing Error: No route to ${packet.targetIP} (Destination Host Unreachable)` }
    };
  }

  // 3. For PC/Server/DHCP-client: accept if targetMAC is broadcast, multicast, or addressed to this node
  // RFC 1122 §3.2.1.3: A host MUST accept all packets addressed to its own unicast MAC.
  const isMyMAC = currentNode.interfaces.some(i => i.mac === packet.targetMAC);
  if (!isMyMAC && packet.targetMAC !== 'FF:FF:FF:FF:FF:FF' && !isMulticastMAC(packet.targetMAC || '')) {
     return { 
       action: 'drop', 
       log: { status: 'dropped', info: `L3 Drop: Packet for ${packet.targetIP} reached host ${currentNode.label} which is not a router.` } as any
     };
  }

  return { action: 'none' };
};

/**
 * Determines the next hop for an outgoing packet from a host
 */
export const determineNextHop = (
  sourceIface: NetInterface,
  targetIP: string
): { nextHopIP: string; error?: string; logInfo?: string } => {
  const isLocal = isInSameSubnet(sourceIface.ip, targetIP, sourceIface.subnet);
  
  if (isLocal) {
    return { nextHopIP: targetIP };
  }

  const gatewayIP = sourceIface.gateway || '';
  if (!gatewayIP) {
    return { nextHopIP: '', error: 'No Gateway', logInfo: 'No Gateway' };
  }

  if (!isGatewayValid(sourceIface.ip, gatewayIP, sourceIface.subnet)) {
    return { nextHopIP: '', error: 'Gateway Unreachable', logInfo: 'Gateway Unreachable' };
  }

  return { nextHopIP: gatewayIP };
};
