import React from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { SAMPLE_TOPOLOGIES } from '../../data/sampleTopologies';

/**
 * 空のキャンバスに出す初回案内。
 * Why: 初見の利用者は「何から始めればよいか」が分からないため、手順とサンプルへの入口を示す。
 */
export const WelcomeGuide: React.FC = () => {
  const loadTopology = useNetworkStore(s => s.loadTopology);

  const steps = [
    'Drag a device from the left panel onto the canvas',
    'Drag from one port (small circle) to another to connect them with a cable',
    'Switch to Simulate, select a PC, and send a ping'
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
      <div style={{ pointerEvents: 'auto', maxWidth: '440px', padding: '24px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '16px' }}>Build your first network</h2>
        <ol style={{ margin: '0 0 16px', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>
          {steps.map(s => <li key={s}>{s}</li>)}
        </ol>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>Or start from a ready-made example:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SAMPLE_TOPOLOGIES.map(s => (
            <button
              key={s.id}
              className="btn btn-glass"
              title={s.description}
              onClick={() => { const { nodes, links } = s.build(); loadTopology(nodes, links); }}
              style={{ justifyContent: 'flex-start', fontSize: '12px', textAlign: 'left' }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
