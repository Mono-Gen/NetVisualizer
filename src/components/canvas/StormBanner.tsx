import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { MAX_IN_FLIGHT_PACKETS } from '../../logic/simLimits';

/**
 * ブロードキャストストームの警告。
 * Why: 初心者が「何が起きたのか」「どうすれば止まるのか」を画面上で理解できるよう、原因と対処を示す。
 */
export const StormBanner: React.FC = () => {
  const { stormActive, stormDropped, packets, clearPackets } = useNetworkStore();
  if (!stormActive) return null;

  return (
    <div
      role="alert"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: '84px', left: '50%', transform: 'translateX(-50%)', zIndex: 110,
        width: 'min(560px, 90%)', padding: '12px 16px', borderRadius: '10px',
        background: 'rgba(127, 29, 29, 0.92)', border: '1px solid rgba(248, 113, 113, 0.7)',
        color: '#fecaca', fontSize: '12px', lineHeight: 1.5
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
        <AlertTriangle size={16} /> Broadcast storm
      </div>
      <div>
        Switches are passing the same broadcast to each other around a loop, so the number of packets keeps growing
        ({packets.length} in flight, limit {MAX_IN_FLIGHT_PACKETS}; {stormDropped} discarded to keep the app responsive).
        Pause to look at the switches' MAC tables flip between ports. To stop it, remove one cable of the loop (Design mode), or:
      </div>
      <button onClick={clearPackets} className="btn btn-glass btn-small" style={{ marginTop: '8px', fontSize: '12px' }}>
        Clear all packets
      </button>
    </div>
  );
};
