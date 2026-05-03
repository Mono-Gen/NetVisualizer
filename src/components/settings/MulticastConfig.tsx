import React from 'react';
import type { NetNode } from '../../types/network';
import { useNetworkStore } from '../../store/useNetworkStore';

interface MulticastConfigProps {
  node: NetNode;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const MulticastConfig: React.FC<MulticastConfigProps> = ({ node, onUpdate }) => {
  const { joinMulticastGroup, leaveMulticastGroup } = useNetworkStore();

  const addMulticastGroup = (groupIP: string) => {
    if (!groupIP) return;
    joinMulticastGroup(node.id, groupIP);
  };

  const removeMulticastGroup = (groupIP: string) => {
    leaveMulticastGroup(node.id, groupIP);
  };

  return (
    <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
      <label className="form-label" style={{ fontSize: '10px', color: 'var(--primary-blue)' }}>Multicast Groups (IGMP)</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input 
          id="mcast-input"
          className="input" 
          placeholder="e.g. 224.1.1.1"
          style={{ fontSize: '11px', padding: '6px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              addMulticastGroup((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
        <button 
          className="btn btn-glass btn-small"
          onClick={() => {
            const input = document.getElementById('mcast-input') as HTMLInputElement;
            addMulticastGroup(input.value);
            input.value = '';
          }}
        >Join</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {(node.joinedGroups || []).map(group => (
          <span key={group} className="label-mono" style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {group}
            <button onClick={() => removeMulticastGroup(group)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>x</button>
          </span>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24' }}>mDNS Responder</div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', opacity: 0.7 }}>Enable name discovery (224.0.0.251)</div>
          </div>
          <button 
            onClick={() => {
              const isJoined = (node.joinedGroups || []).includes('224.0.0.251');
              if (isJoined) removeMulticastGroup('224.0.0.251');
              else addMulticastGroup('224.0.0.251');
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: (node.joinedGroups || []).includes('224.0.0.251') ? '#fbbf24' : 'rgba(255,255,255,0.1)',
              color: (node.joinedGroups || []).includes('224.0.0.251') ? '#000' : '#fff',
              transition: 'all 0.2s'
            }}
          >
            {(node.joinedGroups || []).includes('224.0.0.251') ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>
    </div>
  );
};
