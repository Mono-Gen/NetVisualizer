import React, { useEffect, useRef } from 'react';
import { PORT_SIZE } from '../../logic/portLayout';

interface PortHandleProps {
  /** ノード左上を原点とした円の中心座標 */
  cx: number;
  cy: number;
  name: string;
  tooltip: string;
  used: boolean;
  isWireSource: boolean;
  /** 配線ドラッグ中に、この(空き)ポートが接続先候補か */
  isCandidate: boolean;
  /** 配線ドラッグ中に、接続不可(使用中)として弱く表示するか */
  isBlocked: boolean;
  interactive: boolean;
  onStart: () => void;
}

/**
 * 1つのポート。形・塗り・枠線の違いで状態を示す(色だけに頼らない):
 *  - 空き: 中抜きの円 / 使用中: 塗りつぶしの円 / 配線元: 太い枠 / 候補: 二重リング / 不可: 破線
 */
export const PortHandle: React.FC<PortHandleProps> = ({
  cx, cy, name, tooltip, used, isWireSource, isCandidate, isBlocked, interactive, onStart
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // framer-motion のパン検出は親要素のネイティブ pointerdown を使うため、
  // ReactのstopPropagationでは間に合わない。ポート側のネイティブリスナーで伝播を止める。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: PointerEvent) => {
      e.stopPropagation();
      if (!interactive || e.button !== 0) return;
      e.preventDefault();
      onStart();
    };
    el.addEventListener('pointerdown', handler);
    return () => el.removeEventListener('pointerdown', handler);
  }, [interactive, onStart]);

  const border = isWireSource ? '3px solid #f97316'
    : isCandidate ? '2px solid #22c55e'
    : isBlocked ? '2px dashed #64748b'
    : `2px solid ${used ? '#60a5fa' : '#94a3b8'}`;

  return (
    <div
      ref={ref}
      title={tooltip}
      aria-label={`${name} ${used ? 'connected' : 'free'}`}
      style={{
        position: 'absolute',
        left: cx - PORT_SIZE / 2, top: cy - PORT_SIZE / 2,
        width: PORT_SIZE, height: PORT_SIZE, borderRadius: '50%',
        boxSizing: 'border-box',
        background: used ? '#60a5fa' : '#0f172a',
        border,
        boxShadow: isCandidate ? '0 0 0 3px rgba(34,197,94,0.35), 0 0 10px #22c55e' : 'none',
        opacity: isBlocked ? 0.4 : 1,
        cursor: interactive ? (used ? 'not-allowed' : 'crosshair') : 'default',
        zIndex: 40, touchAction: 'none'
      }}
    />
  );
};
