import type { NetNode, NetLink } from '../../types/network';
import { PORT_LIMITS, createInterface, collectMacs } from '../../logic/interfaceFactory';
import { forgetPortState, pruneAfterLinkRemoved, pruneAfterNodeRemoved } from '../../logic/pruning';
import { clampZoom } from '../../logic/viewport';
import { SIM_SPEEDS, shiftNodeTimers, shiftPendingTimestamps } from '../../logic/simClock';

export const createNodeSlice = (set: any, get: any) => ({
  nodes: [],
  links: [],
  zoom: 1.0,
  panX: 0,
  panY: 0,
  mode: 'DESIGN',
  selectedNodeId: null,
  simSourceId: null,
  selectedLinkId: null,
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
  // 機器を消すとき: つながっていたケーブル、相手側のMAC/ARPの記憶、飛行中のパケットも片付ける
  removeNode: (id: string) => set((state: any) => {
    const removed: NetNode | undefined = state.nodes.find((n: NetNode) => n.id === id);
    if (!removed) return {};
    const removedLinks = state.links.filter((l: NetLink) => l.from === id || l.to === id);
    const pruned = pruneAfterNodeRemoved(state.nodes, state.packets, state.pendingPackets, removed, removedLinks);
    return {
      nodes: pruned.nodes,
      links: state.links.filter((l: NetLink) => l.from !== id && l.to !== id),
      packets: pruned.packets,
      pendingPackets: pruned.pending,
      pendingPings: state.pendingPings.filter((p: { nodeId: string }) => p.nodeId !== id)
    };
  }),
  addInterface: (nodeId: string) => set((state: any) => {
    const node: NetNode | undefined = state.nodes.find((n: NetNode) => n.id === nodeId);
    if (!node || node.interfaces.length >= PORT_LIMITS[node.type].max) return {};
    const iface = createInterface(node.type, node.interfaces, collectMacs(state.nodes));
    return { nodes: state.nodes.map((n: NetNode) => n.id === nodeId ? { ...n, interfaces: [...n.interfaces, iface] } : n) };
  }),
  // ポートを削除する。接続中のリンクと、そのポートを参照する学習状態(MAC/IGMP/mrouter)も同時に消す。
  // Why: リンクだけ残ると存在しないポートを指す壊れたリンクになるため。
  removeInterface: (nodeId: string, ifaceId: string) => set((state: any) => {
    const node: NetNode | undefined = state.nodes.find((n: NetNode) => n.id === nodeId);
    if (!node || node.interfaces.length <= PORT_LIMITS[node.type].min) return {};

    return {
      nodes: state.nodes.map((n: NetNode) => n.id !== nodeId ? n : {
        ...forgetPortState(n, ifaceId),
        interfaces: n.interfaces.filter(i => i.id !== ifaceId)
      }),
      links: state.links.filter((l: NetLink) =>
        !((l.from === nodeId && l.fromInterfaceId === ifaceId) || (l.to === nodeId && l.toInterfaceId === ifaceId)))
    };
  }),
  addLink: (link: NetLink) => set((state: any) => ({ links: [...state.links, link] })),
  // ケーブルを抜くとき: そのポートのMAC等の記憶と、そのケーブルを飛行中のパケットを片付ける
  removeLink: (id: string) => set((state: any) => {
    const link: NetLink | undefined = state.links.find((l: NetLink) => l.id === id);
    if (!link) return {};
    const pruned = pruneAfterLinkRemoved(state.nodes, state.packets, state.pendingPackets, link);
    return {
      nodes: pruned.nodes,
      links: state.links.filter((l: NetLink) => l.id !== id),
      packets: pruned.packets,
      selectedLinkId: state.selectedLinkId === id ? null : state.selectedLinkId
    };
  }),
  
  // モードを切り替えたら一時停止も解除する。解除時は停止分の時間を期限へ加算する(setPausedと同じ補正)
  setMode: (mode: any) => {
    get().setPaused(false);
    set({ mode, simSourceId: null });
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
  setZoom: (zoom: any) => set({ zoom: clampZoom(zoom) }),
  // 表示(平行移動と拡大率)をまとめて更新する
  setView: (view: { x: number; y: number; zoom: number }) => set({ panX: view.x, panY: view.y, zoom: clampZoom(view.zoom) }),
  // ノードとリンクは同時に選択しない(設定パネルと削除対象が食い違うのを防ぐ)
  setSelectedNodeId: (id: any) => set((state: any) => ({ selectedNodeId: id, selectedLinkId: id ? null : state.selectedLinkId })),
  setSelectedLinkId: (id: any) => set((state: any) => ({ selectedLinkId: id, selectedNodeId: id ? null : state.selectedNodeId })),
  setSimSourceId: (id: any) => set({ simSourceId: id }),
});
