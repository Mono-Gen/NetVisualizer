import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { InterfaceConfig } from './settings/InterfaceConfig';
import { DNSConfig } from './settings/DNSConfig';
import { FirewallConfig } from './settings/FirewallConfig';
import { NatConfig } from './settings/NatConfig';
import { MulticastConfig } from './settings/MulticastConfig';
import { ServiceConfig } from './settings/ServiceConfig';
import { DHCPConfig } from './settings/DHCPConfig';
import { SwitchIGMPConfig } from './settings/SwitchIGMPConfig';
import { X, Server, Activity, Trash2 } from 'lucide-react';
import { useT } from '../i18n/useT';

export const NodeSettings: React.FC = () => {
  const t = useT();
  const { 
    nodes, 
    selectedNodeId, 
    mode, 
    updateNode, 
    setSelectedNodeId, 
    clearDnsCache,
    clearNodeArpTable,
    clearNodeMacTable,
    clearTCPSocket,
    removeNode,
    links
  } = useNetworkStore();
  const node = nodes.find(n => n.id === selectedNodeId);

  if (!node) return null;

  // 接続中のケーブルも一緒に消える破壊的操作なので、ケーブルがあるときは確認する
  const handleDeleteNode = () => {
    const cableCount = links.filter(l => l.from === node.id || l.to === node.id).length;
    if (cableCount > 0 && !window.confirm(t('settings.confirmDelete', { name: node.label, n: cableCount }))) return;
    removeNode(node.id);
    setSelectedNodeId(null);
  };

  const activeTcpConns = Object.entries(node?.tcpConnections || {});

  return (
    <div className="glass" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      borderLeft: '1px solid rgba(var(--ink), 0.1)',
      background: 'rgba(var(--panel-rgb), 0.8)',
      backdropFilter: 'blur(20px)'
    }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(var(--ink), 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={20} color="var(--primary-blue)" />
          </div>
          <div>
            <h2 className="heading-sm" style={{ margin: 0 }}>{t('settings.title')}</h2>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>ID: {node.id}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {mode === 'DESIGN' && (
          <button
            onClick={handleDeleteNode}
            className="btn btn-glass btn-small"
            title={t('settings.deleteDeviceTitle')}
            style={{ color: 'var(--c-red)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Trash2 size={14} /> {t('settings.deleteDevice')}
          </button>
        )}
        <button onClick={() => setSelectedNodeId(null)} className="btn-icon">
          <X size={20} />
        </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="form-group">
          <label className="form-label">{t('settings.nodeLabel')}</label>
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
              <div style={{ padding: '16px', background: 'color-mix(in srgb, var(--proto-arp) 5%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--proto-arp) 10%, transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--proto-arp-text)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> {t('table.arp')}
                  </label>
                  <button 
                    onClick={() => clearNodeArpTable(node.id)} 
                    className="btn-icon" 
                    title={t('table.clearArp')}
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="var(--proto-arp-text)" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.arpTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '11px', paddingBottom: '4px', borderBottom: '1px solid rgba(var(--ink), 0.1)' }}>
                        <span>{t('table.ipAddress')}</span>
                        <span>{t('table.macAddress')}</span>
                      </div>
                      {Object.entries(node.arpTable || {}).map(([ip, mac]) => (
                        <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: 'var(--proto-arp-text)' }}>{ip}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{mac}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      {t('table.empty')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. DNS Cache - Show for PCs/Servers */}
            {['pc', 'server', 'router'].includes(node.type) && (
              <div style={{ padding: '16px', background: 'color-mix(in srgb, var(--proto-dns) 5%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--proto-dns) 10%, transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--proto-dns-text)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> {t('table.dnsCache')}
                  </label>
                  <button 
                    onClick={() => clearDnsCache(node.id)} 
                    className="btn-icon" 
                    title={t('table.clearDns')}
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="var(--proto-dns-text)" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.dnsCache || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '11px', paddingBottom: '4px', borderBottom: '1px solid rgba(var(--ink), 0.1)' }}>
                        <span>{t('table.hostname')}</span>
                        <span>{t('table.ipAddress')}</span>
                      </div>
                      {Object.entries(node.dnsCache || {}).map(([name, ip]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: 'var(--proto-dns-text)' }}>{name}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{ip}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      {t('table.cacheEmpty')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. TCP Sockets Table */}
            {['pc', 'server'].includes(node.type) && (
              <div style={{ padding: '16px', background: 'color-mix(in srgb, var(--proto-tcp) 5%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--proto-tcp) 10%, transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--proto-tcp-text)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> {t('table.tcp')}
                  </label>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {activeTcpConns.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '11px', paddingBottom: '4px', borderBottom: '1px solid rgba(var(--ink), 0.1)' }}>
                        <span style={{flex: 1}}>{t('table.local')}</span>
                        <span style={{flex: 2}}>{t('table.remote')}</span>
                        <span style={{flex: 1}}>{t('table.state')}</span>
                        <span style={{width: '20px'}}></span>
                      </div>
                      {activeTcpConns.map(([key, conn]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
                          <span className="label-mono" style={{ color: 'var(--proto-tcp-text)', flex: 1 }}>{conn.localPort}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)', flex: 2 }}>{conn.remoteIP}:{conn.remotePort}</span>
                          <span className="label-mono" style={{ 
                            color: conn.state === 'ESTABLISHED' ? 'var(--c-green)' : 
                                   conn.state.includes('WAIT') ? 'var(--c-yellow)' : 'var(--c-blue)',
                            fontWeight: conn.state === 'ESTABLISHED' ? 700 : 400,
                            flex: 1
                          }}>
                            {conn.state}
                          </span>
                          <button 
                            onClick={() => clearTCPSocket(node.id, conn.remoteIP, conn.remotePort)} 
                            className="btn-icon" 
                            title={t('table.forceDeleteSocket')}
                            style={{ padding: '2px', height: 'auto', width: 'auto' }}
                          >
                            <Trash2 size={12} color="var(--proto-tcp-text)" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      {t('table.noSockets')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. L2 MAC Table */}
            {(node.type === 'switch' || node.type === 'l3switch' || (node.macTable && Object.keys(node.macTable).length > 0)) && (
              <div style={{ padding: '16px', background: 'color-mix(in srgb, var(--proto-other) 5%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--proto-other) 10%, transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--proto-other-text)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> {t('table.mac')}
                  </label>
                  <button 
                    onClick={() => clearNodeMacTable(node.id)} 
                    className="btn-icon" 
                    title={t('table.clearMac')}
                    style={{ padding: '4px', height: 'auto', width: 'auto' }}
                  >
                    <Trash2 size={12} color="var(--proto-other-text)" />
                  </button>
                </div>
                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.macTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '11px', paddingBottom: '4px', borderBottom: '1px solid rgba(var(--ink), 0.1)' }}>
                        <span>{t('table.macAddress')}</span>
                        <span>{t('table.portIface')}</span>
                      </div>
                      {Object.entries(node.macTable || {}).map(([mac, portId]) => (
                        <div key={mac} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span className="label-mono" style={{ color: 'var(--proto-other-text)' }}>{mac}</span>
                          <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{node.interfaces.find(i => i.id === portId)?.name || 'Port'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
                      {t('table.empty')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. IGMP Snooping Table (For Switches) */}
            {(node.type === 'switch' || node.type === 'l3switch') && (
              <div style={{ padding: '16px', background: 'color-mix(in srgb, var(--proto-igmp) 5%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--proto-igmp) 10%, transparent)', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--proto-igmp-text)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <Activity size={14} /> {t('table.igmp')}
                  </label>
                </div>

                {/* Active mrouter Port display */}
                {node.mrouterPortId && (
                  <div style={{ fontSize: '11px', background: 'color-mix(in srgb, var(--proto-igmp) 10%, transparent)', border: '1px dashed color-mix(in srgb, var(--proto-igmp) 40%, transparent)', padding: '6px 10px', borderRadius: '6px', color: 'var(--proto-igmp-text)', display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span>{t('table.mrouter')}</span>
                    <span>{node.interfaces.find(i => i.id === node.mrouterPortId)?.name || node.mrouterPortId}
                      {node.mrouterPortExpiresAt && ` (${Math.max(0, Math.round((node.mrouterPortExpiresAt - Date.now()) / 1000))}s)`}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '11px' }}>
                  {Object.entries(node.igmpSnoopingTable || {}).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '11px', paddingBottom: '4px', borderBottom: '1px solid rgba(var(--ink), 0.1)' }}>
                        <span>{t('table.multicastGroup')}</span>
                        <span>{t('table.portIfaceExpires')}</span>
                      </div>
                      {Object.entries(node.igmpSnoopingTable || {}).map(([group, ports]) => (
                        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0', borderBottom: '1px dashed rgba(var(--ink), 0.03)' }}>
                          <span className="label-mono" style={{ color: 'var(--proto-igmp-text)', fontWeight: 700 }}>{group}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '2px solid color-mix(in srgb, var(--proto-igmp) 30%, transparent)' }}>
                            {(ports as string[]).map(pid => {
                              const name = node.interfaces.find(i => i.id === pid)?.name || pid;
                              const expireTime = node.igmpSnoopingExpires?.[group]?.[pid];
                              const timeLeft = expireTime ? Math.max(0, Math.round((expireTime - Date.now()) / 1000)) : null;
                              return (
                                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }} className="label-mono">
                                  <span style={{ color: 'var(--text-main)' }}>{name}</span>
                                  <span style={{ color: timeLeft !== null && timeLeft < 15 ? 'var(--c-red)' : 'var(--text-dim)' }}>
                                    {timeLeft !== null ? t('table.timeLeft', { n: timeLeft }) : t('table.static')}
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
                      {t('table.noGroups')}
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

        {node.type === 'router' && (
          <FirewallConfig node={node} onUpdate={updateNode} />
        )}

        {node.type === 'router' && (
          <NatConfig node={node} mode={mode} onUpdate={updateNode} />
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
