import React from 'react';
import type { NetNode, NetLink } from '../../types/network';

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

  const getPortPos = (start: {x:number, y:number}, end: {x:number, y:number}) => {
    const startX = start.x + 32;
    const startY = start.y + 32;
    const endX = end.x + 32;
    const endY = end.y + 32;
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const offset = 45;
    return { x: startX + (dx / (dist || 1)) * offset, y: startY + (dy / (dist || 1)) * offset };
  };

  const p1Pos = getPortPos(fromNode, toNode);
  const p2Pos = getPortPos(toNode, fromNode);

  return (
    <g key={link.id} style={{ cursor: isDeleteMode ? 'pointer' : 'default' }} onClick={() => isDeleteMode && onRemove(link.id)}>
      <line x1={fromNode.x + 32} y1={fromNode.y + 32} x2={toNode.x + 32} y2={toNode.y + 32} stroke="transparent" strokeWidth="20" style={{ pointerEvents: isDeleteMode ? 'auto' : 'none' }} />
      <line x1={fromNode.x + 32} y1={fromNode.y + 32} x2={toNode.x + 32} y2={toNode.y + 32} stroke={isDeleteMode ? '#ef4444' : 'rgba(96, 165, 250, 0.4)'} strokeWidth="2" style={{ pointerEvents: 'none' }} />
      <text x={p1Pos.x} y={p1Pos.y} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{fromIface?.name || 'P'}</text>
      <text x={p2Pos.x} y={p2Pos.y} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }} className="label-mono">{toIface?.name || 'P'}</text>
    </g>
  );
};
