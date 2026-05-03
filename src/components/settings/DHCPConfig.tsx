import React from 'react';
import type { NetNode } from '../../types/network';
import { Activity, Clock, Database } from 'lucide-react';

interface DHCPConfigProps {
  node: NetNode;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

export const DHCPConfig: React.FC<DHCPConfigProps> = ({ node, onUpdate }) => {
  if (!node.dhcpScope) return null;

  const updateScope = (updates: any) => {
    onUpdate(node.id, {
      dhcpScope: { ...node.dhcpScope!, ...updates }
    });
  };

  const leases = Object.entries(node.dhcpScope.leases);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '16px', background: 'rgba(236, 72, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
        <label className="form-label" style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <Database size={16} /> DHCP POOL SETTINGS
        </label>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '10px' }}>START IP</label>
            <input 
              className="input" 
              style={{ fontSize: '11px', padding: '6px 10px' }}
              value={node.dhcpScope.startIP}
              onChange={(e) => updateScope({ startIP: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '10px' }}>END IP</label>
            <input 
              className="input" 
              style={{ fontSize: '11px', padding: '6px 10px' }}
              value={node.dhcpScope.endIP}
              onChange={(e) => updateScope({ endIP: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '10px' }}>GATEWAY</label>
            <input 
              className="input" 
              style={{ fontSize: '11px', padding: '6px 10px' }}
              value={node.dhcpScope.gateway}
              onChange={(e) => updateScope({ gateway: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '10px' }}>LEASE TIME (SEC)</label>
            <input 
              type="number"
              className="input" 
              style={{ fontSize: '11px', padding: '6px 10px' }}
              value={node.dhcpScope.leaseTime}
              onChange={(e) => updateScope({ leaseTime: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', background: 'rgba(236, 72, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
        <label className="form-label" style={{ fontSize: '11px', color: '#ec4899', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <Activity size={14} /> ACTIVE LEASE TABLE
        </label>
        
        <div style={{ fontSize: '11px' }}>
          {leases.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ flex: 1 }}>IP ADDRESS</span>
                <span style={{ flex: 1.5 }}>MAC ADDRESS</span>
                <span style={{ flex: 1, textAlign: 'right' }}>EXPIRES IN</span>
              </div>
              {leases.map(([mac, lease]) => {
                const remaining = Math.max(0, Math.round((lease.expiresAt - Date.now()) / 1000));
                return (
                  <div key={mac} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
                    <span className="label-mono" style={{ color: '#ec4899', flex: 1 }}>{lease.ip}</span>
                    <span className="label-mono" style={{ color: 'var(--text-dim)', flex: 1.5 }}>{mac}</span>
                    <span style={{ flex: 1, textAlign: 'right', color: remaining < 60 ? '#f87171' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <Clock size={10} /> {remaining}s
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-dim)', fontStyle: 'italic', opacity: 0.6 }}>
              No active leases.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
