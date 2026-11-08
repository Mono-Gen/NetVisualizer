import React from 'react';
import { FolderOpen } from 'lucide-react';
import { useNetworkStore } from '../store/useNetworkStore';
import { SAMPLE_TOPOLOGIES } from '../data/sampleTopologies';
import { useT } from '../i18n/useT';
import type { DictKey } from '../i18n/en';

/**
 * サンプルトポロジーの読込メニュー。
 * 読込は現在のキャンバスを置き換える破壊的操作なので、既存の構成があるときは確認する。
 */
export const SampleMenu: React.FC = () => {
  const t = useT();
  const { nodes, loadTopology } = useNetworkStore();

  const handleLoad = (sampleId: string) => {
    const sample = SAMPLE_TOPOLOGIES.find(s => s.id === sampleId);
    if (!sample) return;
    if (nodes.length > 0 && !window.confirm(t('sample.confirmLoad', { name: t(`sample.${sample.id}.name` as DictKey) }))) return;
    const { nodes: newNodes, links: newLinks } = sample.build();
    loadTopology(newNodes, newLinks);
  };

  return (
    <details style={{ fontSize: '12px' }}>
      <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', padding: '4px 0', listStyle: 'none' }}>
        <FolderOpen size={14} /> {t('sample.load')}
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {SAMPLE_TOPOLOGIES.map(s => (
          <button
            key={s.id}
            onClick={() => handleLoad(s.id)}
            className="btn btn-glass"
            title={t(`sample.${s.id}.desc` as DictKey)}
            style={{ justifyContent: 'flex-start', fontSize: '12px', textAlign: 'left', height: 'auto', padding: '8px 10px' }}
          >
            {t(`sample.${s.id}.name` as DictKey)}
          </button>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t('sample.hint')}
        </div>
      </div>
    </details>
  );
};
