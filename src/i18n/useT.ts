import { useCallback } from 'react';
import { create } from 'zustand';
import { en, type DictKey } from './en';
import { ja } from './ja';
import { makeTranslate, type Lang, type Params, type Msg } from './translate';
import { detectLang, saveLang } from './lang';
import { translateLogInfo } from './logTemplates';

const translate = makeTranslate({ en, ja });

/** 現在の言語。切り替えると、useT を使う全コンポーネントが再描画される */
export const useLangStore = create<{ lang: Lang; setLang: (lang: Lang) => void }>((set) => ({
  lang: detectLang(),
  setLang: (lang) => {
    saveLang(lang);
    try { document.documentElement.lang = lang; } catch { /* 非ブラウザ環境 */ }
    set({ lang });
  }
}));

/** コンポーネント用: キーの綴りミスはコンパイル時に検出される */
export const useT = () => {
  const lang = useLangStore(s => s.lang);
  return useCallback((key: DictKey, params?: Params) => translate(lang, key, params), [lang]);
};

/**
 * ログなど、生成時に言語を決められない文言を表示時に翻訳する。
 * キーが辞書に無ければ、保存してある英語の確定文(info)をそのまま使う。
 */
export const useTMsg = () => {
  const lang = useLangStore(s => s.lang);
  return useCallback((msg: { key?: string; params?: Params; info?: string }) => {
    if (msg.key && msg.key in en) return translate(lang, msg.key, msg.params);
    return msg.info ?? '';
  }, [lang]);
};

/** パケットログの英語の確定文を、現在の言語へ訳して返す */
export const useTLogInfo = () => {
  const lang = useLangStore(s => s.lang);
  return useCallback((info: string) => translateLogInfo(lang, info), [lang]);
};

export type { Msg };
