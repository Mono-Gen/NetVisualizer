/**
 * プロトコルの色の唯一の窓口(SSOT)。
 * パケットの丸・ログ・テーブル見出し・凡例は、全てここ経由で同じ色を使う。
 * 色の実体は index.css の --proto-* (ダーク/ライトで別の値)。
 *  - 塗り用 (--proto-x): やわらかいパステル。パケットの丸・点・薄い背景に使う
 *  - 文字用 (--proto-x-text): 背景に対して読める濃さ。見出し・プロトコル名に使う
 * 色だけに頼らない: パケットには必ずプロトコル名のラベルを併記する。
 */

export const PROTO_KEYS = ['arp', 'icmp', 'tcp', 'udp', 'dns', 'dhcp', 'mdns', 'igmp', 'other'] as const;
export type ProtoKey = typeof PROTO_KEYS[number];

/** 凡例に出す順(other は除く) */
export const LEGEND_KEYS: ProtoKey[] = ['arp', 'icmp', 'tcp', 'udp', 'dns', 'dhcp', 'mdns', 'igmp'];

/** 表示名。プロトコル名は訳さない */
export const PROTO_NAME: Record<Exclude<ProtoKey, 'other'>, string> = {
  arp: 'ARP', icmp: 'ICMP', tcp: 'TCP', udp: 'UDP', dns: 'DNS', dhcp: 'DHCP', mdns: 'mDNS', igmp: 'IGMP'
};

interface HasProtocol { protocol?: string; sourcePort?: number; destinationPort?: number }

/** パケット/ログからプロトコルの色キーを決める。UDPの53番はDNSとして扱う */
export const protoKeyOf = (p: HasProtocol): ProtoKey => {
  switch (p.protocol) {
    case 'ARP': return 'arp';
    case 'ICMP': return 'icmp';
    case 'TCP': return 'tcp';
    case 'DNS': return 'dns';
    case 'DHCP': return 'dhcp';
    case 'mDNS': return 'mdns';
    case 'IGMP': return 'igmp';
    case 'UDP': return (p.destinationPort === 53 || p.sourcePort === 53) ? 'dns' : 'udp';
    default: return 'other';
  }
};

export const protoFill = (key: ProtoKey): string => `var(--proto-${key})`;
export const protoText = (key: ProtoKey): string => `var(--proto-${key}-text)`;
/** 薄い背景・枠用。透明度は割合(%) */
export const protoTint = (key: ProtoKey, percent: number): string =>
  `color-mix(in srgb, var(--proto-${key}) ${percent}%, transparent)`;
