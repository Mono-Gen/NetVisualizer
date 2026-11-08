import type { Lang } from './translate';

/**
 * 言語の保存と初期値。
 * 初期値: 保存済みがあればそれ、無ければブラウザの言語(ja* なら日本語)。
 * Why: localStorage は無効・拒否される環境があるため、読み書きは try/catch して、使えなくても動作させる。
 */

const STORAGE_KEY = 'netvisualizer.lang';

export const detectLang = (): Lang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    // 読めない環境ではブラウザの言語設定にフォールバック
  }
  try {
    return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  } catch {
    return 'en';
  }
};

export const saveLang = (lang: Lang): void => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 保存できなくても現在のセッションでは反映される
  }
};
