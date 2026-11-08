import React from 'react';
import type { NetNode, NetLink } from '../../types/network';
import { getPortPosition } from '../../logic/portLayout';

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
  const fromNode = nodes.find((n) => n.id === link.from);
  const toNode = nodes.find((n) => n.id === link.to);
  if (!fromNode || !toNode) return null;

  const fromIface = fromNode.interfaces.find(i => i.id === link.fromInterfaceId);
  const toIface = toNode.interfaces.find(i => i.id === link.toInterfaceId);

  // 線の両端はノード中心ではなくポート位置にする
  const p1 = getPortPosition(fromNode, link.fromInterfaceId);
  const p2 = getPortPosition(toNode, link.toInterfaceId);
  // ポート名の文字は線に沿って少し内側へ寄せる(ポート円と重ならないように)
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  const labelAt = (p: { x: number; y: number }, sign: number) => ({ x: p.x + sign * (dx / dist) * 22, y: p.y + sign * (dy / dist) * 22 });
  const p1Pos = labelAt(p1, 1);
  const p2Pos = labelAt(p2, -1);

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const stroke = isSelected ? '#fbbf24' : 'rgba(96, 165, 250, 0.4)';

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
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={isSelected ? 4 : 2} style={{ pointerEvents: 'none' }} />
      <text x={p1Pos.x} y={p1Pos.y} fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{fromIface?.name || 'P'}</text>
      <text x={p2Pos.x} y={p2Pos.y} fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{toIface?.name || 'P'}</text>
      {isSelected && canSelect && (
        <g onClick={(e) => { e.stopPropagation(); onRemove(link.id); }} style={{ cursor: 'pointer' }} role="button" aria-label="Remove cable">
          <title>Remove this cable (Delete)</title>
          <circle cx={mid.x} cy={mid.y} r="11" fill="#7f1d1d" stroke="#f87171" strokeWidth="2" style={{ pointerEvents: 'auto' }} />
          <text x={mid.x} y={mid.y + 4} fill="#fecaca" fontSize="14" fontWeight="700" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
        </g>
      )}
    </g>
  );
};
