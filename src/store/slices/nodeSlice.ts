import type { NetNode, NetLink } from '../../types/network';
import { PORT_LIMITS, createInterface, collectMacs } from '../../logic/interfaceFactory';
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
  removeNode: (id: string) => set((state: any) => ({
    nodes: state.nodes.filter((n: NetNode) => n.id !== id),
    links: state.links.filter((l: NetLink) => l.from !== id && l.to !== id)
  })),
  // ポートを1つ追加する。上限を超える場合は何もしない(UI側でも無効化する)
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

    const macTable = Object.fromEntries(Object.entries(node.macTable || {}).filter(([, port]) => port !== ifaceId));
    const igmpSnoopingTable: Record<string, string[]> = {};
    Object.entries(node.igmpSnoopingTable || {}).forEach(([group, ports]) => {
      const rest = ports.filter(p => p !== ifaceId);
      if (rest.length > 0) igmpSnoopingTable[group] = rest;
    });
    const igmpSnoopingExpires: Record<string, Record<string, number>> = {};
    Object.entries(node.igmpSnoopingExpires || {}).forEach(([group, ports]) => {
      const rest = Object.fromEntries(Object.entries(ports).filter(([p]) => p !== ifaceId));
      if (Object.keys(rest).length > 0) igmpSnoopingExpires[group] = rest;
    });
    const mrouterGone = node.mrouterPortId === ifaceId;

    return {
      nodes: state.nodes.map((n: NetNode) => n.id !== nodeId ? n : {
        ...n,
        interfaces: n.interfaces.filter(i => i.id !== ifaceId),
        macTable, igmpSnoopingTable, igmpSnoopingExpires,
        ...(mrouterGone ? { mrouterPortId: undefined, mrouterPortExpiresAt: undefined } : {})
      }),
      links: state.links.filter((l: NetLink) =>
        !((l.from === nodeId && l.fromInterfaceId === ifaceId) || (l.to === nodeId && l.toInterfaceId === ifaceId)))
    };
  }),
  addLink: (link: NetLink) => set((state: any) => ({ links: [...state.links, link] })),
  removeLink: (id: string) => set((state: any) => ({
    links: state.links.filter((l: NetLink) => l.id !== id),
    selectedLinkId: state.selectedLinkId === id ? null : state.selectedLinkId
  })),
  
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
