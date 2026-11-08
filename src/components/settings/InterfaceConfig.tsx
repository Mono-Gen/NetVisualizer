import React from 'react';
import type { NetNode, NetInterface } from '../../types/network';
import { useNetworkStore } from '../../store/useNetworkStore';
import { PORT_LIMITS, canChangePortCount } from '../../logic/interfaceFactory';

interface InterfaceConfigProps {
  node: NetNode;
  mode: 'DESIGN' | 'SIMULATE';
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const InterfaceConfig: React.FC<InterfaceConfigProps> = ({ node, mode, onUpdate }) => {
  const { links, addInterface, removeInterface } = useNetworkStore();
  const canHaveMultipleInterfaces = canChangePortCount(node.type);
  const limits = PORT_LIMITS[node.type];
  const isL3Node = ['pc', 'router', 'server', 'dns', 'l3switch'].includes(node.type);

  const handleInterfaceChange = (ifaceId: string, updates: Partial<NetInterface>) => {
    const updatedInterfaces = node.interfaces.map(i => i.id === ifaceId ? { ...i, ...updates } : i);
    onUpdate(node.id, { interfaces: updatedInterfaces });
  };

  const isLinked = (ifaceId: string) =>
    links.some(l => (l.from === node.id && l.fromInterfaceId === ifaceId) || (l.to === node.id && l.toInterfaceId === ifaceId));

  // 末尾から数えて最初の「未接続」ポートを削除する(ケーブルは抜けない安全な削除)
  const lastFreeIface = [...node.interfaces].reverse().find(i => !isLinked(i.id));
  const canRemoveFree = !!lastFreeIface && node.interfaces.length > limits.min;

  // 接続中のポートを消すとケーブルも抜ける。破壊的操作なので確認する。
  const handleRemove = (ifaceId: string, name: string) => {
    if (isLinked(ifaceId) && !window.confirm(`${name} is connected. Removing it will also remove the cable. Continue?`)) return;
    removeInterface(node.id, ifaceId);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>Network Interfaces</label>
        {canHaveMultipleInterfaces && mode === 'DESIGN' && (
          <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => lastFreeIface && removeInterface(node.id, lastFreeIface.id)} disabled={!canRemoveFree} title={canRemoveFree ? `Remove ${lastFreeIface!.name} (unconnected)` : (node.interfaces.length <= limits.min ? `Minimum ${limits.min} ports` : 'All ports are connected. Remove a cable first, or use Remove on a port below.')} className="btn btn-glass btn-small" style={{ fontSize: '11px' }}>
            − Remove Port
          </button>
          <button onClick={() => addInterface(node.id)} disabled={node.interfaces.length >= limits.max} title={node.interfaces.length >= limits.max ? `Maximum ${limits.max} ports` : 'Add a port'} className="btn btn-glass btn-small" style={{ fontSize: '11px' }}>
            + Add Port ({node.interfaces.length}/{limits.max})
          </button>
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {node.interfaces.map((iface) => (
          <div key={iface.id} style={{ padding: '12px', background: 'rgba(var(--ink), 0.02)', borderRadius: '8px', border: '1px solid rgba(var(--ink), 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="label-mono" style={{ fontSize: '11px', color: 'var(--primary-blue)', fontWeight: 700 }}>{iface.name}</span>
              {canHaveMultipleInterfaces && node.interfaces.length > limits.min && mode === 'DESIGN' && (
                <button 
                  onClick={() => handleRemove(iface.id, iface.name)}
                  style={{ background: 'none', border: 'none', color: 'rgba(248, 113, 113, 0.5)', cursor: 'pointer', fontSize: '11px' }}
                >
                  Remove
                </button>
              )}
            </div>
            
            {isL3Node && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>IP Address</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.ip} 
                      onChange={(e) => handleInterfaceChange(iface.id, { ip: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Subnet Mask</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.subnet} 
                      onChange={(e) => handleInterfaceChange(iface.id, { subnet: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Default Gateway</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.gateway || ''} 
                      onChange={(e) => handleInterfaceChange(iface.id, { gateway: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>DNS Server</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.dns || ''} 
                      onChange={(e) => handleInterfaceChange(iface.id, { dns: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                </div>
              </>
            )}

            {node.type !== 'hub' && (
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label className="form-label" style={{ fontSize: '11px' }}>MAC Address</label>
                <input 
                  className="input" 
                  style={{ fontSize: '11px', padding: '6px' }}
                  value={iface.mac} 
                  onChange={(e) => handleInterfaceChange(iface.id, { mac: e.target.value })}
                  disabled={mode === 'SIMULATE'}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
