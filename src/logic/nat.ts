import type { NetNode, NetPacket, NatEntry } from '../types/network';
import type { NetInterface } from '../types/network';
import { lookupRoute } from './networkUtils';
import { isMulticastIP } from './MulticastEngine';

/**
 * ルーターのNAT(NAPT / IPマスカレード)の純粋関数。
 * 方針: 外側ポートが1つ、それ以外は内側。内側→外側で送信元IPとポート(ICMPは識別子)を書き換え、
 * 変換表に記録する。外側→内側は、表で逆引きして戻す。表に無い外からの通信は、呼び出し側が破棄する。
 */

/** 変換表の最大件数。超えたら古いものから消す */
export const NAT_TABLE_MAX = 64;

/** 外側で割り当てるポート番号の開始。元の番号は保持しない(変わることが見えるように) */
export const NAT_PORT_START = 40000;
const NAT_PORT_END = 65535;

type NatProto = NatEntry['protocol'];

/**
 * パケットを、NATが扱う種別へ寄せる(DNSはUDP)。扱えないものは null。
 * NATが扱うのはユニキャストだけ: マルチキャスト・ブロードキャスト宛ては、書き換えも破棄もしない。
 */
export const natProtocolOf = (p: NetPacket): NatProto | null => {
  if (!p.targetIP || isMulticastIP(p.targetIP) || p.targetIP === '255.255.255.255') return null;
  switch (p.protocol) {
    case 'ICMP': return p.type === 'echo-request' || p.type === 'echo-reply' ? 'ICMP' : null; // エラーの書き換えは対象外
    case 'TCP': return 'TCP';
    case 'UDP': case 'DNS': return 'UDP'; // DHCP/mDNSはブロードキャスト/マルチキャストで、そもそも転送されない
    default: return null;
  }
};

/** NATが働く状態なら、外側ポートを返す(有効で、外側ポートが存在し、IPが設定済み) */
export const natOutsideInterface = (node: NetNode): NetInterface | null => {
  if (!node.nat?.enabled) return null;
  const iface = node.interfaces.find(i => i.id === node.nat!.outsideInterfaceId);
  return iface && iface.ip ? iface : null;
};

const localPortOf = (p: NetPacket, proto: NatProto): number =>
  proto === 'ICMP' ? (p.icmpId ?? 0) : (p.sourcePort ?? 0);
const remotePortOf = (p: NetPacket, proto: NatProto): number =>
  proto === 'ICMP' ? 0 : (p.destinationPort ?? 0);

/** 次に使う外側ポート。同じプロトコルで使用中の番号は避ける */
export const allocatePort = (table: NatEntry[], proto: NatProto): number => {
  const used = new Set(table.filter(e => e.protocol === proto).map(e => e.outsidePort));
  for (let port = NAT_PORT_START; port <= NAT_PORT_END; port++) {
    if (!used.has(port)) return port;
  }
  return NAT_PORT_START; // 64件上限のため、実際には到達しない
};

export interface NatResult {
  packet: NetPacket;
  table: NatEntry[];
  entry: NatEntry;
  /** 今回の通信で、変換表に新しく加わったか */
  created: boolean;
}

/** 内側 → 外側: 送信元を書き換える。NATが働かない/対象外なら null */
export const translateOutbound = (node: NetNode, packet: NetPacket): NatResult | null => {
  const outside = natOutsideInterface(node);
  const proto = natProtocolOf(packet);
  if (!outside || !proto) return null;

  const table = node.natTable || [];
  const insidePort = localPortOf(packet, proto);
  const remotePort = remotePortOf(packet, proto);
  let entry = table.find(e => e.protocol === proto && e.insideIP === packet.senderIP && e.insidePort === insidePort
    && e.remoteIP === packet.targetIP && e.remotePort === remotePort);
  let next = table;
  let created = false;
  if (!entry) {
    entry = {
      protocol: proto, insideIP: packet.senderIP, insidePort,
      outsidePort: allocatePort(table, proto), remoteIP: packet.targetIP, remotePort
    };
    // 新しいものを先頭へ。上限を超えたら、古い(末尾の)ものから消す
    next = [entry, ...table].slice(0, NAT_TABLE_MAX);
    created = true;
  }
  const rewritten: NetPacket = { ...packet, senderIP: outside.ip };
  if (proto === 'ICMP') rewritten.icmpId = entry.outsidePort;
  else rewritten.sourcePort = entry.outsidePort;
  return { packet: rewritten, table: next, entry, created };
};

/** 外側 → 内側: 表で逆引きして、宛先を元へ戻す。表に無ければ null */
export const translateInbound = (node: NetNode, packet: NetPacket): NetPacket | null => {
  const outside = natOutsideInterface(node);
  const proto = natProtocolOf(packet);
  if (!outside || !proto || packet.targetIP !== outside.ip) return null;

  const outsidePort = proto === 'ICMP' ? (packet.icmpId ?? 0) : (packet.destinationPort ?? 0);
  const remotePort = proto === 'ICMP' ? 0 : (packet.sourcePort ?? 0);
  const entry = (node.natTable || []).find(e => e.protocol === proto && e.outsidePort === outsidePort
    && e.remoteIP === packet.senderIP && e.remotePort === remotePort);
  if (!entry) return null;

  const restored: NetPacket = { ...packet, targetIP: entry.insideIP };
  if (proto === 'ICMP') restored.icmpId = entry.insidePort || undefined;
  else restored.destinationPort = entry.insidePort;
  return restored;
};

/**
 * 外側ポートで受けた、変換表に載っていないパケットを、NATが破棄すべきか。
 * 対象は2つ: (1) 外側ポート自身のIPあての、応答ではない通信(ルーター自身へのping要求は除く)、
 * (2) 内側のネットワークへ転送されるはずの通信(外から中へは入れない)。
 * 他のポートのIPなど、ルーター自身あての通信は、ルーターが従来どおり扱う。
 */
export const shouldDropUntranslated = (node: NetNode, packet: NetPacket, ingressInterfaceId: string | undefined): boolean => {
  const outside = natOutsideInterface(node);
  if (!outside || ingressInterfaceId !== outside.id) return false;
  if (!natProtocolOf(packet)) return false;
  if (node.interfaces.some(i => i.ip && i.ip === packet.targetIP)) {
    if (packet.targetIP !== outside.ip) return false;
    return !(packet.protocol === 'ICMP' && packet.type === 'echo-request'); // ルーター自身への ping は応答する
  }
  const route = lookupRoute(node, packet.targetIP);
  return !!route && route.iface.id !== outside.id; // 内側へ向かう通信は入れない(経路が無ければ、通常の到達不能になる)
};

/** 変換表を、削除された機器のIPを内側に持つ分だけ減らす */
export const dropEntriesOfInsideIPs = (table: NatEntry[] | undefined, ips: Set<string>): NatEntry[] =>
  (table || []).filter(e => !ips.has(e.insideIP));
