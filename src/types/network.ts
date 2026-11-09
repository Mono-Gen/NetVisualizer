export const NETWORK_TYPES_VERSION = '1.0.0';

export type NodeType = 'pc' | 'router' | 'switch' | 'l3switch' | 'hub' | 'server' | 'dns' | 'dhcp';

export interface NetInterface {
  id: string;
  name: string;
  ip: string;
  mac: string;
  subnet: string;
  gateway?: string;
  dns?: string;
  /** 経路の優先度。小さいほど優先(未設定は既定値 100) */
  metric?: number;
  /** スイッチ/L3スイッチのポートのアクセスVLAN(1〜4094)。未設定は VLAN 1 */
  accessVlan?: number;
}

export interface ListeningPort {
  port: number;
  protocol: 'TCP' | 'UDP';
  service?: string;
}

/** ファイアウォールの1ルール。src/dst は 'any'、a.b.c.d、または a.b.c.d/長さ */
export interface FwRule {
  id: string;
  action: 'allow' | 'deny';
  protocol: 'any' | 'ICMP' | 'TCP' | 'UDP';
  src: string;
  dst: string;
  dstPort?: number; // TCP/UDP のときだけ。未指定=すべて
}

export interface FirewallConfig {
  rules: FwRule[];
  defaultAction: 'allow' | 'deny'; // どのルールにも一致しないときの動作
}

/** NAT変換表の1件(内側のIP:ポート ↔ 外側に割り当てたポート)。ICMPのポートは識別子 */
export interface NatEntry {
  protocol: 'ICMP' | 'TCP' | 'UDP';
  insideIP: string;
  insidePort: number;
  outsidePort: number;
  remoteIP: string;
  remotePort: number;
}

export interface NatConfig {
  enabled: boolean;
  outsideInterfaceId: string; // 外側ポート。それ以外のポートはすべて内側
}

export interface NetNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  interfaces: NetInterface[];
  macTable?: Record<string, string>;
  arpTable?: Record<string, string>;
  igmpSnoopingTable?: Record<string, string[]>;
  igmpSnoopingExpires?: Record<string, Record<string, number>>; // GroupIP -> { portId: expiresAt }
  igmpSnoopingEnabled?: boolean;
  igmpSnoopingAgingTime?: number; // seconds (default 30)
  igmpQuerierEnabled?: boolean;
  igmpQuerierInterval?: number; // seconds
  mrouterPortId?: string;
  mrouterPortExpiresAt?: number;
  managementIP?: string;
  managementSubnet?: string;
  igmpQuerierStandby?: boolean;
  joinedGroups?: string[];
  tcpConnections?: Record<string, {
    state: 'CLOSED' | 'LISTEN' | 'SYN_SENT' | 'SYN_RECEIVED' | 'ESTABLISHED' | 'FIN_WAIT_1' | 'FIN_WAIT_2' | 'CLOSE_WAIT' | 'LAST_ACK' | 'TIME_WAIT';
    localPort: number;
    remoteIP: string;
    remotePort: number;
    seq: number;
    ack: number;
  }>;
  firewall?: FirewallConfig;
  nat?: NatConfig;
  natTable?: NatEntry[]; // 学習状態(保存しない)。新しいものが先頭
  dnsTable?: Record<string, string>;
  dnsRecords?: Record<string, string>; // DNS server records (hostname -> IP)
  dnsCache?: Record<string, string>;
  listeningPorts?: ListeningPort[];
  services?: Array<{ port: number; protocol: string; }>; // Alias for listeningPorts used in UDPHandler
  dhcpScope?: {
    startIP: string;
    endIP: string;
    gateway: string;
    dns: string;
    subnet: string;
    leaseTime: number; // in simulation ticks or seconds
    leases: Record<string, { ip: string, expiresAt: number }>; // MAC -> {IP, Expiry}
  };
}

export interface NetLink {
  id: string;
  from: string;
  to: string;
  fromInterfaceId: string;
  toInterfaceId: string;
}

export interface NetPacket {
  id: string;
  from: string;
  to: string;
  fromInterfaceId?: string;
  senderIP: string;
  targetIP: string;
  senderMAC: string;
  targetMAC: string;
  protocol: 'ARP' | 'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'DHCP' | 'IGMP' | 'mDNS';
  type: string; // RFC packet types: echo-request, echo-reply, report, membership-report, query, leave, leave-group, error, response, syn, syn-ack, ack, fin, rst, request, reply
  progress: number;
  status: 'pending' | 'confirmed' | 'error' | 'sent';
  handled?: boolean;
  toInterfaceId?: string;
  originatingInterfaceId?: string;
  ttl?: number;
  l2ttl?: number;
  timestamp?: number;
  sourcePort?: number;
  icmpId?: number; // ICMP echo の識別子(NATが、どの内側の要求への応答かを見分けるのに使う)
  destinationPort?: number;
  seq?: number;
  ackNum?: number;
  flags?: {
    syn: boolean;
    ack: boolean;
    fin: boolean;
    rst?: boolean;
  };
  payload?: any;
}

export interface EngineUpdate {
  nodes?: Record<string, Partial<NetNode>>;
  addPackets?: NetPacket[];
  removePacketIds?: string[];
  addLogs?: any[];
  pendingPacketsUpdate?: {
    add?: NetPacket[];
    removeIds?: string[];
    clear?: boolean;
  };
}
