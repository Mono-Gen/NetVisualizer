import { useNetworkStore } from './useNetworkStore';
import { parseTopology, serializeTopology } from '../logic/topologyIO';

/**
 * 構成の自動保存と復元。
 * - 保存先はこのブラウザの localStorage(外部へは送らない)。使えない環境では、何もせず動作する。
 * - 保存するのは構成だけ(学習状態は含めない)。変更から少し待ってから書く(ドラッグ中に何度も書かない)。
 * - 保存データが壊れていたら、無視して(消して)、空の状態で始める。
 */

export const AUTOSAVE_KEY = 'netvisualizer.autosave';
const DEFAULT_DELAY_MS = 600;

/** localStorage 相当の最小インターフェース(テストで差し替えられるようにする) */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserStorage = (): StorageLike | null => {
  try { return window.localStorage; } catch { return null; }
};

export const createAutosave = (
  store: typeof useNetworkStore,
  storage: StorageLike | null,
  delayMs: number = DEFAULT_DELAY_MS
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved: string | null = null;

  /** 今すぐ保存する。内容が前回と同じなら書かない(学習状態だけが変わったときは何もしない) */
  const flush = () => {
    if (!storage) return;
    if (timer) { clearTimeout(timer); timer = null; }
    const { nodes, links } = store.getState();
    const text = serializeTopology(nodes, links);
    if (text === lastSaved) return;
    try { storage.setItem(AUTOSAVE_KEY, text); lastSaved = text; } catch { /* 容量超過などでも動作は続ける */ }
  };

  /** 保存済みの構成を読み込む。復元できたら true */
  const restore = (): boolean => {
    if (!storage) return false;
    let text: string | null = null;
    try { text = storage.getItem(AUTOSAVE_KEY); } catch { return false; }
    if (!text) return false;
    const parsed = parseTopology(text);
    if (!parsed.ok) {
      try { storage.removeItem(AUTOSAVE_KEY); } catch { /* 消せなくても続ける */ }
      return false;
    }
    if (parsed.nodes.length === 0) return false;
    store.getState().loadTopology(parsed.nodes, parsed.links);
    lastSaved = text;
    return true;
  };

  /** 構成が変わったら、少し待って保存する */
  const start = () => {
    if (!storage) return () => undefined;
    return store.subscribe((state, prev) => {
      if (state.nodes === prev.nodes && state.links === prev.links) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    });
  };

  return { flush, restore, start };
};

/** アプリ起動時に1度だけ呼ぶ: 復元してから、自動保存を始める */
export const startAutosave = () => {
  const autosave = createAutosave(useNetworkStore, browserStorage());
  autosave.restore();
  autosave.start();
  // タブを閉じる直前に、待っている保存を確実に書く
  try { window.addEventListener('pagehide', autosave.flush); } catch { /* 非ブラウザ環境 */ }
};
