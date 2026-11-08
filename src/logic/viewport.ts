import type { NetNode } from '../types/network';
import { NODE_BODY, PORT_SPACING, PORTS_PER_ROW, getPortRows } from './portLayout';

/**
 * 表示範囲(パンと拡大縮小)の計算。すべて純粋関数。
 * 変換式: 画面座標 = キャンバス座標 × zoom + (x, y)   (x, y は画面上の平行移動量)
 * キャンバス座標を画面座標に直す箇所は多い(ドロップ位置・配線・メニュー)ので、ここ1か所に集約する。
 */

export interface View { x: number; y: number; zoom: number }
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
/** 「全体を表示」で拡大しすぎない上限(機器が少ないときに巨大化しない) */
export const FIT_MAX_ZOOM = 1.5;
export const DEFAULT_VIEW: View = { x: 0, y: 0, zoom: 1 };

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** コンテナ内の画面座標 → キャンバス座標 */
export const screenToCanvas = (view: View, p: Point): Point => ({
  x: (p.x - view.x) / view.zoom,
  y: (p.y - view.y) / view.zoom
});

/** キャンバス座標 → コンテナ内の画面座標 */
export const canvasToScreen = (view: View, p: Point): Point => ({
  x: p.x * view.zoom + view.x,
  y: p.y * view.zoom + view.y
});

/** 画面を (dx, dy) だけ動かす */
export const panBy = (view: View, dx: number, dy: number): View => ({ ...view, x: view.x + dx, y: view.y + dy });

/**
 * anchor(コンテナ内の画面座標)の下にあるキャンバス上の点が、拡大縮小の前後で動かないようにする。
 * Why: カーソル(または画面中央)を中心に拡大縮小できるようにするため。
 */
export const zoomAt = (view: View, newZoom: number, anchor: Point): View => {
  const zoom = clampZoom(newZoom);
  const ratio = zoom / view.zoom;
  return { zoom, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
};

/** 1つの機器が画面上で占める範囲(キャンバス座標)。ポート・ラベル・IP表示まで含めた目安 */
const nodeExtent = (node: NetNode) => {
  const portsWide = Math.min(PORTS_PER_ROW, node.interfaces.length) * PORT_SPACING;
  const halfWidth = Math.max(NODE_BODY, portsWide, 110) / 2;
  const cx = node.x + NODE_BODY / 2;
  // 下側: ポート行 + 機器名 + IP/MACの表示(複数NICなら増える)
  const below = 70 + (getPortRows(node.interfaces.length) - 1) * PORT_SPACING + node.interfaces.length * 30;
  return { left: cx - halfWidth, right: cx + halfWidth, top: node.y - 8, bottom: node.y + NODE_BODY + below };
};

/**
 * 全ての機器がコンテナに収まる表示にする。機器が無ければ初期表示。
 * zoom は MIN_ZOOM〜FIT_MAX_ZOOM に収め、機器群を中央に置く。
 */
export const fitView = (nodes: NetNode[], container: Size, margin = 40): View => {
  if (nodes.length === 0 || container.width <= 0 || container.height <= 0) return DEFAULT_VIEW;
  const ext = nodes.map(nodeExtent);
  const left = Math.min(...ext.map(e => e.left));
  const right = Math.max(...ext.map(e => e.right));
  const top = Math.min(...ext.map(e => e.top));
  const bottom = Math.max(...ext.map(e => e.bottom));
  const w = right - left, h = bottom - top;
  const zoom = Math.min(
    FIT_MAX_ZOOM,
    Math.max(MIN_ZOOM, Math.min((container.width - 2 * margin) / w, (container.height - 2 * margin) / h))
  );
  return {
    zoom,
    x: (container.width - w * zoom) / 2 - left * zoom,
    y: (container.height - h * zoom) / 2 - top * zoom
  };
};

/** ホイールの量を画面のpxに換算する(行単位・ページ単位のデバイスにも対応) */
export const wheelDeltaPx = (delta: number, deltaMode: number, pageSize: number): number =>
  deltaMode === 1 ? delta * 16 : deltaMode === 2 ? delta * pageSize : delta;
