import type { NetNode, NetLink } from '../../types/network';

export const createNodeSlice = (set: any, get: any) => ({
  nodes: [],
  links: [],
  zoom: 1.0,
  mode: 'DESIGN',
  selectedNodeId: null,
  simSourceId: null,
  isLinkMode: false,
  isDeleteMode: false,
  isInspectMode: false,
  linkingSourceId: null,

  addNode: (node: NetNode) => set((state: any) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id: string, updates: Partial<NetNode>) => set((state: any) => ({
    nodes: state.nodes.map((n: NetNode) => (n.id === id ? { ...n, ...updates } : n))
  })),
  updateNodePosition: (id: string, x: number, y: number) => set((state: any) => ({
    nodes: state.nodes.map((n: NetNode) => (n.id === id ? { ...n, x, y } : n))
  })),
  removeNode: (id: string) => set((state: any) => ({
    nodes: state.nodes.filter((n: NetNode) => n.id !== id),
    links: state.links.filter((l: NetLink) => l.from !== id && l.to !== id)
  })),
  addLink: (link: NetLink) => set((state: any) => ({ links: [...state.links, link] })),
  removeLink: (id: string) => set((state: any) => ({
    links: state.links.filter((l: NetLink) => l.id !== id)
  })),
  
  setMode: (mode: any) => set({ mode, simSourceId: null, isInspectMode: false }),
  setZoom: (zoom: any) => set({ zoom: Math.max(0.1, Math.min(2, zoom)) }),
  setLinkMode: (enabled: any) => set({ isLinkMode: enabled, isDeleteMode: false, linkingSourceId: null }),
  setDeleteMode: (enabled: any) => set({ isDeleteMode: enabled, isLinkMode: false, linkingSourceId: null }),
  setLinkingSourceId: (id: any) => set({ linkingSourceId: id }),
  setSelectedNodeId: (id: any) => set({ selectedNodeId: id, isLinkMode: false, isDeleteMode: false }),
  setSimSourceId: (id: any) => set({ simSourceId: id }),
  setInspectMode: (enabled: any) => set({ isInspectMode: enabled, simSourceId: null }),
});
