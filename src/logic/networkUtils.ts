/**
 * TCP/IP Network Utilities for strict logic processing
 */

export const ipToLong = (ip: string): number => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

export const longToIp = (long: number): string => {
  return [
    (long >>> 24) & 0xFF,
    (long >>> 16) & 0xFF,
    (long >>> 8) & 0xFF,
    long & 0xFF
  ].join('.');
};

export const isInSameSubnet = (ip1: string, ip2: string, subnet: string): boolean => {
  if (!ip1 || !ip2 || !subnet) return false;
  
  const ipToLong = (ip: string) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  };

  const ip1Long = ipToLong(ip1);
  const ip2Long = ipToLong(ip2);
  const maskLong = ipToLong(subnet);

  return (ip1Long & maskLong) === (ip2Long & maskLong);
};

export const getNetworkAddress = (ip: string, mask: string): string => {
  const i = ipToLong(ip);
  const m = ipToLong(mask);
  return longToIp((i & m) >>> 0);
};

export const getBroadcastAddress = (ip: string, mask: string): string => {
  const i = ipToLong(ip);
  const m = ipToLong(mask);
  return longToIp((i | (~m)) >>> 0);
};

export const generateId = (prefix: string = '') => {
  return `${prefix}${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validates if the gateway is reachable within the subnet
 */
export const isGatewayValid = (interfaceIp: string, gatewayIp: string, mask: string): boolean => {
  if (!gatewayIp) return false;
  // Gateway cannot be the same as the interface itself (usually)
  if (interfaceIp === gatewayIp) return false;
  // Gateway must be in the same subnet
  return isInSameSubnet(interfaceIp, gatewayIp, mask);
};

import type { NetNode, NetInterface } from '../types/network';

/**
 * Finds the correct egress interface for a target IP based on subnet and gateway
 */
export const findEgressInterface = (node: NetNode, targetIP: string): NetInterface => {
  if (!node.interfaces || node.interfaces.length === 0) throw new Error('No interfaces');
  
  // 1. Check if it is in the same subnet as any interface
  const localIface = node.interfaces.find(iface => isInSameSubnet(iface.ip, targetIP, iface.subnet));
  if (localIface) return localIface;

  // 2. Otherwise, check for an interface with a valid gateway
  const gwIface = node.interfaces.find(iface => iface.gateway && isGatewayValid(iface.ip, iface.gateway, iface.subnet));
  return gwIface || node.interfaces[0];
};
