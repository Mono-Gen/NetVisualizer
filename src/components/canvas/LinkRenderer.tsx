import React from 'react';
import type { NetNode, NetLink } from '../../types/network';
import { getPortPosition } from '../../logic/portLayout';
import { useT } from '../../i18n/useT';

interface LinkRendererProps {
  link: NetLink;
  nodes: NetNode[];
  isSelected: boolean;
  /** 選択できるか(DESIGNモードで配線/消しゴムモードでないとき) */
  canSelect: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (linkId: string, clientX: number, clientY: number) => void;
  onRemove: (id: string) => void;
}

export const LinkRenderer: React.FC<LinkRendererProps> = ({
  link,
  nodes,
  isSelected,
  canSelect,
  onSelect,
  onContextMenu,
  onRemove,
}) => {
  const t = useT();
  const fromNode = nodes.find((n) => n.id === link.from);
  const toNode = nodes.find((n) => n.id === link.to);
  if (!fromNode || !toNode) return null;

  // 線の両端はノード中心ではなくポート位置にする
  const p1 = getPortPosition(fromNode, link.fromInterfaceId);
  const p2 = getPortPosition(toNode, link.toInterfaceId);
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const stroke = isSelected ? 'var(--c-yellow)' : 'rgba(96, 165, 250, 0.4)';

  return (
    <g
      key={link.id}
      style={{ cursor: canSelect ? 'pointer' : 'default' }}
      onContextMenu={(e) => { if (!canSelect) return; e.preventDefault(); e.stopPropagation(); onContextMenu(link.id, e.clientX, e.clientY); }}
      onClick={(e) => {
        if (canSelect) { e.stopPropagation(); onSelect(link.id); }
      }}
    >
      {/* 当たり判定用の太い透明線。選択/削除できるときだけ反応させる */}
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="20" style={{ pointerEvents: canSelect ? 'auto' : 'none' }} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} strokeWidth={isSelected ? 4 : 2} style={{ stroke, pointerEvents: 'none' }} />
      {isSelected && canSelect && (
        <g onClick={(e) => { e.stopPropagation(); onRemove(link.id); }} style={{ cursor: 'pointer' }} role="button" aria-label={t('link.removeAria')}>
          <title>{t('link.removeTitle')}</title>
          <circle cx={mid.x} cy={mid.y} r="11" fill="#7f1d1d" stroke="#f87171" strokeWidth="2" style={{ pointerEvents: 'auto' }} />
          <text x={mid.x} y={mid.y + 4} fill="#fecaca" fontSize="14" fontWeight="700" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
        </g>
      )}
    </g>
  );
};

/**
 * リンク両端のポート名(eth0など)。
 * ノードより上の層に描く: ノード本体やポートの円の下に潜って読めなくなるのを防ぐ。
 * 文字は背景色の縁取り(ハロー)を付け、線やノードの上でも読めるようにする。
 */
const LABEL_DISTANCE = 30;
/** 十分に長いケーブルでは、ポート名を少し遠くへ置く(下辺に並ぶ機器名ラベルと重ならないように)。短いケーブルでは、両端の文字が重なるので近いまま */
const LABEL_DISTANCE_LONG = 60;
const LONG_LINK = 160;

export const LinkPortLabels: React.FC<{ link: NetLink; nodes: NetNode[] }> = ({ link, nodes }) => {
  const fromNode = nodes.find((n) => n.id === link.from);
  const toNode = nodes.find((n) => n.id === link.to);
  if (!fromNode || !toNode) return null;

  const fromIface = fromNode.interfaces.find(i => i.id === link.fromInterfaceId);
  const toIface = toNode.interfaces.find(i => i.id === link.toInterfaceId);
  const p1 = getPortPosition(fromNode, link.fromInterfaceId);
  const p2 = getPortPosition(toNode, link.toInterfaceId);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  // 線に沿って相手側へ寄せ、さらに線に直交する方向へずらして、線そのものと文字が重ならないようにする
  const nx = -dy / dist, ny = dx / dist;
  const distance = dist >= LONG_LINK ? LABEL_DISTANCE_LONG : LABEL_DISTANCE;
  const at = (p: { x: number; y: number }, sign: number, d: number) => ({
    x: p.x + sign * (dx / dist) * d + nx * 10,
    y: p.y + sign * (dy / dist) * d + ny * 10
  });
  const a = at(p1, 1, distance), b = at(p2, -1, distance);
  const style: React.CSSProperties = {
    fill: 'var(--text-main)', stroke: 'rgba(var(--panel-rgb), 0.9)', strokeWidth: 3, paintOrder: 'stroke',
    pointerEvents: 'none', userSelect: 'none'
  };

  return (
    <g>
      <text x={a.x} y={a.y} fontSize="11" textAnchor="middle" style={style} className="label-mono">{fromIface?.name || 'P'}</text>
      <text x={b.x} y={b.y} fontSize="11" textAnchor="middle" style={style} className="label-mono">{toIface?.name || 'P'}</text>
    </g>
  );
};
