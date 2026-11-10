import React, { useEffect, useState } from 'react';
import type { NetNode, Svi } from '../../types/network';
import { Layers } from 'lucide-react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { useT } from '../../i18n/useT';
import { isValidVlanId } from '../../logic/vlan';
import { createSvi, sviIssue, sviName, type SviIssue } from '../../logic/svi';
import type { DictKey } from '../../i18n/en';

interface SviConfigProps {
  node: NetNode;
}

const ISSUE_KEY: Record<SviIssue, DictKey> = {
  vlanInvalid: 'svi.vlanInvalid',
  vlanDuplicate: 'svi.vlanDuplicate',
  ipInvalid: 'ip.invalid',
  ipDuplicate: 'ip.duplicate',
  ipReserved: 'ip.reserved',
  maskInvalid: 'mask.invalid'
};

/**
 * L3スイッチのSVI(VLANごとのアドレス)の設定。
 * 表示方針: 1つのSVI=1枚のカード。min-width:0 と折り返しで、狭い幅でも文字があふれないようにする。
 * 入力は止めず、間違っている箇所に「何が・なぜ・どうすれば」を含む文を出す。
 * VLAN番号は、正しい値(1〜4094の整数で、他のSVIと重ならない)になったときだけ反映する。
 */
const SviRow: React.FC<{ node: NetNode; svi: Svi; allNodes: NetNode[]; onChange: (patch: Partial<Svi>) => void; onRemove: () => void }> = ({ node, svi, allNodes, onChange, onRemove }) => {
  const t = useT();
  const [text, setText] = useState(String(svi.vlan));
  useEffect(() => { setText(String(svi.vlan)); }, [svi.vlan, svi.id]);

  const typed = Number(text);
  const typedValid = text.trim() !== '' && isValidVlanId(typed);
  const typedDuplicate = typedValid && (node.svis || []).some(s => s.id !== svi.id && s.vlan === typed);
  const vlanIssue: SviIssue | null = !typedValid ? 'vlanInvalid' : typedDuplicate ? 'vlanDuplicate' : null;
  // IP・マスクの指摘は、保存済みの値に対して出す(VLAN番号の指摘は別に出すので除く)
  const issue = sviIssue(svi, node, allNodes);
  const ipMaskIssue = issue && issue !== 'vlanInvalid' && issue !== 'vlanDuplicate' ? issue : null;
  // 空欄は「未設定」。入力途中の指摘で騒がない
  const shownIp = svi.ip.trim() === '' ? null : ipMaskIssue;
  const label = sviName(svi);

  const field = (title: string, value: string, onValue: (v: string) => void, bad: boolean, extra?: React.CSSProperties) => (
    <div style={{ flex: '1 1 110px', minWidth: 0, ...extra }}>
      <label className="form-label" style={{ fontSize: '11px' }}>{title}</label>
      <input className="input" style={{ fontSize: '11px', padding: '6px', width: '100%', borderColor: bad ? 'var(--c-red)' : undefined }}
        aria-invalid={bad} aria-label={`${label} ${title}`} value={value} onChange={e => onValue(e.target.value)} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '8px', background: 'rgba(var(--shade), 0.2)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span className="label-mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-blue)' }}>{label}</span>
        <button onClick={onRemove} className="btn btn-glass btn-small" style={{ fontSize: '11px' }}>{t('svi.remove')}</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
        {field(t('svi.vlan'), text, v => {
          const d = v.replace(/\D/g, '').slice(0, 4);
          setText(d);
          const n = Number(d);
          if (d !== '' && isValidVlanId(n) && !(node.svis || []).some(s => s.id !== svi.id && s.vlan === n)) onChange({ vlan: n });
        }, !!vlanIssue, { flex: '0 0 64px' })}
        {field(t('svi.ip'), svi.ip, v => onChange({ ip: v }), shownIp === 'ipInvalid' || shownIp === 'ipDuplicate' || shownIp === 'ipReserved')}
        {field(t('svi.mask'), svi.subnet, v => onChange({ subnet: v }), shownIp === 'maskInvalid')}
      </div>
      {vlanIssue && <div style={{ fontSize: '11px', color: 'var(--c-red)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>⚠ {t(ISSUE_KEY[vlanIssue])}</div>}
      {shownIp && <div style={{ fontSize: '11px', color: 'var(--c-red)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>⚠ {t(ISSUE_KEY[shownIp])}</div>}
      <div className="label-mono" style={{ fontSize: '11px', color: 'var(--text-dim)', overflowWrap: 'anywhere' }} title={t('svi.mac')}>{svi.mac}</div>
    </div>
  );
};

export const SviConfig: React.FC<SviConfigProps> = ({ node }) => {
  const t = useT();
  const nodes = useNetworkStore(s => s.nodes) as NetNode[];
  const updateNode = useNetworkStore(s => s.updateNode) as (id: string, u: Partial<NetNode>) => void;
  const svis = node.svis || [];
  const setSvis = (next: Svi[]) => updateNode(node.id, { svis: next });

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(var(--ink), 0.03)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.05)', minWidth: 0 }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Layers size={16} /> {t('svi.title')}
      </label>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('svi.desc')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {svis.length === 0 && <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('svi.none')}</div>}
        {svis.map(s => (
          <SviRow key={s.id} node={node} svi={s} allNodes={nodes}
            onChange={patch => setSvis(svis.map(x => x.id === s.id ? { ...x, ...patch } : x))}
            onRemove={() => setSvis(svis.filter(x => x.id !== s.id))} />
        ))}
      </div>
      <button className="btn btn-glass btn-small" style={{ fontSize: '11px', marginTop: '10px' }}
        onClick={() => setSvis([...svis, createSvi(node, nodes)])}>{t('svi.add')}</button>
    </div>
  );
};
