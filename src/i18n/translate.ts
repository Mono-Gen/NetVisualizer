/**
 * 翻訳の中核(React非依存の純粋関数)。
 * - 辞書のキーは en.ts が正本(SSOT)。ja.ts は同じキー集合を型で強制される。
 * - 文言中の {name} はパラメータで置換する。
 */

export type Lang = 'en' | 'ja';

export type Params = Record<string, string | number>;

/** 翻訳済みメッセージ(ログなど、生成時には言語が決まらない文言用)。info は英語の確定文 */
export interface Msg {
  key: string;
  params?: Params;
  /** 英語の確定文。ログの検索・既存の参照との互換用 */
  info: string;
}

export const interpolate = (template: string, params?: Params): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params && name in params ? String(params[name]) : whole);

export const makeTranslate = (dicts: Record<Lang, Record<string, string>>) =>
  (lang: Lang, key: string, params?: Params): string => {
    // 訳が無い場合は英語、英語にも無ければキー自体を返す(画面に出れば欠落に気づける)
    const template = dicts[lang][key] ?? dicts.en[key] ?? key;
    return interpolate(template, params);
  };
