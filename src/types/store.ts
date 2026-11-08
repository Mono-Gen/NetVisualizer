import type { NetNode, NetLink, NetPacket, EngineUpdate } from './network';

export type NodeSlice = {
  nodes: NetNode[];
  links: NetLink[];
  zoom: number;
  mode: 'DESIGN' | 'SIMULATE';
  selectedNodeId: string | null;
  simSourceId: string | null;
  isInspectMode: boolean;
  selectedLinkId: string | null;
  isPaused: boolean;
  simSpeed: number;
  pausedAt: number | null;

  addNode: (node: NetNode) => void;
  updateNode: (id: string, updates: Partial<NetNode>) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  addInterface: (nodeId: string) => void;
  removeInterface: (nodeId: string, ifaceId: string) => void;
  addLink: (link: NetLink) => void;
  removeLink: (id: string) => void;
  
  setMode: (mode: 'DESIGN' | 'SIMULATE') => void;
  setZoom: (zoom: number) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSimSourceId: (id: string | null) => void;
  setSelectedLinkId: (id: string | null) => void;
  setInspectMode: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSimSpeed: (speed: number) => void;
};

export type PacketSlice = {
  packets: NetPacket[];
  pendingPackets: NetPacket[];
  dnsPendingPings: Record<string, string[]>;
  /** ブロードキャストストーム(パケット上限到達)の検知状態と、上限で破棄した累計数 */
  stormActive: boolean;
  stormDropped: number;
  clearPackets: () => void;
  sendPacket: (packetData: Omit<NetPacket, 'id' | 'progress'>) => void;
  handlePacketArrival: (packet: NetPacket) => void;
  tick: () => void;
  stepSimulation: () => void;
  advanceSimulation: (delta: number) => void;
  runHousekeeping: () => void;
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
  loadTopology: (nodes: NetNode[], links: NetLink[]) => void;
  clearTables: () => void;
  clearDnsCache: (nodeId: string) => void;
  clearNodeArpTable: (nodeId: string) => void;
  clearNodeMacTable: (nodeId: string) => void;
};
