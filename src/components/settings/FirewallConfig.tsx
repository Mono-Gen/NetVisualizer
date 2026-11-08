import React from 'react';
import type { NetNode, FwRule, FirewallConfig as FirewallState } from '../../types/network';
import { ArrowUp, ArrowDown, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { DEFAULT_FIREWALL, fwRuleIssue } from '../../logic/firewall';
import { generateId } from '../../logic/networkUtils';

interface FirewallConfigProps {
  node: NetNode;
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

/**
 * ルーターのファイアウォール設定。
 * 表示方針: ルール1件を2行のカードにする(横長の表にしない)。
 * 1行目 = 動作・プロトコル・ポート、2行目 = 送信元 → 宛先。
 * 狭い幅でも文字があふれないよう、flex の子には min-width:0 を付ける。
 */
const cardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', borderRadius: '8px',
  background: 'rgba(var(--shade), 0.2)', minWidth: 0
};
const rowStyle: React.CSSProperties = { display: 'flex', gap: '6px', alignItems: 'center', minWidth: 0 };
const fieldStyle: React.CSSProperties = { fontSize: '11px', padding: '6px', minWidth: 0, width: '100%' };

export const FirewallConfig: React.FC<FirewallConfigProps> = ({ node, onUpdate }) => {
  const t = useT();
  const fw: FirewallState = node.firewall || DEFAULT_FIREWALL;

  const save = (next: FirewallState) => onUpdate(node.id, { firewall: next });
  const setRule = (i: number, patch: Partial<FwRule>) =>
    save({ ...fw, rules: fw.rules.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fw.rules.length) return;
    const rules = [...fw.rules];
    [rules[i], rules[j]] = [rules[j], rules[i]];
    save({ ...fw, rules });
  };
  const remove = (i: number) => save({ ...fw, rules: fw.rules.filter((_, k) => k !== i) });
  const add = () => save({
    ...fw,
    rules: [...fw.rules, { id: generateId('fw_'), action: 'deny', protocol: 'any', src: 'any', dst: 'any' }]
  });

  const actionColor = (a: 'allow' | 'deny') => (a === 'allow' ? 'var(--c-green, #4ade80)' : 'var(--c-red)');

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(var(--ink), 0.03)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.05)', minWidth: 0 }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <ShieldCheck size={16} /> {t('fw.title')}
      </label>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('fw.desc')}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {fw.rules.length === 0 && (
          <div style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('fw.noRules')}</div>
        )}
        {fw.rules.map((r, i) => {
          const issue = fwRuleIssue(r);
          const portAllowed = r.protocol === 'TCP' || r.protocol === 'UDP';
          return (
            <div key={r.id} style={{ ...cardStyle, outline: issue ? '1px solid var(--c-red)' : undefined }}>
              <div style={rowStyle}>
                <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.6, flex: '0 0 auto' }}>{i + 1}</span>
                <select className="input" style={{ ...fieldStyle, flex: '1 1 0', color: actionColor(r.action), fontWeight: 700 }}
                  value={r.action} onChange={e => setRule(i, { action: e.target.value as FwRule['action'] })} aria-label={t('fw.allow') + '/' + t('fw.deny')}>
                  <option value="allow">{t('fw.allow')}</option>
                  <option value="deny">{t('fw.deny')}</option>
                </select>
                <select className="input" style={{ ...fieldStyle, flex: '1 1 0' }} value={r.protocol} aria-label={t('fw.protocol')}
                  onChange={e => setRule(i, { protocol: e.target.value as FwRule['protocol'] })}>
                  <option value="any">{t('fw.any')}</option>
                  <option value="ICMP">ICMP</option>
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                </select>
                <input className="input" style={{ ...fieldStyle, flex: '1 1 0' }} inputMode="numeric" aria-label={t('fw.dstPort')}
                  placeholder={t('fw.portPlaceholder')} value={r.dstPort ?? ''} disabled={!portAllowed && r.dstPort === undefined}
                  title={t('fw.dstPort')}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setRule(i, { dstPort: v === '' ? undefined : Number(v) });
                  }} />
              </div>
              <div style={rowStyle}>
                <input className="input" style={{ ...fieldStyle, flex: '1 1 0', fontFamily: 'monospace' }} value={r.src} title={r.src}
                  aria-label={t('fw.src')} placeholder={t('fw.src')} onChange={e => setRule(i, { src: e.target.value })} />
                <span style={{ flex: '0 0 auto', opacity: 0.6 }}>→</span>
                <input className="input" style={{ ...fieldStyle, flex: '1 1 0', fontFamily: 'monospace' }} value={r.dst} title={r.dst}
                  aria-label={t('fw.dst')} placeholder={t('fw.dst')} onChange={e => setRule(i, { dst: e.target.value })} />
              </div>
              <div style={{ ...rowStyle, justifyContent: 'flex-end', gap: '2px' }}>
                <button className="btn-icon" style={{ padding: '4px' }} title={t('fw.up')} aria-label={t('fw.up')} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button className="btn-icon" style={{ padding: '4px' }} title={t('fw.down')} aria-label={t('fw.down')} disabled={i === fw.rules.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button className="btn-icon" style={{ padding: '4px', color: 'rgba(248, 113, 113, 0.8)' }} title={t('fw.delete')} aria-label={t('fw.delete')} onClick={() => remove(i)}><Trash2 size={14} /></button>
              </div>
              {issue && <div style={{ fontSize: '11px', color: 'var(--c-red)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>⚠ {t(issue)}</div>}
            </div>
          );
        })}

        {/* 既定の動作: どのルールにも一致しないときの行を、常に末尾に見せる(暗黙の動きを見える形にする) */}
        <div style={{ ...cardStyle, border: '1px dashed rgba(var(--ink), 0.2)', background: 'transparent' }}>
          <div style={rowStyle}>
            <span style={{ fontSize: '11px', opacity: 0.6, flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>{t('fw.defaultRow')}</span>
            <select className="input" style={{ ...fieldStyle, flex: '0 0 40%', color: actionColor(fw.defaultAction), fontWeight: 700 }}
              value={fw.defaultAction} aria-label={t('fw.default')}
              onChange={e => save({ ...fw, defaultAction: e.target.value as FirewallState['defaultAction'] })}>
              <option value="allow">{t('fw.allow')}</option>
              <option value="deny">{t('fw.deny')}</option>
            </select>
          </div>
          {fw.defaultAction === 'deny' && (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('fw.defaultDenyHint')}</div>
          )}
        </div>
      </div>

      <button className="btn" style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={add}>
        <Plus size={14} /> {t('fw.add')}
      </button>
    </div>
  );
};
