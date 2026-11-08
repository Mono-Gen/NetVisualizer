import type { NetNode, NetLink } from '../../types/network';
import { SIM_SPEEDS, shiftNodeTimers, shiftPendingTimestamps } from '../../logic/simClock';

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
  isPaused: false,
  simSpeed: 1,
  pausedAt: null,

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
  
  // モードを切り替えたら一時停止も解除する。解除時は停止分の時間を期限へ加算する(setPausedと同じ補正)
  setMode: (mode: any) => {
    get().setPaused(false);
    set({ mode, simSourceId: null, isInspectMode: false });
  },
  setPaused: (paused: boolean) => set((state: any) => {
    if (paused === state.isPaused) return {};
    if (paused) return { isPaused: true, pausedAt: Date.now() };
    // 再開: 停止していた時間を、壁時計基準の期限・タイムスタンプへ加算する
    const delta = state.pausedAt ? Date.now() - state.pausedAt : 0;
    return {
      isPaused: false,
      pausedAt: null,
      nodes: shiftNodeTimers(state.nodes, delta),
      pendingPackets: shiftPendingTimestamps(state.pendingPackets, delta)
    };
  }),
  setSimSpeed: (speed: number) => set({ simSpeed: SIM_SPEEDS.includes(speed as any) ? speed : 1 }),
  setZoom: (zoom: any) => set({ zoom: Math.max(0.1, Math.min(2, zoom)) }),
  setLinkMode: (enabled: any) => set({ isLinkMode: enabled, isDeleteMode: false, linkingSourceId: null }),
  setDeleteMode: (enabled: any) => set({ isDeleteMode: enabled, isLinkMode: false, linkingSourceId: null }),
  setLinkingSourceId: (id: any) => set({ linkingSourceId: id }),
  setSelectedNodeId: (id: any) => set({ selectedNodeId: id, isLinkMode: false, isDeleteMode: false }),
  setSimSourceId: (id: any) => set({ simSourceId: id }),
  setInspectMode: (enabled: any) => set({ isInspectMode: enabled, simSourceId: null }),
});
