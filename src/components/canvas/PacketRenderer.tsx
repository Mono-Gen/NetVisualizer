import React from 'react';
import { motion } from 'framer-motion';
import type { NetNode, NetPacket } from '../../types/network';
import { getPortPosition } from '../../logic/portLayout';
import { protoFill, protoKeyOf, protoText } from '../../logic/protocolColors';

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
  
  // 色はプロトコルごとに1色(protocolColors が唯一の定義)。色だけに頼らず、必ずラベルも出す
  const key = protoKeyOf(packet);
  const fill = protoFill(key);

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
        cx={x} cy={y} r={6}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        // 淡い色でも背景に埋もれないよう、暗い輪郭を付ける。やわらかい光(グロー)も付ける
        style={{ fill, stroke: 'rgba(var(--shade), 0.55)', strokeWidth: 1.5, filter: `drop-shadow(0 0 6px ${fill})` }}
      />
      <text
        x={x} y={y - 12}
        fontSize="11"
        textAnchor="middle"
        className="label-mono"
        style={{ fill: protoText(key), stroke: 'rgba(var(--panel-rgb), 0.9)', strokeWidth: 3, paintOrder: 'stroke', fontWeight: 800 }}
      >
        {labelText}
      </text>
    </g>
  );
};
