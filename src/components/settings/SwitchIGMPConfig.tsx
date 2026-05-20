import React, { useState, useEffect } from 'react';
import type { NetNode } from '../../types/network';
import { useNetworkStore } from '../../store/useNetworkStore';
import { IGMPHandler } from '../../logic/IGMPHandler';
import { AlertCircle, Cpu, RefreshCw, Layers } from 'lucide-react';

interface SwitchIGMPConfigProps {
  node: NetNode;
}

export const SwitchIGMPConfig: React.FC<SwitchIGMPConfigProps> = ({ node }) => {
  const { updateNode, sendPacket } = useNetworkStore();
  const [ip, setIp] = useState(node.managementIP || '');
  const [subnet, setSubnet] = useState(node.managementSubnet || '255.255.255.0');
  const [interval, setIntervalVal] = useState(node.igmpQuerierInterval || 60);
  const [agingTime, setAgingTime] = useState(node.igmpSnoopingAgingTime || 30);

  // Sync state if node changes
  useEffect(() => {
    setIp(node.managementIP || '');
    setSubnet(node.managementSubnet || '255.255.255.0');
    setIntervalVal(node.igmpQuerierInterval || 60);
    setAgingTime(node.igmpSnoopingAgingTime || 30);
  }, [node.id, node.managementIP, node.managementSubnet, node.igmpQuerierInterval, node.igmpSnoopingAgingTime]);

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIp(val);
    updateNode(node.id, { managementIP: val || undefined });
  };

  const handleSubnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSubnet(val);
    updateNode(node.id, { managementSubnet: val || undefined });
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 60;
    setIntervalVal(val);
    updateNode(node.id, { igmpQuerierInterval: val });
  };

  const handleAgingTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 30;
    setAgingTime(val);
    updateNode(node.id, { igmpSnoopingAgingTime: val });
  };

  const toggleSnooping = () => {
    const isEnabled = node.igmpSnoopingEnabled !== false;
    updateNode(node.id, { igmpSnoopingEnabled: !isEnabled });
  };

  const toggleQuerier = () => {
    if (!node.managementIP) return;
    const isEnabled = !!node.igmpQuerierEnabled;
    updateNode(node.id, { 
      igmpQuerierEnabled: !isEnabled,
      igmpQuerierStandby: false // Reset election state when toggled
    });
  };

  const handleManualQuery = () => {
    const baseQuery = IGMPHandler.createQuery(node);
    node.interfaces.forEach(iface => {
      const portQuery = {
        ...baseQuery,
        fromInterfaceId: iface.id,
        originatingInterfaceId: iface.id,
        id: `p_igmp_q_${Date.now()}_${iface.id}`
      };
      sendPacket(portQuery);
    });
  };

  const isSnoopingEnabled = node.igmpSnoopingEnabled !== false;
  const isQuerierEnabled = !!node.igmpQuerierEnabled;
  const isUnmanaged = !node.managementIP;

  return (
    <div className="switch-igmp-config animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
      {/* 1. Device Mode Header & Warning */}
      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Cpu size={16} color={isUnmanaged ? '#f59e0b' : '#3b82f6'} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
            {isUnmanaged ? 'UNMANAGED L2 SWITCH' : 'MANAGED L2 SWITCH'}
          </span>
        </div>
        
        {isUnmanaged ? (
          <div style={{ display: 'flex', gap: '8px', color: '#f59e0b', fontSize: '10px', lineHeight: '1.4' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              No management IP address set. The device operates as a simple unmanaged L2 switch. IGMP Querier is disabled.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', color: '#10b981', fontSize: '10px', lineHeight: '1.4' }}>
            <Layers size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Management IP is active. Even if the subnet differs from PCs, L2 forwarding (data plane) works independently.
            </div>
          </div>
        )}
      </div>

      {/* 2. Management IP & Subnet Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 className="heading-sm" style={{ fontSize: '9px', marginBottom: '0' }}>Management Interface (VLAN 1)</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '9px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>IP Address</label>
            <input
              type="text"
              value={ip}
              onChange={handleIpChange}
              placeholder="e.g. 192.168.1.254"
              className="input"
              style={{ padding: '8px 10px', fontSize: '11px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '9px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Subnet Mask</label>
            <input
              type="text"
              value={subnet}
              onChange={handleSubnetChange}
              placeholder="e.g. 255.255.255.0"
              className="input"
              style={{ padding: '8px 10px', fontSize: '11px' }}
            />
          </div>
        </div>
      </div>

      {/* 3. IGMP Snooping Config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>IGMP Snooping</div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
              {isSnoopingEnabled ? 'Filters multicast to registered ports only' : 'Floods multicast to all ports (Hub behavior)'}
            </div>
          </div>
          <button
            onClick={toggleSnooping}
            className={`btn btn-small ${isSnoopingEnabled ? 'btn-primary' : 'btn-glass'}`}
            style={{ width: '80px', display: 'flex', justifyContent: 'center' }}
          >
            {isSnoopingEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {isSnoopingEnabled && (
          <div className="animate-fade" style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>Snooping Aging Time (sec):</label>
            <input
              type="number"
              value={agingTime}
              onChange={handleAgingTimeChange}
              min="5"
              max="300"
              className="input"
              style={{ padding: '4px 6px', fontSize: '11px', width: '60px', textAlign: 'center' }}
            />
          </div>
        )}
      </div>

      {/* 4. IGMP Querier Config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>IGMP Querier</div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
              {isQuerierEnabled 
                ? (node.igmpQuerierStandby ? 'Standby (Lost Election)' : 'Sending Periodic Queries') 
                : 'Querier function is disabled'}
            </div>
          </div>
          <button
            onClick={toggleQuerier}
            disabled={isUnmanaged}
            className={`btn btn-small ${isQuerierEnabled ? 'btn-success' : 'btn-glass'}`}
            style={{ width: '80px', display: 'flex', justifyContent: 'center', opacity: isUnmanaged ? 0.4 : 1, cursor: isUnmanaged ? 'not-allowed' : 'pointer' }}
          >
            {isQuerierEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {isQuerierEnabled && !isUnmanaged && (
          <div className="animate-fade" style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>Query Interval (sec):</label>
            <input
              type="number"
              value={interval}
              onChange={handleIntervalChange}
              min="5"
              max="300"
              className="input"
              style={{ padding: '4px 6px', fontSize: '11px', width: '60px', textAlign: 'center' }}
            />
          </div>
        )}
      </div>

      {/* 5. Manual Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleManualQuery}
          className="btn btn-glass btn-small"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <RefreshCw size={12} /> Send General Query
        </button>
      </div>
    </div>
  );
};
