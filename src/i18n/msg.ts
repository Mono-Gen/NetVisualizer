import { en, type DictKey } from './en';
import { interpolate, type Msg, type Params } from './translate';

/**
 * 翻訳可能なメッセージを作る(ロジック層・ログ用)。
 * 画面に出すときに useTMsg が現在の言語へ翻訳する。info には英語の確定文を持たせ、
 * 辞書に無い環境でも、ログの検索や既存の参照が壊れないようにする。
 */
export const msg = (key: DictKey, params?: Params): Msg => ({
  key,
  params,
  info: interpolate(en[key], params)
});
