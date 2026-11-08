import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { LEGEND_KEYS, PROTO_NAME, protoFill, protoText } from '../../logic/protocolColors';

const STORAGE_KEY = 'netvisualizer.legendHidden';

const readHidden = (): boolean => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

/**
 * パケットの色の凡例(色=プロトコル)。SIMULATEモードのキャンバス右下に出す。
 * 色だけに頼らないよう、各チップにプロトコル名の文字を併記する。
 */
export const ProtocolLegend: React.FC = () => {
  const t = useT();
  const [hidden, setHidden] = useState(readHidden);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* 保存できなくても動作する */ }
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', right: '20px', bottom: '20px', zIndex: 100, maxWidth: '260px',
        padding: '8px 10px', borderRadius: '12px', background: 'rgba(var(--panel-rgb), 0.85)',
        backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)'
      }}
    >
      <button
        onClick={toggle}
        aria-expanded={!hidden}
        className="btn-icon"
        title={hidden ? t('legend.show') : t('legend.hide')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', width: 'auto', height: 'auto', padding: '2px 4px', fontWeight: 700 }}
      >
        {hidden ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t('legend.title')}
      </button>
      {!hidden && (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {LEGEND_KEYS.map(key => (
            <li key={key} className="label-mono" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: protoText(key), fontWeight: 700 }}>
              <span aria-hidden="true" style={{ width: '10px', height: '10px', borderRadius: '50%', background: protoFill(key), border: '1.5px solid rgba(var(--shade), 0.55)' }} />
              {PROTO_NAME[key as Exclude<typeof key, 'other'>]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
