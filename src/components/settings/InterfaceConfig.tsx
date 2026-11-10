import React from 'react';
import type { NetNode, NetInterface } from '../../types/network';
import { useNetworkStore } from '../../store/useNetworkStore';
import { PORT_LIMITS, canChangePortCount } from '../../logic/interfaceFactory';
import { DEFAULT_METRIC } from '../../logic/networkUtils';
import { isSviMode } from '../../logic/svi';
import { interfaceIssues, type IfaceIssues } from '../../logic/ipValidation';
import type { DictKey } from '../../i18n/en';
import { useT } from '../../i18n/useT';

interface InterfaceConfigProps {
  node: NetNode;
  mode: 'DESIGN' | 'SIMULATE';
  onUpdate: (id: string, updates: Partial<NetNode>) => void;
}

const ISSUE_FIELD_LABEL: Record<keyof IfaceIssues, DictKey> = { ip: 'iface.ip', subnet: 'iface.subnet', gateway: 'iface.gateway', dns: 'iface.dns' };

/** 入力の問題を、「どの欄が・何が悪く・どうすればよいか」の文で一覧にする。赤だけに頼らず、記号と文字で示す */
const IssueList: React.FC<{ issues: IfaceIssues; t: (key: DictKey) => string }> = ({ issues, t }) => {
  const rows = (Object.keys(issues) as (keyof IfaceIssues)[]).filter(k => issues[k]);
  if (rows.length === 0) return null;
  return (
    <ul role="status" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {rows.map(k => (
        <li key={k} style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--c-red)' }}>
          ⚠ <strong>{t(ISSUE_FIELD_LABEL[k])}</strong>: {t(issues[k] as DictKey)}
        </li>
      ))}
    </ul>
  );
};

export const InterfaceConfig: React.FC<InterfaceConfigProps> = ({ node, mode, onUpdate }) => {
  const t = useT();
  const { nodes, links, addInterface, removeInterface } = useNetworkStore();
  // 入力の間違いを指摘する(入力は止めない)。重複IPの判定のため、全機器を渡す
  const issueOf = (iface: NetInterface) => interfaceIssues(iface, nodes);
  const canHaveMultipleInterfaces = canChangePortCount(node.type);
  const limits = PORT_LIMITS[node.type];
  const isL3Node = ['pc', 'router', 'server', 'dns', 'l3switch'].includes(node.type) && !isSviMode(node);
  // NICが2つ以上のL3ノードでは、送信に使うNICを選ぶ規則(メトリックなど)が意味を持つ
  const isMultiNic = isL3Node && node.interfaces.length > 1;

  const handleInterfaceChange = (ifaceId: string, updates: Partial<NetInterface>) => {
    const updatedInterfaces = node.interfaces.map(i => i.id === ifaceId ? { ...i, ...updates } : i);
    onUpdate(node.id, { interfaces: updatedInterfaces });
  };

  const isLinked = (ifaceId: string) =>
    links.some(l => (l.from === node.id && l.fromInterfaceId === ifaceId) || (l.to === node.id && l.toInterfaceId === ifaceId));

  // 末尾から数えて最初の「未接続」ポートを削除する(ケーブルは抜けない安全な削除)
  const lastFreeIface = [...node.interfaces].reverse().find(i => !isLinked(i.id));
  const canRemoveFree = !!lastFreeIface && node.interfaces.length > limits.min;

  // 接続中のポートを消すとケーブルも抜ける。破壊的操作なので確認する。
  const handleRemove = (ifaceId: string, name: string) => {
    if (isLinked(ifaceId) && !window.confirm(t('iface.removeConfirm', { name }))) return;
    removeInterface(node.id, ifaceId);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>{t('iface.title')}</label>
        {canHaveMultipleInterfaces && mode === 'DESIGN' && (
          <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => lastFreeIface && removeInterface(node.id, lastFreeIface.id)} disabled={!canRemoveFree} title={canRemoveFree ? t('iface.removeFreeTitle', { name: lastFreeIface!.name }) : (node.interfaces.length <= limits.min ? t('iface.minPorts', { n: limits.min }) : t('iface.allConnected'))} className="btn btn-glass btn-small" style={{ fontSize: '11px' }}>
            {t('iface.removePort')}
          </button>
          <button onClick={() => addInterface(node.id)} disabled={node.interfaces.length >= limits.max} title={node.interfaces.length >= limits.max ? t('iface.maxPorts', { n: limits.max }) : t('iface.addPortTitle')} className="btn btn-glass btn-small" style={{ fontSize: '11px' }}>
            {t('iface.addPort', { n: node.interfaces.length, max: limits.max })}
          </button>
          </div>
        )}
      </div>
      
      {isSviMode(node) && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t('svi.portsNote')}</div>}

      {isMultiNic && (
        <details style={{ marginBottom: '10px', fontSize: '11px', color: 'var(--text-dim)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-main)' }}>{t('iface.ruleTitle')}</summary>
          <ol style={{ margin: '6px 0 0', paddingLeft: '18px', lineHeight: 1.6 }}>
            <li>{t('iface.rule1')}</li>
            <li>{t('iface.rule2')}</li>
            <li>{t('iface.rule3')}</li>
            <li>{t('iface.rule4')}</li>
          </ol>
          <div style={{ marginTop: '6px', lineHeight: 1.5 }}>{t('iface.ruleNote')}</div>
        </details>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {node.interfaces.map((iface) => (
          <div key={iface.id} style={{ padding: '12px', background: 'rgba(var(--ink), 0.02)', borderRadius: '8px', border: '1px solid rgba(var(--ink), 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="label-mono" style={{ fontSize: '11px', color: 'var(--primary-blue)', fontWeight: 700 }}>{iface.name}</span>
              {canHaveMultipleInterfaces && node.interfaces.length > limits.min && mode === 'DESIGN' && (
                <button 
                  onClick={() => handleRemove(iface.id, iface.name)}
                  style={{ background: 'none', border: 'none', color: 'rgba(248, 113, 113, 0.5)', cursor: 'pointer', fontSize: '11px' }}
                >
                  {t('iface.remove')}
                </button>
              )}
            </div>
            
            {isL3Node && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>{t('iface.ip')}</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px', borderColor: issueOf(iface).ip ? 'var(--c-red)' : undefined }}
                      aria-invalid={!!issueOf(iface).ip}
                      value={iface.ip} 
                      onChange={(e) => handleInterfaceChange(iface.id, { ip: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>{t('iface.subnet')}</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px', borderColor: issueOf(iface).subnet ? 'var(--c-red)' : undefined }}
                      aria-invalid={!!issueOf(iface).subnet}
                      value={iface.subnet} 
                      onChange={(e) => handleInterfaceChange(iface.id, { subnet: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>{t('iface.gateway')}</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px', borderColor: issueOf(iface).gateway ? 'var(--c-red)' : undefined }}
                      aria-invalid={!!issueOf(iface).gateway}
                      value={iface.gateway || ''} 
                      onChange={(e) => handleInterfaceChange(iface.id, { gateway: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>{t('iface.dns')}</label>
                    <input 
                      className="input" 
                      style={{ fontSize: '11px', padding: '6px', borderColor: issueOf(iface).dns ? 'var(--c-red)' : undefined }}
                      aria-invalid={!!issueOf(iface).dns}
                      value={iface.dns || ''} 
                      onChange={(e) => handleInterfaceChange(iface.id, { dns: e.target.value })}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                </div>

                <IssueList issues={issueOf(iface)} t={t} />

                {isMultiNic && (
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }} htmlFor={`metric-${iface.id}`}>{t('iface.metric')}</label>
                    <input
                      id={`metric-${iface.id}`}
                      className="input"
                      type="number"
                      min={0}
                      max={9999}
                      style={{ fontSize: '11px', padding: '6px' }}
                      value={iface.metric ?? DEFAULT_METRIC}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        handleInterfaceChange(iface.id, { metric: Number.isFinite(n) ? Math.min(9999, Math.max(0, n)) : undefined });
                      }}
                      disabled={mode === 'SIMULATE'}
                    />
                  </div>
                )}
              </>
            )}

            {node.type !== 'hub' && (
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label className="form-label" style={{ fontSize: '11px' }}>{t('iface.mac')}</label>
                <input 
                  className="input" 
                  style={{ fontSize: '11px', padding: '6px' }}
                  value={iface.mac} 
                  onChange={(e) => handleInterfaceChange(iface.id, { mac: e.target.value })}
                  disabled={mode === 'SIMULATE'}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
