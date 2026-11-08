import React from 'react';
import { motion } from 'framer-motion';
import type { NetNode } from '../../types/network';
import { NodeIcon } from './NodeIcon';
import { PortHandle } from './PortHandle';
import { getPortCenter, getPortStripExtra, type PortRef } from '../../logic/portLayout';
import { useT } from '../../i18n/useT';

interface NodeRendererProps {
  node: NetNode;
  isSelected: boolean;
  isSimSource: boolean;
  isSimTarget?: boolean;
  isInspectMode?: boolean;
  mode: 'DESIGN' | 'SIMULATE';
  zoom: number;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onClick: (id: string) => void;
  /** リンクで使用中のインターフェースID */
  usedPortIds: Set<string>;
  /** ポートからのドラッグ配線中の配線元(なければnull) */
  wireSource: PortRef | null;
  /** ポートからの配線を許可するか(DESIGNモードかつ消しゴムでない) */
  canWire: boolean;
  onPortStart: (nodeId: string, ifaceId: string) => void;
  onContextMenu: (target: { kind: 'node'; nodeId: string } | { kind: 'port'; nodeId: string; ifaceId: string }, clientX: number, clientY: number) => void;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isSelected,
  isSimSource,
  isSimTarget,
  isInspectMode,
  mode,
  zoom,
  onUpdatePosition,
  onClick,
  usedPortIds,
  wireSource,
  canWire,
  onPortStart,
  onContextMenu,
}) => {
  const t = useT();
  const getHighlightColor = () => {
    if (isSimSource) return 'var(--c-orange)'; // Orange for Sender
    if (isSimTarget) return 'var(--c-blue-strong)'; // Blue for Target
    if (isSelected) return 'rgba(var(--ink), 0.8)'; // Subtle white for selection
    return 'rgba(var(--ink), 0.1)';
  };

  const getShadow = () => {
    if (isSimSource) return '0 0 25px var(--c-orange)';
    if (isSimTarget) return '0 0 25px var(--c-blue-strong)';
    return 'none';
  };

  const highlightColor = getHighlightColor();
  const isGlow = isSimSource || isSimTarget;

  return (
    <motion.div
      key={node.id}
      onPan={(_, info) => onUpdatePosition(node.id, node.x + info.delta.x / zoom, node.y + info.delta.y / zoom)}
      onTap={(e) => { e.stopPropagation(); onClick(node.id); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu({ kind: 'node', nodeId: node.id }, e.clientX, e.clientY); }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ 
        position: 'absolute', left: node.x, top: node.y, 
        width: '64px', height: '64px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'grab',
        zIndex: (isGlow || isSelected) ? 30 : 10, touchAction: 'none'
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ cursor: 'grabbing' }}
    >
      <div style={{ 
        width: '64px', height: '64px', flexShrink: 0, // 縮むとポート位置(本体64px前提)とずれる
        background: 'var(--node-bg)', borderRadius: '16px', 
        border: `2px solid ${highlightColor}`,
        boxShadow: getShadow(),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isGlow ? highlightColor : 'var(--text-main)',
        transition: 'all 0.2s'
      }}>
        <NodeIcon type={node.type} />
      </div>
      {node.interfaces.map((iface, index) => {
        const c = getPortCenter(node, index);
        const used = usedPortIds.has(iface.id);
        const isSource = wireSource?.nodeId === node.id && wireSource.ifaceId === iface.id;
        return (
          <PortHandle
            key={iface.id}
            cx={c.x - node.x} cy={c.y - node.y}
            name={iface.name}
            tooltip={`${iface.name}${iface.ip ? ' • ' + iface.ip : ''}${iface.mac ? ' • ' + iface.mac : ''} — ${used ? t('port.connected') : t('port.free')}`}
            used={used}
            isWireSource={isSource}
            isCandidate={!!wireSource && !isSource && !used && wireSource.nodeId !== node.id}
            isBlocked={!!wireSource && !isSource && (used || wireSource.nodeId === node.id)}
            interactive={canWire}
            onStart={() => onPortStart(node.id, iface.id)}
            onContextMenu={(x, y) => onContextMenu({ kind: 'port', nodeId: node.id, ifaceId: iface.id }, x, y)}
          />
        );
      })}
      <span className="label-mono" style={{ marginTop: `${8 + getPortStripExtra(node.interfaces.length)}px`, background: 'var(--node-bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(var(--ink), 0.1)', fontSize: '11px', whiteSpace: 'nowrap' }}>{node.label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px', gap: '2px' }}>
        {['pc', 'router', 'server', 'dns', 'l3switch'].includes(node.type) && node.interfaces.map(iface => (
          <div key={iface.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(var(--shade), 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
            {iface.ip && <span className="label-mono" style={{ fontSize: '11px', color: 'var(--c-blue)', fontWeight: 600 }}>{iface.ip}</span>}
            <span className="label-mono" style={{ fontSize: '11px', color: 'rgba(var(--ink), 0.6)', letterSpacing: '0.05em' }}>{iface.mac}</span>
          </div>
        ))}
      </div>

      {/* Floating Pedagogical Tables (Always visible in SIMULATE mode if they have data) */}
      {mode === 'SIMULATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', pointerEvents: 'none', alignItems: 'center', width: 'max-content' }}>
          
          {/* L3 ARP Table */}
          {['pc', 'router', 'server', 'l3switch'].includes(node.type) && node.arpTable && Object.keys(node.arpTable).length > 0 && (
            <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-green)', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(74, 222, 128, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>{t('table.arp')}</div>
              {Object.entries(node.arpTable).map(([ip, mac]) => (
                <div key={ip} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--c-green)' }}>{ip}</span>
                  <span style={{ color: 'rgba(var(--ink), 0.6)' }}>{mac.slice(-5)}</span>
                </div>
              ))}
            </div>
          )}

          {/* DNS Cache */}
          {['pc', 'server', 'router'].includes(node.type) && node.dnsCache && Object.keys(node.dnsCache).length > 0 && (
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-violet)', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(167, 139, 250, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>{t('table.dnsCache')}</div>
              {Object.entries(node.dnsCache).map(([name, ip]) => (
                <div key={name} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--c-violet)' }}>{name}</span>
                  <span style={{ color: 'rgba(var(--ink), 0.6)' }}>{ip}</span>
                </div>
              ))}
            </div>
          )}

          {/* L2 MAC Table for Switches */}
          {['switch', 'l3switch'].includes(node.type) && node.macTable && Object.keys(node.macTable).length > 0 && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-blue)', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>{t('table.mac')}</div>
              {Object.entries(node.macTable).map(([mac, portId]) => (
                <div key={mac} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--c-blue)' }}>{mac.slice(-5)}</span>
                  <span style={{ color: 'rgba(var(--ink), 0.6)' }}>{node.interfaces.find(i => i.id === portId)?.name || 'P'}</span>
                </div>
              ))}
            </div>
          )}

          {/* IGMP Table (Joined Groups for PC/Server, Snooping for Switches) */}
          {( (node.joinedGroups && node.joinedGroups.length > 0) || (node.igmpSnoopingTable && Object.keys(node.igmpSnoopingTable).length > 0) ) && (
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-yellow)', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>
                {['switch', 'l3switch'].includes(node.type) ? 'IGMP SNOOPING' : t('node.joinedGroups')}
              </div>
              {node.joinedGroups?.map(group => (
                <div key={group} style={{ fontSize: '11px', color: 'var(--c-yellow)', textAlign: 'center', fontFamily: 'monospace' }}>{group}</div>
              ))}
              {['switch', 'l3switch'].includes(node.type) && node.igmpSnoopingTable && Object.entries(node.igmpSnoopingTable).map(([group, ports]) => (
                <div key={group} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--c-yellow)' }}>{group}</span>
                  <span style={{ color: 'rgba(var(--ink), 0.6)' }}>{(ports as string[]).map(pid => node.interfaces.find(i => i.id === pid)?.name || 'P').join(',')}</span>
                </div>
              ))}
            </div>
          )}

          {/* TCP Sockets */}
          {['pc', 'server', 'router'].includes(node.type) && node.tcpConnections && Object.keys(node.tcpConnections).length > 0 && (
            <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', minWidth: '80px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-pink)', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(236, 72, 153, 0.2)', paddingBottom: '2px', marginBottom: '2px' }}>{t('table.tcp')}</div>
              {Object.entries(node.tcpConnections).map(([key, conn]: [string, any]) => (
                <div key={key} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--c-pink)' }}>:{conn.localPort}</span>
                  <span style={{ color: 'rgba(var(--ink), 0.6)' }}>{conn.remoteIP}:{conn.remotePort}</span>
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
              <div className="node-table-header"><span>{t('node.myInterfaces')}</span></div>
              {node.interfaces.map(iface => (
                <div key={iface.id} className="node-table-row"><span className="node-table-key" style={{ color: 'var(--c-blue)' }}>{iface.ip || 'no-ip'}</span><span className="node-table-val" style={{ color: 'rgba(var(--ink), 0.4)' }}>{iface.mac}</span></div>
              ))}
            </div>
          )}
          {(node.type === 'pc' || node.type === 'router' || node.type === 'server' || node.type === 'dns') && node.arpTable && Object.keys(node.arpTable).length > 0 && (
            <div className="node-table-section">
              <div className="node-table-header"><span>{t('node.arpCache')}</span><span>{Object.keys(node.arpTable).length}</span></div>
              {Object.entries(node.arpTable).map(([ip, mac]) => (
                <div key={ip} className="node-table-row"><span className="node-table-key" style={{ color: 'var(--c-green)' }}>{ip}</span><span className="node-table-val">{mac}</span></div>
              ))}
            </div>
          )}
          {node.type === 'switch' && node.macTable && Object.keys(node.macTable).length > 0 && (
            <div className="node-table-section">
              <div className="node-table-header"><span>{t('node.macAddressTable')}</span><span>{Object.keys(node.macTable).length}</span></div>
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
