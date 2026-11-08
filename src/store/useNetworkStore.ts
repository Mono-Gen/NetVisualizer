import { create } from 'zustand';
import type { NetworkState } from '../types/store';
import { createNodeSlice } from './slices/nodeSlice';
import { createPacketSlice } from './slices/packetSlice';
import { createLogSlice } from './slices/logSlice';

export const useNetworkStore = create<NetworkState>((set, get) => ({
  ...createNodeSlice(set, get),
  ...createPacketSlice(set, get),
  ...createLogSlice(set, get),

  clearCanvas: () => set({ 
    stormActive: false,
    stormDropped: 0,
    selectedLinkId: null,
    nodes: [], 
    links: [], 
    packets: [], 
    packetLogs: [], 
    pendingPackets: [] 
  }),

  // トポロジーを丸ごと差し替える(サンプル読込用)。実行時の状態も全て初期化する。
  loadTopology: (nodes, links) => set({
    nodes,
    links,
    packets: [],
    packetLogs: [],
    pendingPackets: [],
    dnsPendingPings: {},
    stormActive: false,
    stormDropped: 0,
    selectedNodeId: null,
    simSourceId: null,
    selectedLinkId: null,
    isInspectMode: false,
    isPaused: false,
    pausedAt: null,
    zoom: 1.0
  }),

  clearTables: () => set((state) => ({
    nodes: state.nodes.map(n => ({ ...n, macTable: {}, arpTable: {}, dnsCache: {} })),
    packetLogs: [],
    pendingPackets: []
  })),
  
  clearDnsCache: (nodeId: string) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, dnsCache: {} } : n)
  })),
  
  clearNodeArpTable: (nodeId: string) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, arpTable: {} } : n)
  })),
  
  clearNodeMacTable: (nodeId: string) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, macTable: {} } : n)
  })),
}));
