import type { NetNode, NetLink, NetPacket, VlanState } from '../types/network';
import { mapVlanStates } from './vlan';
import { dropEntriesOfInsideIPs } from './nat';

/**
 * 機器・ケーブル・ポートを削除したあとの後片付け(純粋関数)。
 * Why: 消した相手がMAC/ARPテーブルに残ったり、存在しない経路を飛行中のパケットが進んだりすると、
 * 「もういない相手」が表に出て、初心者が混乱する。
 */

/** 1つのVLANの入れ物から、そのポートの記憶(MAC・IGMP・mrouter)を消す */
export const forgetPortInVlanState = (s: VlanState, ifaceId: string): VlanState => {
  const out: VlanState = { ...s };
  if (s.macTable) out.macTable = Object.fromEntries(Object.entries(s.macTable).filter(([, port]) => port !== ifaceId));
  if (s.igmpSnoopingTable) {
    const table: Record<string, string[]> = {};
    Object.entries(s.igmpSnoopingTable).forEach(([group, ports]) => {
      const rest = ports.filter(p => p !== ifaceId);
      if (rest.length > 0) table[group] = rest;
    });
    out.igmpSnoopingTable = table;
  }
  if (s.igmpSnoopingExpires) {
    const expires: Record<string, Record<string, number>> = {};
    Object.entries(s.igmpSnoopingExpires).forEach(([group, ports]) => {
      const rest = Object.fromEntries(Object.entries(ports).filter(([p]) => p !== ifaceId));
      if (Object.keys(rest).length > 0) expires[group] = rest;
    });
    out.igmpSnoopingExpires = expires;
  }
  if (s.mrouterPortId === ifaceId) {
    out.mrouterPortId = undefined;
    out.mrouterPortExpiresAt = undefined;
  }
  return out;
};

/** ポートに結びついた学習状態(MACテーブル・IGMP・mrouter)を忘れる */
export const forgetPortState = (node: NetNode, ifaceId: string): NetNode => {
  const next: NetNode = { ...node };

  // MAC表・スヌーピング表・mrouterは、VLANごとの入れ物に持つ。全VLANから、そのポートの記憶を消す
  next.vlanState = mapVlanStates(node, s => forgetPortInVlanState(s, ifaceId));
  if (next.vlanState === undefined) delete next.vlanState;
  // ケーブルの抜き差し(リンクの切断)では、NATの変換を全て忘れる(再接続後に古い対応が残らないように)
  if (node.natTable && node.natTable.length > 0) next.natTable = [];

  return next;
};

/** 削除された機器のMACを、ARPテーブルとMACテーブルから消す */
export const forgetDevice = (node: NetNode, removed: NetNode): NetNode => {
  const macs = new Set(removed.interfaces.map(i => i.mac.toUpperCase()).filter(Boolean));
  if (macs.size === 0) return node;
  const next: NetNode = { ...node };
  if (node.natTable) next.natTable = dropEntriesOfInsideIPs(node.natTable, new Set(removed.interfaces.map(i => i.ip).filter(Boolean)));
  if (node.arpTable) {
    next.arpTable = Object.fromEntries(Object.entries(node.arpTable).filter(([, mac]) => !macs.has(String(mac).toUpperCase())));
  }
  const vs = mapVlanStates(node, s => s.macTable
    ? { ...s, macTable: Object.fromEntries(Object.entries(s.macTable).filter(([mac]) => !macs.has(mac.toUpperCase()))) }
    : s);
  if (vs) next.vlanState = vs;
  return next;
};

/** 削除されたケーブルの上を飛行中のパケットか */
export const travelsOver = (p: NetPacket, link: NetLink): boolean =>
  (p.from === link.from && p.to === link.to && (!p.fromInterfaceId || p.fromInterfaceId === link.fromInterfaceId)) ||
  (p.from === link.to && p.to === link.from && (!p.fromInterfaceId || p.fromInterfaceId === link.toInterfaceId));

/** ケーブルを1本削除したあとの状態 */
export const pruneAfterLinkRemoved = (
  nodes: NetNode[], packets: NetPacket[], pending: NetPacket[], link: NetLink
): { nodes: NetNode[]; packets: NetPacket[]; pending: NetPacket[] } => ({
  nodes: nodes.map(n =>
    n.id === link.from ? forgetPortState(n, link.fromInterfaceId)
    : n.id === link.to ? forgetPortState(n, link.toInterfaceId)
    : n),
  packets: packets.filter(p => !travelsOver(p, link)),
  pending
});

/** 機器を1台削除したあとの状態(つながっていたケーブルは、呼び出し側で別途取り除く) */
export const pruneAfterNodeRemoved = (
  nodes: NetNode[], packets: NetPacket[], pending: NetPacket[], removed: NetNode, removedLinks: NetLink[]
): { nodes: NetNode[]; packets: NetPacket[]; pending: NetPacket[] } => {
  let rest = nodes.filter(n => n.id !== removed.id).map(n => forgetDevice(n, removed));
  // 相手側のポートに結びついた状態も忘れる
  for (const link of removedLinks) {
    const [otherId, otherIface] = link.from === removed.id ? [link.to, link.toInterfaceId] : [link.from, link.fromInterfaceId];
    rest = rest.map(n => (n.id === otherId ? forgetPortState(n, otherIface) : n));
  }
  return {
    nodes: rest,
    packets: packets.filter(p => p.from !== removed.id && p.to !== removed.id),
    pending: pending.filter(p => p.from !== removed.id && p.to !== removed.id)
  };
};
