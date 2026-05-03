import type { NetNode, NetLink, NetPacket, EngineUpdate } from './network';

export type NodeSlice = {
  nodes: NetNode[];
  links: NetLink[];
  zoom: number;
  mode: 'DESIGN' | 'SIMULATE';
  selectedNodeId: string | null;
  simSourceId: string | null;
  isLinkMode: boolean;
  isDeleteMode: boolean;
  isInspectMode: boolean;
  linkingSourceId: string | null;
  
  addNode: (node: NetNode) => void;
  updateNode: (id: string, updates: Partial<NetNode>) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  addLink: (link: NetLink) => void;
  removeLink: (id: string) => void;
  
  setMode: (mode: 'DESIGN' | 'SIMULATE') => void;
  setZoom: (zoom: number) => void;
  setLinkMode: (enabled: boolean) => void;
  setDeleteMode: (enabled: boolean) => void;
  setLinkingSourceId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSimSourceId: (id: string | null) => void;
  setInspectMode: (enabled: boolean) => void;
};

export type PacketSlice = {
  packets: NetPacket[];
  pendingPackets: NetPacket[];
  dnsPendingPings: Record<string, string[]>;
  sendPacket: (packetData: Omit<NetPacket, 'id' | 'progress'>) => void;
  handlePacketArrival: (packet: NetPacket) => void;
  tick: () => void;
  applyEngineUpdate: (update: EngineUpdate) => void;
  removePacket: (id: string) => void;
  startTCPHandshake: (fromId: string, toIP: string, port: number) => void;
  sendIGMPQuery: (nodeId: string) => void;
  leaveMulticastGroup: (nodeId: string, groupIP: string) => void;
  resolveAndPing: (nodeId: string, hostname: string) => void;
};

export type LogSlice = {
  packetLogs: any[];
  addPacketLog: (log: any) => void;
  clearPacketLogs: () => void;
};

export type NetworkState = NodeSlice & PacketSlice & LogSlice & {
  clearCanvas: () => void;
  clearTables: () => void;
  clearDnsCache: (nodeId: string) => void;
  clearNodeArpTable: (nodeId: string) => void;
  clearNodeMacTable: (nodeId: string) => void;
};
