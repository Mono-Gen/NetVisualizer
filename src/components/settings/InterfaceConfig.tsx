import React from 'react';
import type { NetNode, NetInterface } from '../../types/network';

interface InterfaceConfigProps {
  node: NetNode;
  mode: 'DESIGN' | 'SIMULATE';
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const InterfaceConfig: React.FC<InterfaceConfigProps> = ({ node, mode, onUpdate }) => {
  const canHaveMultipleInterfaces = ['hub', 'switch', 'router', 'l3switch'].includes(node.type);
  const isL3Node = ['pc', 'router', 'server', 'dns', 'l3switch'].includes(node.type);

  const handleInterfaceChange = (ifaceId: string, updates: Partial<NetInterface>) => {
    const updatedInterfaces = node.interfaces.map(i => i.id === ifaceId ? { ...i, ...updates } : i);
    onUpdate(node.id, { interfaces: updatedInterfaces });
  };

  const addInterface = () => {
    const newIface: NetInterface = {
      id: Math.random().toString(36).substr(2, 5),
      name: `Port ${node.interfaces.length + 1}`,
      ip: '',
      mac: node.type === 'hub' ? '' : `00:00:00:00:00:${Math.floor(Math.random()*256).toString(16).padStart(2, '0')}`.toUpperCase(),
      subnet: node.type === 'hub' ? '' : '255.255.255.0',
    };
    onUpdate(node.id, { interfaces: [...node.interfaces, newIface] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>Network Interfaces</label>
        {canHaveMultipleInterfaces && mode === 'DESIGN' && (
          <button onClick={addInterface} className="btn btn-glass btn-small" style={{ fontSize: '10px' }}>
            + Add Port
          </button>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {node.interfaces.map((iface) => (
          <div key={iface.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="label-mono" style={{ fontSize: '10px', color: 'var(--primary-blue)', fontWeight: 700 }}>{iface.name}</span>
              {node.interfaces.length > 1 && mode === 'DESIGN' && (
                <button 
                  onClick={() => onUpdate(node.id, { interfaces: node.interfaces.filter(i => i.id !== iface.id) })}
                  style={{ background: 'none', border: 'none', color: 'rgba(248, 113, 113, 0.5)', cursor: 'pointer', fontSize: '10px' }}
                >
                  Remove
                </button>
              )}
            </div>
            
            {isL3Node && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px' }}>IP Address</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.ip} 
                      onChange={(e) => handleInterfaceChange(iface.id, { ip: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px' }}>Subnet Mask</label>
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
                    <label className="form-label" style={{ fontSize: '10px' }}>Default Gateway</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.gateway || ''} 
                      onChange={(e) => handleInterfaceChange(iface.id, { gateway: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '10px' }}>DNS Server</label>
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
                <label className="form-label" style={{ fontSize: '10px' }}>MAC Address</label>
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
