import React from 'react';
import { Languages } from 'lucide-react';
import { useLangStore, useT } from '../i18n/useT';
import type { Lang } from '../i18n/translate';

const OPTIONS: { lang: Lang; label: string; aria: string }[] = [
  { lang: 'ja', label: '日本語', aria: '日本語' },
  { lang: 'en', label: 'EN', aria: 'English' }
];

/** 日本語/英語の2択切替。選択中は塗り+枠で示す。言語名は、切替先が分かるよう各言語の表記のまま */
export const LanguageToggle: React.FC = () => {
  const t = useT();
  const { lang, setLang } = useLangStore();

  return (
    <div role="group" aria-label={t('lang.group')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Languages size={14} color="var(--text-dim)" aria-hidden="true" />
      <div style={{ display: 'flex', gap: '2px', padding: '2px', borderRadius: '8px', background: 'rgba(var(--shade), 0.2)', border: '1px solid var(--border-color)' }}>
        {OPTIONS.map(o => {
          const active = lang === o.lang;
          return (
            <button
              key={o.lang}
              onClick={() => setLang(o.lang)}
              aria-pressed={active}
              aria-label={o.aria}
              title={o.aria}
              style={{
                minWidth: '34px', height: '28px', padding: '0 8px', fontSize: '11px', fontWeight: 700,
                borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)',
                border: active ? '1px solid var(--c-blue-strong)' : '1px solid transparent',
                background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent'
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
