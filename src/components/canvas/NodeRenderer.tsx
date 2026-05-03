import React from 'react';
import { motion } from 'framer-motion';
import type { NetNode } from '../../types/network';
import { NodeIcon } from './NodeIcon';

interface NodeRendererProps {
  node: NetNode;
  isSelected: boolean;
  isSimSource: boolean;
  isSimTarget?: boolean;
  isLinkingSource?: boolean;
  isInspectMode?: boolean;
  mode: 'DESIGN' | 'SIMULATE';
  isLinkMode: boolean;
  zoom: number;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onClick: (id: string) => void;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isSelected,
  isSimSource,
  isSimTarget,
  isLinkingSource,
  isInspectMode,
  mode,
  isLinkMode,
  zoom,
  onUpdatePosition,
  onClick,
}) => {
  const getHighlightColor = () => {
    if (isLinkingSource) return '#22c55e'; // Green for Wiring
    if (isSimSource) return '#f97316'; // Orange for Sender
    if (isSimTarget) return '#3b82f6'; // Blue for Target
    if (isSelected) return 'rgba(255,255,255,0.8)'; // Subtle white for selection
    return 'rgba(255,255,255,0.1)';
  };

  const getShadow = () => {
    if (isLinkingSource) return '0 0 25px #22c55e';
    if (isSimSource) return '0 0 25px #f97316';
    if (isSimTarget) return '0 0 25px #3b82f6';
    return 'none';
  };

  const highlightColor = getHighlightColor();
  const isGlow = isSimSource || isSimTarget || isLinkingSource;

  return (
    <motion.div
      key={node.id}
      onPan={(_, info) => onUpdatePosition(node.id, node.x + info.delta.x / zoom, node.y + info.delta.y / zoom)}
      onTap={(e) => { e.stopPropagation(); onClick(node.id); }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ 
        position: 'absolute', left: node.x, top: node.y, 
        width: '64px', height: '64px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: isLinkMode ? 'pointer' : 'grab',
        zIndex: (isGlow || isSelected) ? 30 : 10, touchAction: 'none'
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ cursor: 'grabbing' }}
    >
      <div style={{ 
        width: '64px', height: '64px',
        background: '#1e293b', borderRadius: '16px', 
        border: `2px solid ${highlightColor}`,
        boxShadow: getShadow(),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isGlow ? highlightColor : 'white',
        transition: 'all 0.2s'
      }}>
        <NodeIcon type={node.type} />
      </div>
      <span className="label-mono" style={{ marginTop: '8px', background: '#1e293b', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', whiteSpace: 'nowrap' }}>{node.label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px', gap: '2px' }}>
        {['pc', 'router', 'server', 'dns', 'l3switch'].includes(node.type) && node.interfaces.map(iface => (
          <div key={iface.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
            {iface.ip && <span className="label-mono" style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>{iface.ip}</span>}
            <span className="label-mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>{iface.mac}</span>
          </div>
        ))}
      </div>

      {/* Floating Pedagogical Tables (Always visible in SIMULATE mode if they have data) */}
      {mode === 'SIMULATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', pointerEvents: 'none', alignItems: 'center', width: 'max-content' }}>
          
          {/* L3 ARP Table */}
          {['pc', 'router', 'server', 'l3switch'].includes(node.type) && node.arpTable && Object.keys(node.arpTable).length > 0 && (
            <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '8px', color: '#4ade80', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(74, 222, 128, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>ARP TABLE</div>
              {Object.entries(node.arpTable).map(([ip, mac]) => (
                <div key={ip} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#4ade80' }}>{ip}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{mac.slice(-5)}</span>
                </div>
              ))}
            </div>
          )}

          {/* DNS Cache */}
          {['pc', 'server', 'router'].includes(node.type) && node.dnsCache && Object.keys(node.dnsCache).length > 0 && (
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '8px', color: '#a78bfa', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(167, 139, 250, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>DNS CACHE</div>
              {Object.entries(node.dnsCache).map(([name, ip]) => (
                <div key={name} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#a78bfa' }}>{name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ip}</span>
                </div>
              ))}
            </div>
          )}

          {/* L2 MAC Table for Switches */}
          {['switch', 'l3switch'].includes(node.type) && node.macTable && Object.keys(node.macTable).length > 0 && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '8px', color: '#60a5fa', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>MAC TABLE</div>
              {Object.entries(node.macTable).map(([mac, portId]) => (
                <div key={mac} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#60a5fa' }}>{mac.slice(-5)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{node.interfaces.find(i => i.id === portId)?.name || 'P'}</span>
                </div>
              ))}
            </div>
          )}

          {/* IGMP Table (Joined Groups for PC/Server, Snooping for Switches) */}
          {( (node.joinedGroups && node.joinedGroups.length > 0) || (node.igmpSnoopingTable && Object.keys(node.igmpSnoopingTable).length > 0) ) && (
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '8px', color: '#fbbf24', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>
                {['switch', 'l3switch'].includes(node.type) ? 'IGMP SNOOPING' : 'JOINED GROUPS'}
              </div>
              {node.joinedGroups?.map(group => (
                <div key={group} style={{ fontSize: '8px', color: '#fbbf24', textAlign: 'center', fontFamily: 'monospace' }}>{group}</div>
              ))}
              {['switch', 'l3switch'].includes(node.type) && node.igmpSnoopingTable && Object.entries(node.igmpSnoopingTable).map(([group, ports]) => (
                <div key={group} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#fbbf24' }}>{group}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{(ports as string[]).map(pid => node.interfaces.find(i => i.id === pid)?.name || 'P').join(',')}</span>
                </div>
              ))}
            </div>
          )}

          {/* TCP Sockets */}
          {['pc', 'server', 'router'].includes(node.type) && node.tcpConnections && Object.keys(node.tcpConnections).length > 0 && (
            <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '8px', color: '#ec4899', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(236, 72, 153, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>TCP SOCKETS</div>
              {Object.entries(node.tcpConnections).map(([key, conn]: [string, any]) => (
                <div key={key} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#ec4899' }}>:{conn.localPort}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{conn.remoteIP}:{conn.remotePort}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {mode === 'SIMULATE' && isInspectMode && (
        <div className="node-table-overlay" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {(node.type === 'pc' || node.type === 'router' || node.type === 'server' || node.type === 'dns') && (
            <div className="node-table-section">
              <div className="node-table-header"><span>MY INTERFACES</span></div>
              {node.interfaces.map(iface => (
                <div key={iface.id} className="node-table-row"><span className="node-table-key" style={{ color: '#60a5fa' }}>{iface.ip || 'no-ip'}</span><span className="node-table-val" style={{ color: 'rgba(255,255,255,0.4)' }}>{iface.mac}</span></div>
              ))}
            </div>
          )}
          {(node.type === 'pc' || node.type === 'router' || node.type === 'server' || node.type === 'dns') && node.arpTable && Object.keys(node.arpTable).length > 0 && (
            <div className="node-table-section">
              <div className="node-table-header"><span>ARP TABLE (CACHE)</span><span>{Object.keys(node.arpTable).length}</span></div>
              {Object.entries(node.arpTable).map(([ip, mac]) => (
                <div key={ip} className="node-table-row"><span className="node-table-key" style={{ color: '#4ade80' }}>{ip}</span><span className="node-table-val">{mac}</span></div>
              ))}
            </div>
          )}
          {node.type === 'switch' && node.macTable && Object.keys(node.macTable).length > 0 && (
            <div className="node-table-section">
              <div className="node-table-header"><span>MAC ADDRESS TABLE</span><span>{Object.keys(node.macTable).length}</span></div>
              {Object.entries(node.macTable).map(([mac, portId]) => {
                const iface = node.interfaces.find(i => i.id === portId);
                return (<div key={mac} className="node-table-row"><span className="node-table-key">{mac}</span><span className="node-table-val">{iface?.name || portId}</span></div>);
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
