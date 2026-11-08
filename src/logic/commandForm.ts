import type { NetNode } from '../types/network';
import type { DictKey } from '../i18n/en';

/**
 * コマンドパネル(Ping / UDP / TCP)の入力検証と、ボタンの有効/無効の判定(純粋関数)。
 * 方針: 押せないボタンには必ず「理由」を返し、画面に文字で出す(黙って何もしない状態を作らない)。
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export const isIPv4 = (value: string): boolean => {
  const m = value.trim().match(IPV4);
  return !!m && m.slice(1).every(o => Number(o) <= 255);
};

/** ポート番号(1〜65535の整数)。不正なら null */
export const parsePort = (value: string): number | null => {
  const text = value.trim();
  if (!/^\d{1,5}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 65535 ? n : null;
};

/** TCP接続の段階(画面表示とボタン制御用に、細かい状態名をまとめたもの) */
export type TcpPhase = 'none' | 'connecting' | 'established' | 'closing';

export const tcpPhaseOf = (node: NetNode, ip: string, port: number | null): TcpPhase => {
  if (port === null) return 'none';
  const conn = node.tcpConnections?.[`${ip.trim()}:${port}`];
  if (!conn) return 'none';
  switch (conn.state) {
    case 'SYN_SENT':
    case 'SYN_RECEIVED':
      return 'connecting';
    case 'ESTABLISHED':
      return 'established';
    case 'FIN_WAIT_1':
    case 'FIN_WAIT_2':
    case 'CLOSE_WAIT':
    case 'LAST_ACK':
    case 'TIME_WAIT':
      return 'closing';
    default:
      return 'none'; // CLOSED / LISTEN
  }
};

export interface Availability {
  enabled: boolean;
  /** 無効のときの理由(辞書キー)。有効なら undefined */
  reason?: DictKey;
}

export interface CommandAvailability {
  ping: Availability;
  udp: Availability;
  tcpConnect: Availability;
  tcpSend: Availability;
  tcpClose: Availability;
}

const ok: Availability = { enabled: true };
const no = (reason: DictKey): Availability => ({ enabled: false, reason });

export const commandAvailability = (input: { dest: string; port: string; message: string; phase: TcpPhase }): CommandAvailability => {
  const dest = input.dest.trim();
  const port = parsePort(input.port);
  const hasMessage = input.message.trim().length > 0;

  // UDP/TCPは、ホスト名の解決を行わないので、IPアドレスが必要
  const l4Common: Availability | null =
    !dest ? no('cmd.need.ip')
    : !isIPv4(dest) ? no('cmd.need.ipv4')
    : port === null ? no('cmd.need.port')
    : null;

  const udp = l4Common ?? (hasMessage ? ok : no('cmd.need.message'));

  const tcpConnect =
    l4Common ??
    (input.phase === 'none' ? ok
      : input.phase === 'connecting' ? no('cmd.tcp.wait')
      : input.phase === 'established' ? no('cmd.tcp.already')
      : no('cmd.tcp.closing'));

  const tcpSend =
    l4Common ??
    (input.phase === 'established' ? (hasMessage ? ok : no('cmd.need.message'))
      : input.phase === 'connecting' ? no('cmd.tcp.wait')
      : input.phase === 'closing' ? no('cmd.tcp.closing')
      : no('cmd.need.connect'));

  const tcpClose =
    l4Common ??
    (input.phase === 'established' ? ok
      : input.phase === 'connecting' ? no('cmd.tcp.wait')
      : input.phase === 'closing' ? no('cmd.tcp.closing')
      : no('cmd.tcp.notConnected'));

  return { ping: dest ? ok : no('cmd.need.ip'), udp, tcpConnect, tcpSend, tcpClose };
};
