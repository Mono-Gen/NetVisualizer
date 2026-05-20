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
}

export interface ListeningPort {
  port: number;
  protocol: 'TCP' | 'UDP';
  service?: string;
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
  protocol: 'ARP' | 'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'HTTP' | 'DHCP' | 'IGMP' | 'mDNS';
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
