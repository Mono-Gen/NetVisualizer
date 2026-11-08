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

/** メトリックの既定値(実OSの自動メトリックに相当する単純化した固定値) */
export const DEFAULT_METRIC = 100;

export const metricOf = (iface: NetInterface): number =>
  typeof iface.metric === 'number' && Number.isFinite(iface.metric) ? iface.metric : DEFAULT_METRIC;

/** サブネットマスクのプレフィックス長(先頭から連続する1の数) */
export const prefixLength = (mask: string): number => {
  const m = ipToLong(mask);
  let n = 0;
  for (let bit = 31; bit >= 0; bit--) {
    if (((m >>> bit) & 1) === 1) n++; else break;
  }
  return n;
};

export interface Route {
  iface: NetInterface;
  kind: 'connected' | 'gateway';
  nextHopIP: string;
  /** 接続済みネットワークのプレフィックス長(ゲートウェイ経由は 0) */
  prefixLen: number;
  metric: number;
}

/**
 * 宛先へ出るときの経路を決める。出口NICの選び方の唯一の定義(SSOT)。
 *
 * 実OSと同じ基本原理の簡略モデル:
 *  1. 宛先を含む接続済みネットワークのうち、プレフィックス長が最も長いNIC
 *  2. 同じ長さなら、メトリックが小さいNIC
 *  3. それも同じなら、一覧の先頭に近いNIC(乱数ではなく、いつも同じ結果になる)
 *  4. 接続済みネットワークに無ければ、有効なデフォルトゲートウェイを持つNICのうち、
 *     メトリックが小さい順、同じなら先頭に近い順
 * 経路が無ければ null。
 * 簡略化している点: ポリシールーティング・ECMP・メトリックの自動計算は扱わない。
 */
export const lookupRoute = (node: NetNode, targetIP: string): Route | null => {
  const usable = node.interfaces
    .map((iface, order) => ({ iface, order }))
    .filter(({ iface }) => !!iface.ip && !!iface.subnet);

  const connected = usable
    .filter(({ iface }) => isInSameSubnet(iface.ip, targetIP, iface.subnet))
    .sort((a, b) =>
      prefixLength(b.iface.subnet) - prefixLength(a.iface.subnet) ||
      metricOf(a.iface) - metricOf(b.iface) ||
      a.order - b.order);
  if (connected.length > 0) {
    const { iface } = connected[0];
    return { iface, kind: 'connected', nextHopIP: targetIP, prefixLen: prefixLength(iface.subnet), metric: metricOf(iface) };
  }

  const viaGateway = usable
    .filter(({ iface }) => !!iface.gateway && isGatewayValid(iface.ip, iface.gateway, iface.subnet))
    .sort((a, b) => metricOf(a.iface) - metricOf(b.iface) || a.order - b.order);
  if (viaGateway.length > 0) {
    const { iface } = viaGateway[0];
    return { iface, kind: 'gateway', nextHopIP: iface.gateway as string, prefixLen: 0, metric: metricOf(iface) };
  }

  return null;
};

/** 宛先に対する出口インターフェース。経路が無ければ先頭のNIC(従来どおりの挙動) */
export const findEgressInterface = (node: NetNode, targetIP: string): NetInterface => {
  if (!node.interfaces || node.interfaces.length === 0) throw new Error('No interfaces');
  return lookupRoute(node, targetIP)?.iface ?? node.interfaces[0];
};

/**
 * 宛先を指定しない通信(マルチキャストの参加・mDNS・DHCPなど)に使う代表NIC。
 * IPを持つNICのうち、メトリックが小さい順、同じなら先頭に近い順。
 */
export const primaryInterface = (node: NetNode): NetInterface => {
  if (!node.interfaces || node.interfaces.length === 0) throw new Error('No interfaces');
  const withIp = node.interfaces.map((iface, order) => ({ iface, order })).filter(({ iface }) => !!iface.ip);
  const pool = withIp.length > 0 ? withIp : node.interfaces.map((iface, order) => ({ iface, order }));
  return pool.sort((a, b) => metricOf(a.iface) - metricOf(b.iface) || a.order - b.order)[0].iface;
};

/** パケットを受信したインターフェース(不明なら先頭) */
export const rxInterface = (node: NetNode, packet: { toInterfaceId?: string }): NetInterface =>
  node.interfaces.find(i => i.id === packet.toInterfaceId) || node.interfaces[0];
