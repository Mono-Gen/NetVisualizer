import React, { useEffect, useState } from 'react';
import type { NetNode, NetInterface } from '../../types/network';
import { Network } from 'lucide-react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { useT } from '../../i18n/useT';
import { VLAN_MIN, VLAN_MAX, isValidVlanId, vlanOfInterface, isTrunkInterface, portVlanWarnings, type PortVlanWarning } from '../../logic/vlan';

interface VlanConfigProps {
  node: NetNode;
}

/**
 * スイッチ/L3スイッチの、ポートごとのVLAN設定。
 * 表示方針: 1ポート=1枚のカード(横長の表にしない)。min-width:0 と折り返しで、狭い幅でも文字があふれないようにする。
 * 入力は途中の値を許し、正しい値(1〜4094の整数)になったときだけ反映する。
 */
const PortRow: React.FC<{ node: NetNode; iface: NetInterface; warning?: PortVlanWarning }> = ({ node, iface, warning }) => {
  const t = useT();
  const setPortVlan = useNetworkStore(s => (s as any).setPortVlan) as (n: string, i: string, v: number) => void;
  const setPortMode = useNetworkStore(s => (s as any).setPortMode) as (n: string, i: string, m: 'access' | 'trunk') => void;
  const trunk = isTrunkInterface(iface);
  const current = vlanOfInterface(iface);
  const [text, setText] = useState(String(current));
  useEffect(() => { setText(String(current)); }, [current, iface.id]);

  const parsed = Number(text);
  const invalid = !trunk && (text.trim() === '' || !isValidVlanId(parsed));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', borderRadius: '8px', background: 'rgba(var(--shade), 0.2)', minWidth: 0, outline: invalid ? '1px solid var(--c-red)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span className="label-mono" style={{ fontSize: '11px', flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }} title={iface.name}>{iface.name}</span>
        <select className="input" style={{ fontSize: '11px', padding: '6px', flex: '0 0 auto' }} value={trunk ? 'trunk' : 'access'}
          aria-label={`${iface.name} ${t('vlan.mode')}`} onChange={e => setPortMode(node.id, iface.id, e.target.value as 'access' | 'trunk')}>
          <option value="access">{t('vlan.modeAccess')}</option>
          <option value="trunk">{t('vlan.modeTrunk')}</option>
        </select>
        {!trunk && (
          <input className="input" style={{ fontSize: '11px', padding: '6px', width: '72px', flex: '0 0 auto' }} inputMode="numeric"
            aria-label={`${iface.name} ${t('vlan.id')}`} value={text}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setText(v);
              const n = Number(v);
              if (v !== '' && isValidVlanId(n)) setPortVlan(node.id, iface.id, n);
            }} />
        )}
      </div>
      {trunk && <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('vlan.trunkAll')}</div>}
      {invalid && <div style={{ fontSize: '11px', color: 'var(--c-red)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>⚠ {t('vlan.invalid')}</div>}
      {warning && (
        <div style={{ fontSize: '11px', color: 'var(--c-orange)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
          ⚠ {warning.kind === 'mismatch'
            ? t('vlan.mismatch', { peer: `${warning.peerLabel} ${warning.peerPort}`, vlan: String(warning.peerVlan), mine: String(current) })
            : warning.kind === 'modeMismatch'
              ? t('vlan.modeMismatch', { peer: `${warning.peerLabel} ${warning.peerPort}` })
              : t('vlan.trunkToHost', { peer: warning.peerLabel })}
        </div>
      )}
    </div>
  );
};

export const VlanConfig: React.FC<VlanConfigProps> = ({ node }) => {
  const t = useT();
  const nodes = useNetworkStore(s => s.nodes) as NetNode[];
  const links = useNetworkStore(s => s.links);
  const warnings = portVlanWarnings(node, nodes, links);

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(var(--ink), 0.03)', borderRadius: '12px', border: '1px solid rgba(var(--ink), 0.05)', minWidth: 0 }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Network size={16} /> {t('vlan.title')}
      </label>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        {t('vlan.desc', { min: String(VLAN_MIN), max: String(VLAN_MAX) })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {node.interfaces.map(i => <PortRow key={i.id} node={node} iface={i} warning={warnings[i.id]} />)}
      </div>
    </div>
  );
};
