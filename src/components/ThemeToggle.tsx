import React, { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme, loadTheme, saveTheme, type ThemeMode } from '../theme/theme';

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'auto', label: 'Auto (follow system)', Icon: Monitor },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon }
];

/** 3択のテーマ切替。選択中は塗り+枠で示し、色だけに頼らない */
export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(loadTheme);

  const choose = (next: ThemeMode) => {
    setMode(next);
    applyTheme(next);
    saveTheme(next);
  };

  return (
    <div role="group" aria-label="Theme" style={{ display: 'flex', gap: '2px', padding: '2px', borderRadius: '8px', background: 'rgba(var(--shade), 0.2)', border: '1px solid var(--border-color)' }}>
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => choose(m)}
            title={label}
            aria-label={`Theme: ${label}`}
            aria-pressed={active}
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px', cursor: 'pointer',
              border: active ? '1px solid var(--c-blue-strong)' : '1px solid transparent',
              background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
};
