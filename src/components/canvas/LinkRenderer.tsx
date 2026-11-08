import React from 'react';
import type { NetNode, NetLink } from '../../types/network';
import { getPortPosition } from '../../logic/portLayout';

interface LinkRendererProps {
  link: NetLink;
  nodes: NetNode[];
  isDeleteMode: boolean;
  onRemove: (id: string) => void;
}

export const LinkRenderer: React.FC<LinkRendererProps> = ({
  link,
  nodes,
  isDeleteMode,
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

  return (
    <g key={link.id} style={{ cursor: isDeleteMode ? 'pointer' : 'default' }} onClick={() => isDeleteMode && onRemove(link.id)}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="20" style={{ pointerEvents: isDeleteMode ? 'auto' : 'none' }} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={isDeleteMode ? '#ef4444' : 'rgba(96, 165, 250, 0.4)'} strokeWidth="2" style={{ pointerEvents: 'none' }} />
      <text x={p1Pos.x} y={p1Pos.y} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{fromIface?.name || 'P'}</text>
      <text x={p2Pos.x} y={p2Pos.y} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{toIface?.name || 'P'}</text>
    </g>
  );
};
