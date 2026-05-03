import React from 'react';
import type { NetNode, ListeningPort } from '../../types/network';

interface ServiceConfigProps {
  node: NetNode;
  mode: 'DESIGN' | 'SIMULATE';
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const ServiceConfig: React.FC<ServiceConfigProps> = ({ node, mode, onUpdate }) => {
  const addPort = (port: number, protocol: 'TCP' | 'UDP') => {
    if (!port || node.listeningPorts?.some(p => p.port === port && p.protocol === protocol)) return;
    const newPorts: ListeningPort[] = [...(node.listeningPorts || []), { port, protocol }];
    onUpdate(node.id, { listeningPorts: newPorts });
  };

  const removePort = (port: number, protocol: 'TCP' | 'UDP') => {
    const newPorts = (node.listeningPorts || []).filter(p => !(p.port === port && p.protocol === protocol));
    onUpdate(node.id, { listeningPorts: newPorts });
  };

  return (
    <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
      <label className="form-label" style={{ fontSize: '10px', color: 'var(--primary-orange)' }}>Listening Services (Ports)</label>
      {mode === 'DESIGN' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input 
            id="port-input"
            className="input" 
            type="number"
            placeholder="Port"
            style={{ fontSize: '11px', padding: '6px', flex: 1 }}
          />
          <select id="proto-select" className="input" style={{ fontSize: '11px', padding: '6px', width: '70px' }}>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </select>
          <button 
            className="btn btn-glass btn-small"
            onClick={() => {
              const port = parseInt((document.getElementById('port-input') as HTMLInputElement).value);
              const proto = (document.getElementById('proto-select') as HTMLSelectElement).value as 'TCP' | 'UDP';
              if (port) addPort(port, proto);
            }}
          >Add</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {(node.listeningPorts || []).map(p => (
          <span key={`${p.protocol}-${p.port}`} className="label-mono" style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {p.protocol}:{p.port}
            {mode === 'DESIGN' && (
              <button onClick={() => removePort(p.port, p.protocol)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>x</button>
            )}
          </span>
        ))}
        {(!node.listeningPorts || node.listeningPorts.length === 0) && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>No services listening</span>
        )}
      </div>
    </div>
  );
};
