import React from 'react';
import { Monitor, Router, Server, Network, HelpCircle, Layout, Database } from 'lucide-react';
import type { NodeType } from '../../types/network';

interface NodeIconProps {
  type: NodeType;
  size?: number;
  color?: string;
}

export const NodeIcon: React.FC<NodeIconProps> = ({ type, size = 32, color }) => {
  const defaultColor = color || (
    type === 'pc' ? '#60a5fa' :
    type === 'router' ? '#f87171' :
    type === 'server' ? '#4ade80' :
    type === 'switch' ? '#c084fc' :
    type === 'hub' ? '#94a3b8' :
    type === 'dns' ? '#fbbf24' : 
    type === 'dhcp' ? '#ec4899' : '#ffffff'
  );

  switch (type) {
    case 'pc': return <Monitor size={size} color={defaultColor} />;
    case 'router': return <Router size={size} color={defaultColor} />;
    case 'server': return <Server size={size} color={defaultColor} />;
    case 'switch': return <Network size={size} color={defaultColor} />;
    case 'hub': return <Layout size={size} color={defaultColor} />;
    case 'dns': return <HelpCircle size={size} color={defaultColor} />;
    case 'dhcp': return <Database size={size} color={defaultColor} />;
    default: return null;
  }
};
