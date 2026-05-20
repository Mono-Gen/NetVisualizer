import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { InterfaceConfig } from './settings/InterfaceConfig';
import { DNSConfig } from './settings/DNSConfig';
import { MulticastConfig } from './settings/MulticastConfig';
import { ServiceConfig } from './settings/ServiceConfig';
import { DHCPConfig } from './settings/DHCPConfig';
import { SwitchIGMPConfig } from './settings/SwitchIGMPConfig';
import { X, Server, Activity, Trash2 } from 'lucide-react';

export const NodeSettings: React.FC = () => {
  const { 
    nodes, 
    selectedNodeId, 
    mode, 
    updateNode, 
    setSelectedNodeId, 
    clearDnsCache,
    clearNodeArpTable,
    clearNodeMacTable,
    clearTCPSocket
  } = useNetworkStore();
  const node = nodes.find(n => n.id === selectedNodeId);

  if (!node) return null;

  const activeTcpConns = Object.entries(node?.tcpConnections || {});

  return (
    <div className="glass" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      borderLeft: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(20px)'
    }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={20} color="var(--primary-blue)" />
          </div>
          <div>
            <h2 className="heading-sm" style={{ margin: 0 }}>Node Settings</h2>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>ID: {node.id}</p>
          </div>
        </div>
        <button onClick={() => setSelectedNodeId(null)} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="form-group">
          <label className="form-label">Node Label</label>
          <input 
            className="input" 
            value={node.label} 
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
            disabled={mode === 'SIMULATE'}
          />
        </div>

        <InterfaceConfig node={node} mode={mode} onUpdate={updateNode} />

        {['switch', 'l3switch'].includes(node.type) && (
          <SwitchIGMPConfig node={node} />
        )}

        {/* Table Displays - Real-time Pedagogical Feedback */}
        {mode === 'SIMULATE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. L3 ARP Table */}
            {['pc', 'router', 'server', 'dns', 'l3switch', 'dhcp'].includes(node.type) && (
              <div style={{ padding: '16px', background: 'rgba(74, 222, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#4ade80', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> ARP TABLE
                  </label>
                  <button 
                    onClick={() => clearNodeArpTable(node.id)} 
                    className="btn-icon" 
                    title="Clear ARP Table"
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="#4ade80" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.arpTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span>IP ADDRESS</span>
                        <span>MAC ADDRESS</span>
                      </div>
                      {Object.entries(node.arpTable || {}).map(([ip, mac]) => (
                        <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: '#4ade80' }}>{ip}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{mac}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      Table is empty.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. DNS Cache - Show for PCs/Servers */}
            {['pc', 'server', 'router'].includes(node.type) && (
              <div style={{ padding: '16px', background: 'rgba(167, 139, 250, 0.05)', borderRadius: '12px', border: '1px solid rgba(167, 139, 250, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#a78bfa', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> DNS CACHE
                  </label>
                  <button 
                    onClick={() => clearDnsCache(node.id)} 
                    className="btn-icon" 
                    title="Clear DNS Cache"
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="#a78bfa" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.dnsCache || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span>HOSTNAME</span>
                        <span>IP ADDRESS</span>
                      </div>
                      {Object.entries(node.dnsCache || {}).map(([name, ip]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: '#a78bfa' }}>{name}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{ip}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      Cache is empty.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. TCP Sockets Table */}
            {['pc', 'server'].includes(node.type) && (
              <div style={{ padding: '16px', background: 'rgba(236, 72, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#ec4899', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> TCP SOCKETS
                  </label>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {activeTcpConns.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{flex: 1}}>LOCAL</span>
                        <span style={{flex: 2}}>REMOTE (IP:PORT)</span>
                        <span style={{flex: 1}}>STATE</span>
                        <span style={{width: '20px'}}></span>
                      </div>
                      {activeTcpConns.map(([key, conn]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
                          <span className="label-mono" style={{ color: '#ec4899', flex: 1 }}>{conn.localPort}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)', flex: 2 }}>{conn.remoteIP}:{conn.remotePort}</span>
                          <span className="label-mono" style={{ 
                            color: conn.state === 'ESTABLISHED' ? '#4ade80' : 
                                   conn.state.includes('WAIT') ? '#facc15' : '#60a5fa',
                            fontWeight: conn.state === 'ESTABLISHED' ? 700 : 400,
                            flex: 1
                          }}>
                            {conn.state}
                          </span>
                          <button 
                            onClick={() => clearTCPSocket(node.id, conn.remoteIP, conn.remotePort)} 
                            className="btn-icon" 
                            title="Force Delete Socket"
                            style={{ padding: '2px', height: 'auto', width: 'auto' }}
                          >
                            <Trash2 size={12} color="#ec4899" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      No active sockets.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. L2 MAC Table */}
            {(node.type === 'switch' || node.type === 'l3switch' || (node.macTable && Object.keys(node.macTable).length > 0)) && (
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#60a5fa', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> MAC TABLE
                  </label>
                  <button 
                    onClick={() => clearNodeMacTable(node.id)} 
                    className="btn-icon" 
                    title="Clear MAC Table"
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="#60a5fa" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.macTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span>MAC ADDRESS</span>
                        <span>PORT / IFACE</span>
                      </div>
                      {Object.entries(node.macTable || {}).map(([mac, portId]) => (
                        <div key={mac} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: '#60a5fa' }}>{mac}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{node.interfaces.find(i => i.id === portId)?.name || 'Port'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      Table is empty.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. IGMP Snooping Table (For Switches) */}
            {(node.type === 'switch' || node.type === 'l3switch') && (
              <div style={{ padding: '16px', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.1)', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#fbbf24', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> IGMP SNOOPING TABLE
                  </label>
                </div>

                {/* Active mrouter Port display */}
                {node.mrouterPortId && (
                  <div style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px dashed rgba(59, 130, 246, 0.3)', padding: '6px 10px', borderRadius: '6px', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span>Router Port (mrouter):</span>
                    <span>{node.interfaces.find(i => i.id === node.mrouterPortId)?.name || node.mrouterPortId}
                      {node.mrouterPortExpiresAt && ` (${Math.max(0, Math.round((node.mrouterPortExpiresAt - Date.now()) / 1000))}s)`}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.igmpSnoopingTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span>MULTICAST GROUP</span>
                        <span>PORT / IFACE (EXPIRES)</span>
                      </div>
                      {Object.entries(node.igmpSnoopingTable || {}).map(([group, ports]) => (
                        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.03)' }}>
                          <span className="label-mono" style={{ color: '#fbbf24', fontWeight: 700 }}>{group}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '2px solid rgba(251, 191, 36, 0.3)' }}>
                            {(ports as string[]).map(pid => {
                              const name = node.interfaces.find(i => i.id === pid)?.name || pid;
                              const expireTime = node.igmpSnoopingExpires?.[group]?.[pid];
                              const timeLeft = expireTime ? Math.max(0, Math.round((expireTime - Date.now()) / 1000)) : null;
                              return (
                                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }} className="label-mono">
                                  <span style={{ color: 'var(--text-main)' }}>{name}</span>
                                  <span style={{ color: timeLeft !== null && timeLeft < 15 ? '#ef4444' : 'var(--text-dim)' }}>
                                    {timeLeft !== null ? `${timeLeft}s left` : 'Static'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      No active groups.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {node.type === 'dns' && (
          <DNSConfig node={node} onUpdate={updateNode} />
        )}

        {['pc', 'server'].includes(node.type) && (
          <MulticastConfig node={node} onUpdate={updateNode} />
        )}

        {node.type === 'server' && (
          <ServiceConfig node={node} mode={mode} onUpdate={updateNode} />
        )}

        {node.type === 'dhcp' && (
          <DHCPConfig node={node} onUpdate={updateNode} />
        )}



      </div>
    </div>
  );
};
