import React, { useState } from 'react';
import type { NetNode } from '../../types/network';
import { Plus, Trash2, Book } from 'lucide-react';

interface DNSConfigProps {
  node: NetNode;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const DNSConfig: React.FC<DNSConfigProps> = ({ node, onUpdate }) => {
  const [newName, setNewName] = useState('');
  const [newIP, setNewIP] = useState('');

  const records = node.dnsRecords || {};

  const addRecord = () => {
    if (!newName || !newIP) return;
    const updatedRecords = { ...records, [newName]: newIP };
    onUpdate(node.id, { dnsRecords: updatedRecords });
    setNewName('');
    setNewIP('');
  };

  const removeRecord = (name: string) => {
    const updatedRecords = { ...records };
    delete updatedRecords[name];
    onUpdate(node.id, { dnsRecords: updatedRecords });
  };

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fbbf24' }}>
        <Book size={16} /> DNS RECORDS (NAME TO IP)
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {Object.entries(records).map(([name, ip]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24' }}>{name}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{ip}</span>
            </div>
            <button onClick={() => removeRecord(name)} className="btn-icon" style={{ padding: '4px', color: 'rgba(248, 113, 113, 0.6)' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {Object.keys(records).length === 0 && (
          <div style={{ textAlign: 'center', padding: '12px', fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No records found. Add one below.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input 
          className="input" 
          style={{ fontSize: '11px', padding: '8px' }}
          placeholder="Hostname (e.g. google.com)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            className="input" 
            style={{ fontSize: '11px', padding: '8px', flex: 1 }}
            placeholder="IP Address"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
          />
          <button onClick={addRecord} className="btn btn-primary" style={{ padding: '0 12px', background: '#fbbf24' }}>
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
