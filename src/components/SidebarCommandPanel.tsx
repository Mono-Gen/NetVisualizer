import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import type { NetNode } from '../types/network';
import { Play, Search } from 'lucide-react';
import { useT } from '../i18n/useT';
import type { DictKey } from '../i18n/en';
import { commandAvailability, isIPv4, parsePort, tcpPhaseOf, type Availability, type TcpPhase } from '../logic/commandForm';

interface SidebarCommandPanelProps {
  node: NetNode;
}

const PHASE_GLYPH: Record<TcpPhase, string> = { none: '○', connecting: '◐', established: '●', closing: '◑' };
const PHASE_KEY: Record<TcpPhase, DictKey> = {
  none: 'cmd.tcp.phase.none', connecting: 'cmd.tcp.phase.connecting', established: 'cmd.tcp.phase.established', closing: 'cmd.tcp.phase.closing'
};

const sectionTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' };
const fieldLabel: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 };
const inputStyle: React.CSSProperties = { fontSize: '11px', padding: '6px 10px', height: '28px' };
const divider: React.CSSProperties = { height: '1px', background: 'rgba(var(--ink), 0.12)', margin: '4px 0' };

export const SidebarCommandPanel: React.FC<SidebarCommandPanelProps> = ({ node }) => {
  const t = useT();
  const { resolveAndPing, sendUDPMessage, startTCPHandshake, sendTCPData, closeTCPConnection, requestDHCP, sendmDNSQuery, joinMulticastGroup, leaveMulticastGroup } = useNetworkStore();
  const [targetIP, setTargetIP] = useState('');
  const [targetPort, setTargetPort] = useState('80');
  const [message, setMessage] = useState('Hello, Server!');

  const port = parsePort(targetPort);
  const phase = tcpPhaseOf(node, targetIP, port);
  const avail = commandAvailability({ dest: targetIP, port: targetPort, message, phase });

  const dest = targetIP.trim();
  const portInvalid = targetPort.trim() !== '' ? port === null : false;

  // 押せない理由は、ボタンのツールチップだけでなく、画面の文字としても出す
  const destHint: DictKey | null = !dest ? 'cmd.need.ip' : (port === null ? 'cmd.need.port' : null);
  const ipv4Note: DictKey | null = dest && !isIPv4(dest) ? 'cmd.need.ipv4' : null;
  const tcpHint: DictKey | null =
    dest && isIPv4(dest) && port !== null
      ? (phase === 'none' ? 'cmd.tcp.hintStart' : phase === 'established' ? 'cmd.tcp.hintEstablished' : phase === 'connecting' ? 'cmd.tcp.wait' : 'cmd.tcp.closing')
      : null;
  const udpHint: DictKey | null = avail.udp.reason === 'cmd.need.message' ? 'cmd.need.message' : null;

  const reasonText = (a: Availability) => (a.reason ? t(a.reason) : undefined);

  const actionButton = (a: Availability, onClick: () => void, label: string, extra: React.CSSProperties = {}) => (
    <button
      className="btn btn-glass btn-small"
      disabled={!a.enabled}
      title={reasonText(a)}
      onClick={onClick}
      style={{ justifyContent: 'center', fontSize: '11px', height: '28px', opacity: a.enabled ? 1 : 0.45, cursor: a.enabled ? 'pointer' : 'not-allowed', ...extra }}
    >
      {label}
    </button>
  );

  const hintLine = (key: DictKey | null, tone: 'dim' | 'error' = 'dim') =>
    key ? <div role="status" style={{ fontSize: '11px', lineHeight: 1.4, color: tone === 'error' ? 'var(--c-red)' : 'var(--text-dim)' }}>ⓘ {t(key)}</div> : null;

  return (
    <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(var(--ink), 0.06)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.12)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={sectionTitle}>
        <Play size={12} /> {t('cmd.commandFor', { name: node.label.toUpperCase() })}
      </span>

      {/* 宛先: Ping / UDP / TCP で共通 */}
      <span style={{ ...sectionTitle, color: 'var(--text-dim)' }}>{t('cmd.dest')}</span>
      <label style={fieldLabel} htmlFor="cmd-dest">{t('cmd.destIp')}</label>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          id="cmd-dest"
          className="input"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          placeholder={t('cmd.ipPlaceholder')}
          value={targetIP}
          onChange={(e) => setTargetIP(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && avail.ping.enabled) resolveAndPing(node.id, targetIP); }}
        />
        {actionButton(avail.ping, () => resolveAndPing(node.id, targetIP), 'Ping', { width: '64px', flexShrink: 0, background: avail.ping.enabled ? 'var(--proto-icmp)' : undefined, color: avail.ping.enabled ? 'var(--on-proto)' : undefined })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={fieldLabel} htmlFor="cmd-port">{t('cmd.destPort')}</label>
        <input
          id="cmd-port"
          className="input"
          type="number"
          min={1}
          max={65535}
          aria-invalid={portInvalid}
          value={targetPort}
          onChange={e => setTargetPort(e.target.value)}
          style={{ ...inputStyle, padding: '6px', width: '80px', flexShrink: 0, borderColor: portInvalid ? 'var(--c-red)' : undefined }}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t('cmd.portHint')}</span>
      </div>
      {hintLine(destHint, portInvalid ? 'error' : 'dim')}
      {hintLine(ipv4Note)}

      <div style={divider} />

      {/* メッセージ: UDP / TCP で共通 */}
      <label style={fieldLabel} htmlFor="cmd-message">{t('cmd.message')}</label>
      <input
        id="cmd-message"
        className="input"
        value={message}
        onChange={e => setMessage(e.target.value)}
        style={inputStyle}
      />

      {/* UDP: 接続なし。1回押すと1回送る */}
      <span style={{ ...sectionTitle, color: 'var(--proto-udp-text)' }}>{t('cmd.udp.title')}</span>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4, marginTop: '-4px' }}>{t('cmd.udp.desc')}</div>
      {actionButton(avail.udp, () => { if (port !== null) sendUDPMessage(node.id, dest, port, message); }, t('cmd.udpSend'), { borderColor: 'var(--proto-udp)', color: 'var(--proto-udp-text)' })}
      {hintLine(udpHint)}

      {/* TCP: 接続 → 送信 → 切断 の順。状態に応じて押せるボタンが変わる */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ ...sectionTitle, color: 'var(--proto-tcp-text)' }}>{t('cmd.tcp.title')}</span>
        <span className="label-mono" style={{ fontSize: '11px', color: phase === 'established' ? 'var(--proto-tcp-text)' : 'var(--text-dim)', fontWeight: 700 }} aria-live="polite">
          {PHASE_GLYPH[phase]} {t(PHASE_KEY[phase])}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4, marginTop: '-4px' }}>{t('cmd.tcp.desc')}</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {actionButton(avail.tcpConnect, () => { if (port !== null) startTCPHandshake(node.id, dest, port); }, t('cmd.step.connect'), { flex: 1, padding: 0, borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)' })}
        {actionButton(avail.tcpSend, () => { if (port !== null) sendTCPData(node.id, dest, port, message); }, t('cmd.step.send'), { flex: 1, padding: 0, borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)' })}
        {actionButton(avail.tcpClose, () => { if (port !== null) closeTCPConnection(node.id, dest, port); }, t('cmd.step.close'), { flex: 1, padding: 0, borderColor: 'var(--proto-tcp)', color: 'var(--proto-tcp-text)' })}
      </div>
      {hintLine(tcpHint)}

      <div style={divider} />

      {/* Network Services / Multicast */}
      <span style={sectionTitle}>
        <Search size={12} /> {t('cmd.services')}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => requestDHCP(node.id)}
            className="btn btn-glass"
            style={{ flex: 1, minWidth: 0, fontSize: '11px', minHeight: '28px', padding: '4px 6px', whiteSpace: 'normal', lineHeight: 1.2, borderColor: 'var(--proto-dhcp)', color: 'var(--proto-dhcp-text)' }}
          >
            {t('cmd.dhcpRenew')}
          </button>
          <button
            onClick={() => sendmDNSQuery(node.id, targetIP || 'Web Server')}
            className="btn btn-glass"
            style={{ flex: 1, minWidth: 0, fontSize: '11px', minHeight: '28px', padding: '4px 6px', whiteSpace: 'normal', lineHeight: 1.2, borderColor: 'var(--proto-mdns)', color: 'var(--proto-mdns-text)' }}
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
