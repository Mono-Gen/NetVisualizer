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
    nodes: [], 
    links: [], 
    packets: [], 
    packetLogs: [], 
    pendingPackets: [] 
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
