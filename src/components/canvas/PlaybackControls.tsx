import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { SIM_SPEEDS } from '../../logic/simClock';
import { MAX_IN_FLIGHT_PACKETS } from '../../logic/simLimits';
import { useT } from '../../i18n/useT';

/**
 * シミュレーションの再生制御(一時停止・ステップ・速度)。SIMULATEモード専用。
 * Why: パケットは常に約1秒で届くため、初心者がARP→ICMPなどの順序を追い切れない。
 */
export const PlaybackControls: React.FC = () => {
  const t = useT();
  const { isPaused, simSpeed, packets, setPaused, setSimSpeed, stepSimulation } = useNetworkStore();

  // ステップは一時停止中かつ飛行中のパケットがあるときのみ有効
  const canStep = isPaused && packets.length > 0;
  const stepHint = !isPaused
    ? t('play.stepWhilePaused')
    : packets.length === 0
      ? t('play.stepNoPackets')
      : t('play.stepAdvance');

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '8px', zIndex: 100,
        padding: '8px', borderRadius: '12px',
        background: 'rgba(var(--panel-rgb), 0.85)', backdropFilter: 'blur(8px)',
        border: `1px solid ${isPaused ? 'rgba(251, 191, 36, 0.6)' : 'rgba(var(--ink), 0.1)'}`
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setPaused(!isPaused); }}
        className={`btn ${isPaused ? 'btn-primary' : 'btn-glass'}`}
        style={btnStyle}
        title={isPaused ? t('play.resume') : t('play.pause')}
        aria-label={isPaused ? t('play.resumeAria') : t('play.pauseAria')}
      >
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
        {isPaused ? t('play.resume') : t('play.pause')}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); stepSimulation(); }}
        disabled={!canStep}
        className="btn btn-glass"
        style={{ ...btnStyle, opacity: canStep ? 1 : 0.4, cursor: canStep ? 'pointer' : 'not-allowed' }}
        title={stepHint}
        aria-label={t('play.stepAria')}
      >
        <SkipForward size={16} />
        {t('play.step')}
      </button>

      <span className="label-mono" style={{ fontSize: '12px', color: packets.length >= MAX_IN_FLIGHT_PACKETS ? 'var(--c-red)' : 'var(--text-dim)' }} title={t('play.inFlightTitle')}>
        {t('play.inFlight', { n: packets.length, max: MAX_IN_FLIGHT_PACKETS })}
      </span>

      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
        {t('play.speed')}
        <select
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          aria-label={t('play.speedAria')}
          style={{
            background: 'rgba(var(--shade), 0.3)', color: 'var(--text-main)', fontSize: '12px',
            border: '1px solid rgba(var(--ink), 0.15)', borderRadius: '6px', padding: '6px 8px'
          }}
        >
          {SIM_SPEEDS.map(s => (
            <option key={s} value={s} style={{ color: 'var(--text-main)', background: 'var(--node-bg)' }}>{s}x</option>
          ))}
        </select>
      </label>
    </div>
  );
};
