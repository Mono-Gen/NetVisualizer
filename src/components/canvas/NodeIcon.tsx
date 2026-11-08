import React from 'react';
import { Monitor, Router, Server, Network, HelpCircle, Layout, Database, Waypoints } from 'lucide-react';
import type { NodeType } from '../../types/network';

interface NodeIconProps {
  type: NodeType;
  size?: number;
  color?: string;
}

export const NodeIcon: React.FC<NodeIconProps> = ({ type, size = 32, color }) => {
  const defaultColor = color || (
    type === 'pc' ? 'var(--c-blue)' :
    type === 'router' ? 'var(--c-red)' :
    type === 'server' ? 'var(--c-green)' :
    type === 'switch' ? 'var(--c-purple)' :
    type === 'l3switch' ? 'var(--c-sky)' :
    type === 'hub' ? 'var(--c-slate)' :
    type === 'dns' ? 'var(--c-yellow)' : 
    type === 'dhcp' ? 'var(--c-pink)' : 'var(--text-main)'
  );

  switch (type) {
    case 'pc': return <Monitor size={size} style={{ color: defaultColor }} />;
    case 'router': return <Router size={size} style={{ color: defaultColor }} />;
    case 'server': return <Server size={size} style={{ color: defaultColor }} />;
    case 'switch': return <Network size={size} style={{ color: defaultColor }} />;
    case 'l3switch': return <Waypoints size={size} style={{ color: defaultColor }} />;
    case 'hub': return <Layout size={size} style={{ color: defaultColor }} />;
    case 'dns': return <HelpCircle size={size} style={{ color: defaultColor }} />;
    case 'dhcp': return <Database size={size} style={{ color: defaultColor }} />;
    default: return null;
  }
};
