/**
 * パケットログ1件の表示用の整形(純粋関数)。
 * Why: ログパネル(1行表示)と、今後の表示で、プロトコル名・経路の表記を揃えるため。
 */

export interface LogEntry {
  id: string;
  time?: string;
  protocol?: string;
  type?: string;
  status?: string;
  senderIP?: string;
  targetIP?: string;
  senderMAC?: string;
  targetMAC?: string;
  flags?: { syn?: boolean; ack?: boolean; fin?: boolean; rst?: boolean };
  payload?: { message?: string };
  info?: string;
}

/** 「TCP [SYN, ACK]」「ICMP echo-request」のような、プロトコル+種別の短い表記 */
export const protocolLabel = (log: LogEntry): string => {
  const proto = log.protocol || '-';
  if (proto === 'TCP') {
    const f = log.flags;
    const kind =
      f?.syn && f?.ack ? '[SYN, ACK]' :
      f?.syn ? '[SYN]' :
      f?.fin ? '[FIN]' :
      f?.rst ? '[RST]' :
      (log.payload?.message ? '[DATA]' : '[ACK]');
    return `TCP ${kind}`;
  }
  return log.type ? `${proto} ${log.type}` : proto;
};

/** 経路の表記。ARPはIPが未確定なのでMACで表す */
export const routeLabel = (log: LogEntry): string => {
  if (log.protocol === 'ARP') return `${log.senderMAC || '??'} → ${log.targetMAC || 'FF:FF:FF:FF:FF:FF'}`;
  return `${log.senderIP || '-'} → ${log.targetIP || '-'}`;
};

/** 状態を示す記号。色だけに頼らず、記号と文字で区別する */
export const statusGlyph = (status?: string): string => {
  switch (status) {
    case 'error': return '✖';
    case 'dropped': return '⊘';
    case 'received': return '↓';
    case 'sent': return '↑';
    default: return '·';
  }
};

/** 絞り込みの選択肢に使うプロトコル(ログに現れうるもの) */
export const LOG_PROTOCOL_FILTERS = ['ARP', 'ICMP', 'TCP', 'UDP', 'DHCP', 'DNS', 'mDNS', 'IGMP'] as const;
