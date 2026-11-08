import React from 'react';
import { motion } from 'framer-motion';
import type { NetNode, NetPacket } from '../../types/network';
import { getPortPosition } from '../../logic/portLayout';

interface PacketRendererProps {
  packet: NetPacket;
  nodes: NetNode[];
}

export const PacketRenderer: React.FC<PacketRendererProps> = ({
  packet,
  nodes,
}) => {
  const fromNode = nodes.find((n) => n.id === packet.from);
  const toNode = nodes.find((n) => n.id === packet.to);
  if (!fromNode || !toNode) return null;
  
  // 送出ポートから受信ポートへ動かす(リンクの描画位置と一致させる)
  const start = getPortPosition(fromNode, packet.fromInterfaceId);
  const end = getPortPosition(toNode, packet.toInterfaceId);
  const x = start.x + (end.x - start.x) * packet.progress;
  const y = start.y + (end.y - start.y) * packet.progress;
  
  // Protocol Colors
  let color = '#3b82f6'; // Default ICMP
  if (packet.protocol === 'ARP') color = '#f59e0b';
  if (packet.protocol === 'TCP') color = '#10b981';
  if (packet.protocol === 'UDP') color = '#8b5cf6';
  if (packet.protocol === 'IGMP') color = '#ec4899';
  if (packet.protocol === 'UDP' && (packet.destinationPort === 53 || packet.sourcePort === 53)) color = '#f59e0b'; // DNS

  // Label text
  let labelText = packet.protocol;
  if (packet.protocol === 'TCP') {
    if (packet.flags?.syn && packet.flags?.ack) labelText = 'TCP:SYN-ACK';
    else if (packet.flags?.syn) labelText = 'TCP:SYN';
    else if (packet.flags?.ack) labelText = 'TCP:ACK';
  } else if (packet.protocol === 'UDP' && (packet.destinationPort === 53 || packet.sourcePort === 53)) {
    labelText = 'DNS';
  }

  return (
    <g key={packet.id}>
      <motion.circle 
        cx={x} cy={y} r={5} 
        fill={color} 
        initial={{ scale: 0 }} 
        animate={{ scale: 1 }} 
        style={{ filter: `drop-shadow(0 0 8px ${color})` }} 
      />
      <text 
        x={x} y={y - 10} 
        fill={color} 
        fontSize="10" 
        textAnchor="middle" 
        className="label-mono"
        style={{ textShadow: '0 0 4px rgba(0,0,0,0.5)', fontWeight: 800 }}
      >
        {labelText}
      </text>
    </g>
  );
};
