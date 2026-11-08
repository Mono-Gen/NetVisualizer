import type { NetNode, NetLink } from '../types/network';
import { msg } from '../i18n/msg';
import type { Msg } from '../i18n/translate';

/**
 * ポートの配置・当たり判定・接続検証(純粋関数)。
 * Why: ポート位置はノード描画・リンク描画・パケット描画・ドラッグ接続の全てが参照するため、
 * 計算をここ1箇所に集約する(SSOT)。
 */

export const NODE_BODY = 64;       // ノード本体(アイコン)の一辺
export const PORT_SIZE = 16;       // ポート円の直径
export const PORT_SPACING = 20;    // ポート中心間の距離
export const PORTS_PER_ROW = 8;    // 1行あたりの最大ポート数(超えたら折り返す)

export interface Point { x: number; y: number }

/** ポートを何行で並べるか */
export const getPortRows = (portCount: number): number =>
  Math.max(1, Math.ceil(portCount / PORTS_PER_ROW));

/** 2行目以降と円のはみ出しによって、ラベルを下へ送る量(px) */
export const getPortStripExtra = (portCount: number): number =>
  PORT_SIZE / 2 + (getPortRows(portCount) - 1) * PORT_SPACING;

/** ポート円の中心座標(キャンバス座標)。ポートは本体の下辺をまたぐように並ぶ */
export const getPortCenter = (node: NetNode, index: number): Point => {
  const total = node.interfaces.length;
  const row = Math.floor(index / PORTS_PER_ROW);
  const col = index % PORTS_PER_ROW;
  const inRow = Math.min(PORTS_PER_ROW, total - row * PORTS_PER_ROW);
  return {
    x: node.x + NODE_BODY / 2 + (col - (inRow - 1) / 2) * PORT_SPACING,
    y: node.y + NODE_BODY + row * PORT_SPACING
  };
};

/** インターフェースIDからポート座標を引く。見つからなければノード中心 */
export const getPortPosition = (node: NetNode, ifaceId?: string): Point => {
  const index = ifaceId ? node.interfaces.findIndex(i => i.id === ifaceId) : -1;
  if (index < 0) return { x: node.x + NODE_BODY / 2, y: node.y + NODE_BODY / 2 };
  return getPortCenter(node, index);
};

export interface PortRef { nodeId: string; ifaceId: string }

/** ポートが既にリンクで使われているか */
export const isPortUsed = (links: NetLink[], nodeId: string, ifaceId: string): boolean =>
  links.some(l => (l.from === nodeId && l.fromInterfaceId === ifaceId) || (l.to === nodeId && l.toInterfaceId === ifaceId));

/** 指定座標に最も近いポート(半径 radius 以内)。ドロップ位置の許容に使う */
export const findNearestPort = (nodes: NetNode[], point: Point, radius: number): PortRef | null => {
  let best: { ref: PortRef; dist: number } | null = null;
  for (const node of nodes) {
    node.interfaces.forEach((iface, index) => {
      const c = getPortCenter(node, index);
      const dist = Math.hypot(c.x - point.x, c.y - point.y);
      if (dist <= radius && (!best || dist < best.dist)) best = { ref: { nodeId: node.id, ifaceId: iface.id }, dist };
    });
  }
  return best ? (best as { ref: PortRef }).ref : null;
};

export type ConnectionCheck = { ok: true } | { ok: false; reason: Msg };

/** 接続の可否。理由は初心者向けに「何が/どうすれば」を含める */
export const validateConnection = (nodes: NetNode[], links: NetLink[], a: PortRef, b: PortRef): ConnectionCheck => {
  const find = (r: PortRef) => {
    const node = nodes.find(n => n.id === r.nodeId);
    const iface = node?.interfaces.find(i => i.id === r.ifaceId);
    return node && iface ? { node, iface } : null;
  };
  const pa = find(a), pb = find(b);
  if (!pa || !pb) return { ok: false, reason: msg('conn.missing') };
  if (a.nodeId === b.nodeId) return { ok: false, reason: msg('conn.self', { node: pa.node.label }) };
  if (isPortUsed(links, a.nodeId, a.ifaceId)) return { ok: false, reason: msg('conn.sourceUsed', { node: pa.node.label, port: pa.iface.name }) };
  if (isPortUsed(links, b.nodeId, b.ifaceId)) return { ok: false, reason: msg('conn.targetUsed', { node: pb.node.label, port: pb.iface.name }) };
  return { ok: true };
};
