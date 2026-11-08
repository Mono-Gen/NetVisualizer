import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { SIM_SPEEDS } from '../../logic/simClock';
import { MAX_IN_FLIGHT_PACKETS } from '../../logic/simLimits';

/**
 * シミュレーションの再生制御(一時停止・ステップ・速度)。SIMULATEモード専用。
 * Why: パケットは常に約1秒で届くため、初心者がARP→ICMPなどの順序を追い切れない。
 */
export const PlaybackControls: React.FC = () => {
  const { isPaused, simSpeed, packets, setPaused, setSimSpeed, stepSimulation } = useNetworkStore();

  // ステップは一時停止中かつ飛行中のパケットがあるときのみ有効
  const canStep = isPaused && packets.length > 0;
  const stepHint = !isPaused
    ? '一時停止中のみ使えます (Available while paused)'
    : packets.length === 0
      ? '進めるパケットがありません (No packets in flight)'
      : '次のパケット到着まで進めます (Advance to next arrival)';

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
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
        border: `1px solid ${isPaused ? 'rgba(251, 191, 36, 0.6)' : 'rgba(255,255,255,0.1)'}`
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setPaused(!isPaused); }}
        className={`btn ${isPaused ? 'btn-primary' : 'btn-glass'}`}
        style={btnStyle}
        title={isPaused ? '再開 (Resume)' : '一時停止 (Pause)'}
        aria-label={isPaused ? 'Resume simulation' : 'Pause simulation'}
      >
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
        {isPaused ? 'Resume' : 'Pause'}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); stepSimulation(); }}
        disabled={!canStep}
        className="btn btn-glass"
        style={{ ...btnStyle, opacity: canStep ? 1 : 0.4, cursor: canStep ? 'pointer' : 'not-allowed' }}
        title={stepHint}
        aria-label="Step to next packet arrival"
      >
        <SkipForward size={16} />
        Step
      </button>

      <span className="label-mono" style={{ fontSize: '12px', color: packets.length >= MAX_IN_FLIGHT_PACKETS ? '#f87171' : 'var(--text-dim)' }} title="Packets currently in flight (limit shown after the slash)">
        In flight: {packets.length}/{MAX_IN_FLIGHT_PACKETS}
      </span>

      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
        Speed
        <select
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          aria-label="Simulation speed"
          style={{
            background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '12px',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 8px'
          }}
        >
          {SIM_SPEEDS.map(s => (
            <option key={s} value={s} style={{ color: 'black' }}>{s}x</option>
          ))}
        </select>
      </label>
    </div>
  );
};
