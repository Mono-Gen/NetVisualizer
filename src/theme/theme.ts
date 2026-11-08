/**
 * テーマ(ライト/ダーク/自動)の保存と適用。
 * - 'auto': data-theme 属性を付けず、CSSの prefers-color-scheme(OS設定)に従う
 * - 'light' / 'dark': data-theme 属性で固定
 * Why: localStorage は無効・拒否される環境があるため、読み書きは必ず try/catch し、
 *      使えなくても動作する(その場合は毎回 auto になる)。
 */

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'netvisualizer.theme';

export const loadTheme = (): ThemeMode => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
};

export const saveTheme = (mode: ThemeMode): void => {
  try {
    if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // 保存できなくても現在のセッションでは反映される
  }
};

export const applyTheme = (mode: ThemeMode): void => {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
};
