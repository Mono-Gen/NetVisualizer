import React from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { SAMPLE_TOPOLOGIES } from '../../data/sampleTopologies';
import { useT } from '../../i18n/useT';
import type { DictKey } from '../../i18n/en';

/**
 * 空のキャンバスに出す初回案内。
 * Why: 初見の利用者は「何から始めればよいか」が分からないため、手順とサンプルへの入口を示す。
 */
export const WelcomeGuide: React.FC = () => {
  const t = useT();
  const loadTopology = useNetworkStore(s => s.loadTopology);

  const steps = [
    t('welcome.step1'),
    t('welcome.step2'),
    t('welcome.step3')
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
      <div style={{ pointerEvents: 'auto', maxWidth: '440px', padding: '24px', borderRadius: '16px', background: 'rgba(var(--panel-rgb), 0.85)', border: '1px solid rgba(var(--ink), 0.12)', backdropFilter: 'blur(8px)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '16px' }}>{t('welcome.title')}</h2>
        <ol style={{ margin: '0 0 16px', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.7, color: 'rgba(var(--ink), 0.85)' }}>
          {steps.map(s => <li key={s}>{s}</li>)}
        </ol>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>{t('welcome.or')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SAMPLE_TOPOLOGIES.map(s => (
            <button
              key={s.id}
              className="btn btn-glass"
              title={t(`sample.${s.id}.desc` as DictKey)}
              onClick={() => { const { nodes, links } = s.build(); loadTopology(nodes, links); }}
              style={{ justifyContent: 'flex-start', fontSize: '12px', textAlign: 'left' }}
            >
              {t(`sample.${s.id}.name` as DictKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
