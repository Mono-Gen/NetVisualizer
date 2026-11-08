import React from 'react';
import type { NetNode, NatConfig as NatState, NatEntry } from '../../types/network';
import { Trash2, Shuffle } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { natOutsideInterface } from '../../logic/nat';

interface NatConfigProps {
  node: NetNode;
  mode: string;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

const DEFAULT_NAT: NatState = { enabled: false, outsideInterfaceId: '' };

/** 1件の表示用に「IP:ポート」を作る。ICMPのポートは識別子なので "id" を付ける */
const endpoint = (ip: string, port: number, proto: NatEntry['protocol']): string =>
  proto === 'ICMP' ? `${ip} (id ${port})` : `${ip}:${port}`;

/**
 * ルーターのNAT設定と、変換表の表示。
 * 表示方針: 変換表は横長の表にせず、1件=3行のカードにする(内側 → 外側 → 宛先)。
 * 文字があふれないよう、flex の子に min-width:0、長い文字列は折り返し、全文は title で見せる。
 * 件数が多くても、一覧に最大高さを付けて、パネル全体が伸びないようにする。
 */
export const NatConfig: React.FC<NatConfigProps> = ({ node, mode, onUpdate }) => {
  const t = useT();
  const nat: NatState = node.nat || DEFAULT_NAT;
  const outside = natOutsideInterface(node);
  const table = node.natTable || [];

  const save = (next: NatState) => onUpdate(node.id, { nat: next });
  const outsideIface = node.interfaces.find(i => i.id === nat.outsideInterfaceId);

  const warn = nat.enabled
    ? (!outsideIface ? t('nat.noOutside') : !outsideIface.ip ? t('nat.outsideNoIp') : null)
    : null;

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(var(--ink), 0.03)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.05)', minWidth: 0 }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Shuffle size={16} /> {t('nat.title')}
      </label>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('nat.desc')}</div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
        <input type="checkbox" checked={nat.enabled} onChange={e => save({ ...nat, enabled: e.target.checked })} />
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t('nat.enable')}</span>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t('nat.outside')}</span>
        <select className="input" style={{ fontSize: '11px', padding: '6px', minWidth: 0, width: '100%' }}
          value={nat.outsideInterfaceId} aria-label={t('nat.outside')}
          onChange={e => save({ ...nat, outsideInterfaceId: e.target.value })}>
          <option value="">{t('nat.choose')}</option>
          {node.interfaces.map(i => (
            <option key={i.id} value={i.id}>{i.name}{i.ip ? ` (${i.ip})` : ''}</option>
          ))}
        </select>
      </div>

      {warn && (
        <div style={{ fontSize: '11px', color: 'var(--c-red)', lineHeight: 1.5, overflowWrap: 'anywhere', marginBottom: '8px' }}>⚠ {warn}</div>
      )}

      {mode === 'SIMULATE' && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{t('nat.table')} ({table.length})</span>
            <button className="btn-icon" style={{ padding: '4px', height: 'auto', width: 'auto', flex: '0 0 auto' }}
              title={t('nat.clear')} aria-label={t('nat.clear')} disabled={table.length === 0}
              onClick={() => onUpdate(node.id, { natTable: [] })}>
              <Trash2 size={12} />
            </button>
          </div>
          {table.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', overflowWrap: 'anywhere' }}>{t('nat.empty')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
              {table.map((e, i) => {
                const inside = endpoint(e.insideIP, e.insidePort, e.protocol);
                const out = endpoint(outside?.ip ?? '?', e.outsidePort, e.protocol);
                const remote = endpoint(e.remoteIP, e.remotePort, 'TCP');
                const remoteText = e.protocol === 'ICMP' ? e.remoteIP : remote;
                const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: '11px', minWidth: 0, overflowWrap: 'anywhere' };
                return (
                  <div key={`${e.protocol}-${e.outsidePort}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(var(--shade), 0.2)', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, flex: '0 0 auto' }}>{e.protocol}</span>
                      <span style={mono} title={inside}>{inside}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', minWidth: 0 }}>
                      <span style={{ flex: '0 0 auto', opacity: 0.6 }}>→</span>
                      <span style={mono} title={out}>{out}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', minWidth: 0, color: 'var(--text-dim)' }}>
                      <span style={{ fontSize: '11px', flex: '0 0 auto' }}>{t('nat.remote')}</span>
                      <span style={mono} title={remoteText}>{remoteText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
