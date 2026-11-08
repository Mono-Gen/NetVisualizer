import type { NetPacket } from '../types/network';

/**
 * シミュレーションの上限値。
 * Why: ループ構成のブロードキャストストームは実機では終わらず増え続ける。
 * 教材として「起きること」は残しつつ、画面が固まらないよう同時に飛ぶパケット数に上限を設ける。
 */

/** 同時に飛行できるパケット数の上限。超えた分は破棄される(描画負荷の保護) */
export const MAX_IN_FLIGHT_PACKETS = 300;

/** パケットログの保持件数(古いものから捨てる) */
export const MAX_LOG_ENTRIES = 200;

/** ストーム警告を解除する閾値(上限のこの割合を下回ったら収束とみなす) */
export const STORM_CLEAR_RATIO = 0.5;

/** L2フレームの生存ホップ数の既定値。ループ時に永久に回り続けないための最終防壁(実機にはない) */
export const L2_TTL_DEFAULT = 255;

/** パケットを追加する。上限を超える分は追加せず、破棄した数を返す */
export const appendWithCap = (
  existing: NetPacket[],
  adds: NetPacket[],
  cap: number = MAX_IN_FLIGHT_PACKETS
): { packets: NetPacket[]; dropped: number } => {
  const room = Math.max(0, cap - existing.length);
  const accepted = adds.slice(0, room);
  return { packets: [...existing, ...accepted], dropped: adds.length - accepted.length };
};

/** 警告を解除してよいか */
export const isStormCleared = (inFlight: number, cap: number = MAX_IN_FLIGHT_PACKETS): boolean =>
  inFlight < cap * STORM_CLEAR_RATIO;
