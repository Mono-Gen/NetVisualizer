import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import type { NetNode } from '../types/network';
import { Play, Send, Unplug, Search } from 'lucide-react';

interface SidebarCommandPanelProps {
  node: NetNode;
}

export const SidebarCommandPanel: React.FC<SidebarCommandPanelProps> = ({ node }) => {
  const { resolveAndPing, sendUDPMessage, startTCPHandshake, sendTCPData, closeTCPConnection, requestDHCP, sendmDNSQuery, joinMulticastGroup, leaveMulticastGroup } = useNetworkStore();
  const [targetIP, setTargetIP] = useState('');
  const [targetPort, setTargetPort] = useState('80');
  const [message, setMessage] = useState('Hello, Server!');

  return (
    <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Play size={12} /> COMMAND FOR {node.label.toUpperCase()}
      </span>
      
      {/* ICMP (Ping) / DNS */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          className="input"
          style={{ flex: 1, fontSize: '11px', padding: '6px 10px', height: '28px' }}
          placeholder="IP or Hostname (Ping)"
          value={targetIP}
          onChange={(e) => setTargetIP(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && targetIP) resolveAndPing(node.id, targetIP);
          }}
        />
        <button 
          onClick={() => targetIP && resolveAndPing(node.id, targetIP)}
          className="btn btn-primary"
          style={{ padding: '0 10px', height: '28px', background: '#8b5cf6', fontSize: '11px' }}
        >
          Ping
        </button>
      </div>

      <div style={{ height: '1px', background: 'rgba(139, 92, 246, 0.2)', margin: '4px 0' }} />

      {/* L4 Message Sender */}
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Send size={12} /> L4 MESSAGING
      </span>
      
      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          className="input" 
          type="number"
          placeholder="Target Port" 
          value={targetPort}
          onChange={e => setTargetPort(e.target.value)}
          style={{ flex: 1, fontSize: '11px', padding: '6px', height: '28px' }}
        />
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort && message) sendUDPMessage(node.id, targetIP, parseInt(targetPort), message);
          }}
          style={{ flex: 2, height: '28px', justifyContent: 'center', borderColor: 'rgba(168, 85, 247, 0.5)', color: '#c084fc', fontSize: '10px' }}
        >
          UDP Send
        </button>
      </div>

      <input 
        className="input" 
        placeholder="Message Payload" 
        value={message}
        onChange={e => setMessage(e.target.value)}
        style={{ fontSize: '11px', padding: '6px', height: '28px' }}
      />

      <div style={{ display: 'flex', gap: '4px' }}>
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort) startTCPHandshake(node.id, targetIP, parseInt(targetPort));
          }}
          style={{ flex: 1, justifyContent: 'center', borderColor: 'rgba(59, 130, 246, 0.5)', color: '#60a5fa', fontSize: '10px', padding: '0' }}
        >
          TCP Connect
        </button>
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort && message) sendTCPData(node.id, targetIP, parseInt(targetPort), message);
          }}
          style={{ flex: 1, justifyContent: 'center', borderColor: 'rgba(74, 222, 128, 0.5)', color: '#4ade80', fontSize: '10px', padding: '0' }}
        >
          TCP Send
        </button>
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort) closeTCPConnection(node.id, targetIP, parseInt(targetPort));
          }}
          style={{ width: '28px', justifyContent: 'center', borderColor: 'rgba(248, 113, 113, 0.5)', color: '#f87171', padding: '0' }}
          title="Disconnect (FIN)"
        >
          <Unplug size={12} />
        </button>
      </div>

      <div style={{ height: '1px', background: 'rgba(139, 92, 246, 0.2)', margin: '4px 0' }} />

      {/* Network Services / Multicast */}
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Search size={12} /> NETWORK SERVICES
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => requestDHCP(node.id)} 
            className="btn btn-glass" 
            style={{ flex: 1, fontSize: '10px', height: '26px' }}
          >
            DHCP Renew
          </button>
          <button 
            onClick={() => sendmDNSQuery(node.id, targetIP || 'Web Server')} 
            className="btn btn-glass" 
            style={{ flex: 1, fontSize: '10px', height: '26px', borderColor: (node.joinedGroups || []).includes('224.0.0.251') ? 'rgba(251, 191, 36, 0.4)' : 'rgba(139, 92, 246, 0.2)' }}
            title="Search for node names via Multicast DNS"
          >
            mDNS Query
          </button>
        </div>
        
        {/* mDNS Toggle & Group List */}
        <div style={{ padding: '8px', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 700 }}>mDNS RESPONDER</span>
            <button 
              onClick={() => (node.joinedGroups || []).includes('224.0.0.251') ? leaveMulticastGroup(node.id, '224.0.0.251') : joinMulticastGroup(node.id, '224.0.0.251')}
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '8px',
                fontWeight: 800,
                border: 'none',
                background: (node.joinedGroups || []).includes('224.0.0.251') ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                color: (node.joinedGroups || []).includes('224.0.0.251') ? '#000' : '#fff',
                cursor: 'pointer'
              }}
            >
              {(node.joinedGroups || []).includes('224.0.0.251') ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
          
          {node.joinedGroups && node.joinedGroups.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid rgba(251, 191, 36, 0.1)', paddingTop: '6px' }}>
              {node.joinedGroups.map(group => (
                <div key={group} style={{ fontSize: '8px', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 4px', borderRadius: '4px' }}>{group}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
