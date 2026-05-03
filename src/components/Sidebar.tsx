import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeIcon } from './canvas/NodeIcon';
import type { NetNode, NodeType, NetInterface } from '../types/network';
import { Plus, Play, Settings, Trash2, Link as LinkIcon, Activity } from 'lucide-react';
import { SidebarCommandPanel } from './SidebarCommandPanel';

export const Sidebar: React.FC = () => {
  const { 
    nodes, addNode, mode, setMode, isLinkMode, setLinkMode, 
    isDeleteMode, setDeleteMode, isInspectMode, setInspectMode, 
    clearCanvas, packetLogs, clearPacketLogs, selectedNodeId
  } = useNetworkStore();

  const nodeTypes: { type: NodeType; label: string }[] = [
    { type: 'pc', label: 'PC' },
    { type: 'router', label: 'Router' },
    { type: 'switch', label: 'Switch' },
    { type: 'server', label: 'Server' },
    { type: 'hub', label: 'Hub' },
    { type: 'dns', label: 'DNS Server' },
    { type: 'dhcp', label: 'DHCP Server' },
  ];

  const handleAddNode = (type: NodeType, label: string) => {
    // Determine number of interfaces based on type
    let interfaceCount = 1;
    if (type === 'switch' || type === 'hub') interfaceCount = 8;
    else if (type === 'router') interfaceCount = 4;

    const interfaces: NetInterface[] = Array.from({ length: interfaceCount }).map((_, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: `eth${i}`,
      // DHCP servers require a static IP; other nodes default to APIPA (169.254.x.x)
      ip: (type === 'hub' || type === 'switch')
        ? ''
        : (type === 'dhcp')
          ? '192.168.1.254'
          : (i === 0 ? `169.254.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}` : ''),
      mac: (type === 'hub') ? '' : `00:00:00:00:${Math.floor(Math.random()*256).toString(16).padStart(2, '0')}:${Math.floor(Math.random()*256).toString(16).padStart(2, '0')}`.toUpperCase(),
      subnet: (type === 'hub' || type === 'switch') ? '' : (type === 'dhcp' ? '255.255.255.0' : '255.255.0.0'),
      gateway: ''
    }));

    const newNode: NetNode = {
      id: `n_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x: 350 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      label: `${label} ${nodes.length + 1}`,
      interfaces,
      macTable: {},
      arpTable: {},
      igmpSnoopingTable: {},
      joinedGroups: [],
      ...(type === 'dhcp' ? {
        dhcpScope: {
          startIP: '192.168.1.100',
          endIP: '192.168.1.200',
          gateway: '192.168.1.1',
          dns: '192.168.1.1',
          subnet: '255.255.255.0',
          leaseTime: 3600,
          leases: {}
        }
      } : {})
    };
    addNode(newNode);
  };

  return (
    <div className="sidebar glass" style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary-blue)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="white" />
        </div>
        <h1 className="heading-sm" style={{ margin: 0 }}>NetVisualizer</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
        <button 
          onClick={() => setMode('DESIGN')} 
          className={`tab ${mode === 'DESIGN' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'DESIGN' ? 'var(--primary-blue)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={14} /> Design
        </button>
        <button 
          onClick={() => setMode('SIMULATE')} 
          className={`tab ${mode === 'SIMULATE' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'SIMULATE' ? '#22c55e' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Play size={14} /> Simulate
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minHeight: 0 }}>
        {mode === 'DESIGN' ? (
          <>
            <div>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>COMPONENTS</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {nodeTypes.map((nt) => (
                  <button 
                    key={nt.type}
                    onClick={() => handleAddNode(nt.type, nt.label)}
                    className="btn btn-glass"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px', height: 'auto', fontSize: '10px' }}
                  >
                    <NodeIcon type={nt.type} size={20} />
                    {nt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>TOOLS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => setLinkMode(!isLinkMode)} 
                  className={`btn ${isLinkMode ? 'btn-primary' : 'btn-glass'}`}
                  style={{ justifyContent: 'flex-start', gap: '10px' }}
                >
                  <LinkIcon size={16} /> {isLinkMode ? 'Wiring Mode (On)' : 'Connect Nodes'}
                </button>
                <button 
                  onClick={() => setDeleteMode(!isDeleteMode)} 
                  className={`btn ${isDeleteMode ? 'btn-danger' : 'btn-glass'}`}
                  style={{ justifyContent: 'flex-start', gap: '10px' }}
                >
                  <Trash2 size={16} /> {isDeleteMode ? 'Eraser Mode (On)' : 'Remove Items'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>SIMULATION TOOLS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                  {/* Unified Command Center for selected PC/Server */}
                  {(() => {
                    const selectedNode = nodes.find(n => n.id === selectedNodeId);
                    if (selectedNode && ['pc', 'server'].includes(selectedNode.type)) {
                      return <SidebarCommandPanel node={selectedNode} />;
                    }
                    return (
                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        Select a PC or Server to start communication
                      </div>
                    );
                  })()}
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>PACKET LOGS</label>
                <button 
                  onClick={clearPacketLogs} 
                  className="btn-text" 
                  style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                >
                  Clear Logs
                </button>
              </div>
              <div className="log-container" style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px', fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {packetLogs.map((log: any) => {
                  const isARP = log.protocol === 'ARP';
                  const isDNS = log.protocol === 'DNS';
                  const isError = log.status === 'error';
                  const isDropped = log.status === 'dropped';
                  const themeColor = isError ? '#f87171' : isDropped ? '#9ca3af' : (isARP ? '#f59e0b' : (isDNS ? '#a78bfa' : '#3b82f6'));
                  return (
                    <div key={log.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: `3px solid ${themeColor}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', opacity: 0.6 }}>
                        <span style={{ color: themeColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>
                            {isError ? 'ERROR' : `${log.protocol} ${
                              log.protocol === 'TCP' ? (
                                (log.flags?.syn && log.flags?.ack) ? '[SYN, ACK]' :
                                log.flags?.syn ? '[SYN]' :
                                log.flags?.fin ? '[FIN]' :
                                log.flags?.rst ? '[RST]' :
                                (log.payload?.message ? '[DATA]' : '[ACK]')
                              ) : log.type
                            }`}
                          </span>
                          {log.status === 'received' && <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.2)', padding: '2px 4px', borderRadius: '4px', color: '#fff' }}>RCVD</span>}
                          {log.status === 'sent' && <span style={{ fontSize: '8px', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px', color: '#fff' }}>SENT</span>}
                          {log.status === 'dropped' && <span style={{ fontSize: '8px', background: 'rgba(156,163,175,0.3)', padding: '2px 4px', borderRadius: '4px', color: '#d1d5db' }}>DROP</span>}
                        </span>
                        <span>{log.time || new Date().toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '10px' }}>
                        {isARP 
                          ? `${log.senderMAC || '??'} → ${log.targetMAC || 'FF:FF:FF:FF:FF:FF'}`
                          : `${log.senderIP} → ${log.targetIP}`
                        }
                      </div>
                      <div style={{ opacity: 0.8, fontSize: '9px', fontStyle: 'italic', color: isError ? '#fca5a5' : 'inherit' }}>{log.info}</div>
                      {log.payload?.message && (
                        <div style={{ marginTop: '4px', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', borderLeft: '2px solid #a78bfa', color: '#e2e8f0' }}>
                          💬 "{log.payload.message}"
                        </div>
                      )}
                    </div>
                  );
                })}
                {packetLogs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '20px' }}>No activity logged</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {mode === 'DESIGN' && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <button onClick={clearCanvas} className="btn btn-glass" style={{ width: '100%', color: '#f87171' }}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
