import React from 'react';
import type { NetNode } from '../../types/network';
import { useNetworkStore } from '../../store/useNetworkStore';
import { useT } from '../../i18n/useT';

interface MulticastConfigProps {
  node: NetNode;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const MulticastConfig: React.FC<MulticastConfigProps> = ({ node, onUpdate }) => {
  const t = useT();
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
      <label className="form-label" style={{ fontSize: '11px', color: 'var(--primary-blue)' }}>{t('multicast.title')}</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input 
          id="mcast-input"
          className="input" 
          placeholder={t('multicast.example')}
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
        >{t('multicast.join')}</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {(node.joinedGroups || []).map(group => (
          <span key={group} className="label-mono" style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {group}
            <button onClick={() => removeMulticastGroup(group)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 0 }}>x</button>
          </span>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(var(--ink), 0.05)', paddingTop: '12px', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-yellow)' }}>{t('multicast.mdns')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', opacity: 0.7 }}>{t('multicast.mdnsDesc')}</div>
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
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: (node.joinedGroups || []).includes('224.0.0.251') ? 'var(--c-yellow)' : 'rgba(var(--ink), 0.1)',
              color: (node.joinedGroups || []).includes('224.0.0.251') ? 'var(--on-accent)' : 'var(--text-main)',
              transition: 'all 0.2s'
            }}
          >
            {(node.joinedGroups || []).includes('224.0.0.251') ? t('state.enabled') : t('state.disabled')}
          </button>
        </div>
      </div>
    </div>
  );
};
