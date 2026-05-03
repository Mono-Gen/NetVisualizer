import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface CanvasControlsProps {
  mode: 'DESIGN' | 'SIMULATE';
  isDeleteMode: boolean;
  isLinkMode: boolean;
  isInspectMode: boolean;
  linkingSourceId: string | null;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  mode,
  isDeleteMode,
  isLinkMode,
  isInspectMode,
  linkingSourceId,
  zoom,
  setZoom,
}) => {
  return (
    <>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 100 }}>
        <button onClick={(e) => { e.stopPropagation(); setZoom(zoom + 0.1); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }}>
          <ZoomIn size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setZoom(zoom - 0.1); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }}>
          <ZoomOut size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setZoom(1.0); }} className="btn btn-glass btn-small" style={{ borderRadius: '8px', padding: '8px' }}>
          <Maximize size={18} />
          <span style={{ fontSize: '10px', marginLeft: '4px' }}>{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      <div className="label-mono" style={{ 
        position: 'absolute',  top: '32px', left: '32px', color: 'white',
        background: 'rgba(59, 130, 246, 0.2)', padding: '8px 16px', borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)', backdropFilter: 'blur(4px)',
        fontSize: '12px', fontWeight: 600, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: '8px', zIndex: 5
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: mode === 'DESIGN' ? '#fbbf24' : '#22c55e', boxShadow: `0 0 10px ${mode === 'DESIGN' ? '#fbbf24' : '#22c55e'}` }} />
        {mode === 'DESIGN' ? (
          isDeleteMode ? 'ERASER MODE: SELECT ITEMS TO REMOVE' : 
          isLinkMode ? (linkingSourceId ? 'WIRING: SELECT TARGET NetNode' : 'WIRING MODE: SELECT START NetNode') : 
          'DESIGN MODE: ADD & ARRANGE COMPONENTS'
        ) : (
          isInspectMode ? 'INSPECT MODE: CLICK TO VIEW TABLES' : 'SIMULATION MODE: CLICK NODES TO START PACKETS'
        )}
      </div>
    </>
  );
};
