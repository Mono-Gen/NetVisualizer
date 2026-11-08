/**
 * 応答待ち(ping・DNS)の「タイムアウト」判定(純粋関数)。
 * Why: 宛先が存在しない・経路が無いとき、何も起きないまま終わると、初心者は理由が分からない。
 *
 * 方式: 通信中のパケットが無くなった(ネットワークが空になった)のに、まだ応答が来ていなければ、
 * もう何も起こらないので、少しの猶予ののちにタイムアウトとする。待たされず、すぐ気づける。
 * 時間はシミュレーション時間(一時停止中は進まず、速度に比例する)。
 */

/** ネットワークが空になってから、応答なしと判断するまでの猶予(シミュレーション秒) */
export const IDLE_TIMEOUT_SECONDS = 2;

/** 空にならなくても、これだけ待っても応答が無ければタイムアウト(ストーム中などの保険) */
export const HARD_TIMEOUT_SECONDS = 60;

export interface PendingPing { id: string; nodeId: string; targetIP: string; senderIP: string; deadline: number }
export interface PendingDns { nodeId: string; deadline: number }

/** ネットワークが空になった時刻を追跡し、猶予を過ぎたかを返す */
export const trackIdle = (
  simTime: number,
  idleSince: number | null,
  inFlight: number,
  hasPending: boolean
): { idleSince: number | null; idleExpired: boolean } => {
  if (inFlight > 0 || !hasPending) return { idleSince: null, idleExpired: false };
  const since = idleSince ?? simTime;
  return { idleSince: since, idleExpired: simTime - since >= IDLE_TIMEOUT_SECONDS };
};
