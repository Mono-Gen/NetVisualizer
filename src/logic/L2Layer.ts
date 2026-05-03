import type { NetNode, NetPacket } from '../types/network';
import { isMulticastMAC } from './MulticastEngine';
import { IGMPHandler } from './IGMPHandler';

export interface L2ProcessingResult {
  action: 'drop' | 'forward' | 'process' | 'flood';
  forwardPorts?: string[];
  updatedMacTable?: Record<string, string>;
  updatedArpTable?: Record<string, string>;
  updatedIgmpTable?: Record<string, string[]>;
  processAtL3?: boolean;
  log?: {
    status: 'error' | 'sent' | 'dropped';
    info: string;
  };
}

const normalizeMAC = (mac: string): string => {
  if (!mac) return '';
  return mac.replace(/:/g, '').replace(/^0+/g, '').toLowerCase();
};

const compareMAC = (mac1: string, mac2: string): boolean => {
  return normalizeMAC(mac1) === normalizeMAC(mac2);
};

/**
 * Logic for L2 Devices (Hub, Switch) and L2-filtering for L3 devices
 */
export const processL2 = (
  currentNode: NetNode,
  packet: NetPacket
): L2ProcessingResult => {
  const result: L2ProcessingResult = { action: 'process' };
  const ingressPortId = packet.toInterfaceId || '';
  
  // Log arrival at L2
  console.log(`L2 Arrival: ${currentNode.label} (ID: ${currentNode.id}) on port ${ingressPortId}`);

  // 1. MAC Learning (for Switch / L3Switch)
  if (['switch', 'l3switch'].includes(currentNode.type) && packet.senderMAC && ingressPortId) {
    const macTable = { ...(currentNode.macTable || {}) };
    if (!compareMAC(macTable[packet.senderMAC] || '', ingressPortId)) {
      macTable[packet.senderMAC] = ingressPortId;
      result.updatedMacTable = macTable;
    }
  }

  // 2. L2 Filtering for L3 Devices (PC, Router, Server, DNS, DHCP Server)
  if (['pc', 'router', 'server', 'dns', 'dhcp'].includes(currentNode.type)) {
    // DROP if the packet is from ME (prevent loop/reflection processing)
    if (packet.senderMAC && currentNode.interfaces.some(i => compareMAC(i.mac, packet.senderMAC || ''))) {
      return { action: 'drop' };
    }

    const isBroadcast = packet.targetMAC === 'FF:FF:FF:FF:FF:FF';
    const isMulticast = isMulticastMAC(packet.targetMAC);
    
    // Check if the target MAC matches any of the device's interfaces
    const isForMe = isBroadcast || isMulticast || currentNode.interfaces.some(i => compareMAC(i.mac, packet.targetMAC || ''));

    if (!isForMe) {
      return { 
        action: 'drop',
        log: { status: 'dropped', info: `L2 Drop: Target MAC ${packet.targetMAC} does not match any interface of ${currentNode.label}.` }
      };
    }
    return { ...result, action: 'process' };
  }

  // 3. Hub Logic: Simple repeating to all other ports
  if (currentNode.type === 'hub') {
    // A Hub MUST NOT send the packet back to the port it arrived on.
    // If ingressPortId is missing, it will flood to all, which is dangerous.
    const otherPorts = currentNode.interfaces
      .filter(iface => ingressPortId ? iface.id !== ingressPortId : true)
      .map(iface => iface.id);
    
    return { ...result, action: 'forward', forwardPorts: otherPorts };
  }

  // 4. Switch/L3Switch Logic: MAC learning and targeted forwarding
  if (currentNode.type === 'switch' || currentNode.type === 'l3switch') {
    const isBroadcast = packet.targetMAC === 'FF:FF:FF:FF:FF:FF';
    const isMulticast = isMulticastMAC(packet.targetMAC);
    
    // L3Switch intercepts packets targeted to its own MAC
    if (currentNode.type === 'l3switch') {
      const isMyMac = currentNode.interfaces.some(i => compareMAC(i.mac, packet.targetMAC || ''));
      if (isMyMac && !isBroadcast && !isMulticast) {
        return { ...result, action: 'process' };
      }
    }

    // IGMP Snooping Learning
    if (packet.protocol === 'IGMP' && ingressPortId) {
      const igmpResult = IGMPHandler.handleSnooping(currentNode, packet, ingressPortId);
      if (igmpResult.updatedIgmpTable) {
        result.updatedIgmpTable = igmpResult.updatedIgmpTable;
      }
    }

    // IGMP Snooping Check
    if (isMulticast) {
      const egressPortIds = IGMPHandler.getMulticastEgressPorts(currentNode, packet.targetIP, ingressPortId);
      return { ...result, action: 'forward', forwardPorts: egressPortIds };
    }

    const macTable = result.updatedMacTable || currentNode.macTable || {};
    
    // Find entry using fuzzy MAC comparison
    const targetPortId = Object.keys(macTable).find(m => compareMAC(m, packet.targetMAC || '')) 
      ? macTable[Object.keys(macTable).find(m => compareMAC(m, packet.targetMAC || ''))!] 
      : undefined;

    if (isBroadcast || !targetPortId) {
      // Flood to all ports except ingress
      const otherPorts = currentNode.interfaces
        .filter(iface => iface.id !== ingressPortId)
        .map(iface => iface.id);
      
      return { 
        ...result, 
        action: 'flood', 
        forwardPorts: otherPorts,
        processAtL3: currentNode.type === 'l3switch' && isBroadcast 
      };
    } else {
      // Targeted forwarding
      if (targetPortId === ingressPortId) {
        return { action: 'drop', log: { status: 'error', info: 'Switch: Source and Target port are the same' } };
      }
      return { ...result, action: 'forward', forwardPorts: [targetPortId] };
    }
  }

  return result;
};
