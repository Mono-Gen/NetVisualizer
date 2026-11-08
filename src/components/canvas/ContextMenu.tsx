import React, { useEffect, useRef } from 'react';
import type { MenuItem } from '../../logic/contextMenu';

interface ContextMenuProps {
  /** コンテナ左上を原点とした表示位置(画面px) */
  x: number;
  y: number;
  /** はみ出し補正に使うコンテナの大きさ */
  boundsWidth: number;
  boundsHeight: number;
  items: MenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 220;
const ROW_HEIGHT = 34;

/**
 * 右クリックのフローティングメニュー。
 * 閉じる条件: 項目選択 / Esc / メニュー外のクリック。先頭の有効項目へフォーカスし、矢印キーで移動できる。
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, boundsWidth, boundsHeight, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (buttons.length === 0) return;
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  // 画面端ではみ出さないよう位置を補正する(高さは項目数からの概算)
  const estHeight = items.length * ROW_HEIGHT + 16;
  const left = Math.max(4, Math.min(x, boundsWidth - MENU_WIDTH - 4));
  const top = Math.max(4, Math.min(y, boundsHeight - estHeight - 4));

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left, top, width: MENU_WIDTH, zIndex: 200, padding: '6px',
        background: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '2px',
        maxHeight: Math.max(120, boundsHeight - 16), overflowY: 'auto'
      }}
    >
      {items.map(item => {
        if (item.kind === 'header') {
          return <div key={item.key} style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>{item.label}</div>;
        }
        if (item.kind === 'separator') {
          return <div key={item.key} role="separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />;
        }
        return (
          <button
            key={item.key}
            role="menuitem"
            disabled={item.disabled}
            title={item.hint}
            onClick={() => { onClose(); item.run(); }}
            style={{
              textAlign: 'left', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: item.danger ? '#f87171' : 'white',
              opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onFocus={(e) => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
