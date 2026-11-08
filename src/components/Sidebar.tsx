import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeIcon } from './canvas/NodeIcon';
import type { NodeType } from '../types/network';
import { Plus, Play, Settings } from 'lucide-react';
import { SidebarCommandPanel } from './SidebarCommandPanel';
import { SampleMenu } from './SampleMenu';
import { ThemeToggle } from './ThemeToggle';
import { NODE_PALETTE, DND_NODE_TYPE, createNode } from '../logic/nodeFactory';

export const Sidebar: React.FC = () => {
  const { 
    nodes, addNode, mode, setMode, 
    isInspectMode, setInspectMode, 
    clearCanvas, packetLogs, clearPacketLogs, selectedNodeId
  } = useNetworkStore();

  const nodeTypes = NODE_PALETTE;

  // クリックでも追加できる(キーボード/タッチ向け)。位置は空いているグリッドに自動配置
  const handleAddNode = (type: NodeType) => addNode(createNode(type, nodes));

  return (
    <div className="sidebar glass" style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary-blue)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="white" />
        </div>
        <h1 className="heading-sm" style={{ margin: 0 }}>NetVisualizer</h1>
        <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
      </div>

      <div className="tabs" style={{ display: 'flex', background: 'rgba(var(--shade), 0.2)', padding: '4px', borderRadius: '10px' }}>
        <button 
          onClick={() => setMode('DESIGN')} 
          className={`tab ${mode === 'DESIGN' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'DESIGN' ? 'var(--primary-blue)' : 'transparent', color: mode === 'DESIGN' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={14} /> Design
        </button>
        <button 
          onClick={() => setMode('SIMULATE')} 
          className={`tab ${mode === 'SIMULATE' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'SIMULATE' ? 'var(--solid-green)' : 'transparent', color: mode === 'SIMULATE' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
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
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData(DND_NODE_TYPE, nt.type); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => handleAddNode(nt.type)}
                    title={`Drag onto the canvas, or click to add (${nt.label})`}
                    className="btn btn-glass"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px', height: 'auto', fontSize: '11px' }}
                  >
                    <NodeIcon type={nt.type} size={20} />
                    {nt.label}
                  </button>
                ))}
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
                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(var(--ink), 0.03)', borderRadius: '10px', fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', border: '1px dashed rgba(var(--ink), 0.1)' }}>
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
                  style={{ color: 'var(--c-blue)', fontSize: '11px', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                >
                  Clear Logs
                </button>
              </div>
              <div className="log-container" style={{ flex: 1, overflowY: 'auto', background: 'rgba(var(--shade), 0.2)', borderRadius: '8px', padding: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {packetLogs.map((log: any) => {
                  const isARP = log.protocol === 'ARP';
                  const isDNS = log.protocol === 'DNS';
                  const isError = log.status === 'error';
                  const isDropped = log.status === 'dropped';
                  const themeColor = isError ? 'var(--c-red)' : isDropped ? 'var(--c-slate)' : (isARP ? 'var(--c-amber)' : (isDNS ? 'var(--c-violet)' : 'var(--c-blue-strong)'));
                  return (
                    <div key={log.id} style={{ padding: '8px', background: 'rgba(var(--ink), 0.05)', borderRadius: '6px', borderLeft: `3px solid ${themeColor}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.6 }}>
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
                          {log.status === 'received' && <span style={{ fontSize: '11px', background: 'rgba(var(--ink), 0.2)', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-main)' }}>RCVD</span>}
                          {log.status === 'sent' && <span style={{ fontSize: '11px', background: 'rgba(var(--shade), 0.3)', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-main)' }}>SENT</span>}
                          {log.status === 'dropped' && <span style={{ fontSize: '11px', background: 'rgba(156,163,175,0.3)', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-dim)' }}>DROP</span>}
                        </span>
                        <span>{log.time || new Date().toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '11px' }}>
                        {isARP 
                          ? `${log.senderMAC || '??'} → ${log.targetMAC || 'FF:FF:FF:FF:FF:FF'}`
                          : `${log.senderIP} → ${log.targetIP}`
                        }
                      </div>
                      <div style={{ opacity: 0.8, fontSize: '11px', fontStyle: 'italic', color: isError ? 'var(--c-red)' : 'inherit' }}>{log.info}</div>
                      {log.payload?.message && (
                        <div style={{ marginTop: '4px', padding: '4px', background: 'rgba(var(--shade), 0.3)', borderRadius: '4px', borderLeft: '2px solid var(--c-violet)', color: 'var(--text-main)' }}>
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

      <div style={{ borderTop: '1px solid rgba(var(--ink), 0.05)', paddingTop: '12px' }}>
        <SampleMenu />
      </div>

      {mode === 'DESIGN' && (
        <div style={{ borderTop: '1px solid rgba(var(--ink), 0.05)', paddingTop: '20px' }}>
          <button onClick={clearCanvas} className="btn btn-glass" style={{ width: '100%', color: 'var(--c-red)' }}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
