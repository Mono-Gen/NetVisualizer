import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import type { NetNode } from '../types/network';
import { Play, Send, Unplug, Search } from 'lucide-react';
import { useT } from '../i18n/useT';

interface SidebarCommandPanelProps {
  node: NetNode;
}

export const SidebarCommandPanel: React.FC<SidebarCommandPanelProps> = ({ node }) => {
  const t = useT();
  const { resolveAndPing, sendUDPMessage, startTCPHandshake, sendTCPData, closeTCPConnection, requestDHCP, sendmDNSQuery, joinMulticastGroup, leaveMulticastGroup } = useNetworkStore();
  const [targetIP, setTargetIP] = useState('');
  const [targetPort, setTargetPort] = useState('80');
  const [message, setMessage] = useState('Hello, Server!');

  return (
    <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(var(--ink), 0.06)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.12)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Play size={12} /> {t('cmd.commandFor', { name: node.label.toUpperCase() })}
      </span>
      
      {/* ICMP (Ping) / DNS */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          className="input"
          style={{ flex: 1, fontSize: '11px', padding: '6px 10px', height: '28px' }}
          placeholder={t('cmd.pingPlaceholder')}
          value={targetIP}
          onChange={(e) => setTargetIP(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && targetIP) resolveAndPing(node.id, targetIP);
          }}
        />
        <button 
          onClick={() => targetIP && resolveAndPing(node.id, targetIP)}
          className="btn btn-primary"
          style={{ padding: '0 10px', height: '28px', background: 'var(--proto-icmp)', color: 'var(--on-proto)', fontSize: '11px' }}
        >
          Ping
        </button>
      </div>

      <div style={{ height: '1px', background: 'rgba(var(--ink), 0.12)', margin: '4px 0' }} />

      {/* L4 Message Sender */}
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Send size={12} /> {t('cmd.l4')}
      </span>
      
      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          className="input" 
          type="number"
          placeholder={t('cmd.portPlaceholder')} 
          value={targetPort}
          onChange={e => setTargetPort(e.target.value)}
          style={{ flex: 1, fontSize: '11px', padding: '6px', height: '28px' }}
        />
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort && message) sendUDPMessage(node.id, targetIP, parseInt(targetPort), message);
          }}
          style={{ flex: 2, height: '28px', justifyContent: 'center', borderColor: 'var(--proto-udp)', color: 'var(--proto-udp-text)', fontSize: '11px' }}
        >
          {t('cmd.udpSend')}
        </button>
      </div>

      <input 
        className="input" 
        placeholder={t('cmd.payloadPlaceholder')} 
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
          style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)', fontSize: '11px', padding: '0' }}
        >
          {t('cmd.tcpConnect')}
        </button>
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort && message) sendTCPData(node.id, targetIP, parseInt(targetPort), message);
          }}
          style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)', fontSize: '11px', padding: '0' }}
        >
          {t('cmd.tcpSend')}
        </button>
        <button 
          className="btn btn-glass btn-small" 
          onClick={() => {
            if (targetIP && targetPort) closeTCPConnection(node.id, targetIP, parseInt(targetPort));
          }}
          style={{ width: '28px', justifyContent: 'center', borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)', padding: '0' }}
          title={t('cmd.disconnectTitle')}
        >
          <Unplug size={12} />
        </button>
      </div>

      <div style={{ height: '1px', background: 'rgba(var(--ink), 0.12)', margin: '4px 0' }} />

      {/* Network Services / Multicast */}
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Search size={12} /> {t('cmd.services')}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => requestDHCP(node.id)} 
            className="btn btn-glass" 
            style={{ flex: 1, fontSize: '11px', height: '26px' }}
          >
            {t('cmd.dhcpRenew')}
          </button>
          <button 
            onClick={() => sendmDNSQuery(node.id, targetIP || 'Web Server')} 
            className="btn btn-glass" 
            style={{ flex: 1, fontSize: '11px', height: '26px', borderColor: (node.joinedGroups || []).includes('224.0.0.251') ? 'color-mix(in srgb, var(--proto-mdns) 40%, transparent)' : 'rgba(var(--ink), 0.12)' }}
            title={t('cmd.mdnsQueryTitle')}
          >
            {t('cmd.mdnsQuery')}
          </button>
        </div>
        
        {/* mDNS Toggle & Group List */}
        <div style={{ padding: '8px', background: 'color-mix(in srgb, var(--proto-mdns) 5%, transparent)', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--proto-mdns) 10%, transparent)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--proto-mdns-text)', fontWeight: 700 }}>{t('cmd.mdnsResponder')}</span>
            <button 
              onClick={() => (node.joinedGroups || []).includes('224.0.0.251') ? leaveMulticastGroup(node.id, '224.0.0.251') : joinMulticastGroup(node.id, '224.0.0.251')}
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
                border: 'none',
                background: (node.joinedGroups || []).includes('224.0.0.251') ? 'var(--proto-mdns)' : 'rgba(var(--ink), 0.1)',
                color: (node.joinedGroups || []).includes('224.0.0.251') ? 'var(--on-proto)' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {(node.joinedGroups || []).includes('224.0.0.251') ? t('state.enabled') : t('state.disabled')}
            </button>
          </div>
          
          {node.joinedGroups && node.joinedGroups.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid color-mix(in srgb, var(--proto-mdns) 10%, transparent)', paddingTop: '6px' }}>
              {node.joinedGroups.map(group => (
                <div key={group} style={{ fontSize: '11px', color: 'var(--proto-mdns-text)', background: 'color-mix(in srgb, var(--proto-mdns) 10%, transparent)', padding: '2px 4px', borderRadius: '4px' }}>{group}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
