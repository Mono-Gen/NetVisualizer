import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Scan } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface CanvasControlsProps {
  mode: 'DESIGN' | 'SIMULATE';
  isInspectMode: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFit: () => void;
  isPaused: boolean;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  mode,
  isInspectMode,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFit,
  isPaused,
}) => {
  const t = useT();
  return (
    <>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 100 }}>
        <button onClick={(e) => { e.stopPropagation(); onZoomIn(); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }} title={t('view.zoomIn')} aria-label={t('view.zoomIn')}>
          <ZoomIn size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onZoomOut(); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }} title={t('view.zoomOut')} aria-label={t('view.zoomOut')}>
          <ZoomOut size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onZoomReset(); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }} title={t('view.zoomReset')} aria-label={t('view.zoomReset')}>
          <Maximize size={18} />
          <span style={{ fontSize: '11px', marginLeft: '4px' }}>{Math.round(zoom * 100)}%</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onFit(); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px', gap: '6px' }} title={t('view.fitTitle')} aria-label={t('view.fitTitle')}>
          <Scan size={18} />
          <span style={{ fontSize: '11px' }}>{t('view.fit')}</span>
        </button>
      </div>

      <div className="label-mono" style={{ 
        position: 'absolute',  top: '32px', left: '32px', color: 'var(--text-main)',
        background: 'rgba(59, 130, 246, 0.2)', padding: '8px 16px', borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)', backdropFilter: 'blur(4px)',
        fontSize: '12px', fontWeight: 600, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: '8px', zIndex: 5
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: mode === 'DESIGN' ? 'var(--c-yellow)' : 'var(--c-green-strong)', boxShadow: `0 0 10px ${mode === 'DESIGN' ? 'var(--c-yellow)' : 'var(--c-green-strong)'}` }} />
        {mode === 'DESIGN' ? (
          t('banner.design')
        ) : (
          isInspectMode ? t('banner.inspect') : t('banner.simulate')
        )}
        {mode === 'SIMULATE' && isPaused && (
          <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(251, 191, 36, 0.25)', color: 'var(--c-yellow)', border: '1px solid rgba(251, 191, 36, 0.5)' }}>
            {t('banner.paused')}
          </span>
        )}
      </div>
    </>
  );
};
