import type { NetNode, NetLink, NetInterface, VlanState } from '../types/network';

/**
 * VLAN(アクセスポートと簡易トランク)の純粋関数。
 * 方針:
 *  - スイッチ/L3スイッチのポートは、アクセス(VLANを1つ持つ)かトランク(全VLANをタグ付きで通す)。未設定は VLAN 1 のアクセス。
 *  - フレームは、受けたポートで1回だけVLANが決まる(アクセス=ポートのVLAN、トランク=フレームのタグ)。
 *    出すときは、アクセスならタグを外し、トランクならタグを付ける。
 *  - 学習した状態(MAC表・スヌーピング表・mrouter・クエリア)は、VLANごとの入れ物(vlanState)に持つ。
 */

export const VLAN_MIN = 1;
export const VLAN_MAX = 4094;
export const DEFAULT_VLAN = 1;

/** VLANを持つ機器(ハブ・ホスト・ルーターのポートは持たない) */
export const isVlanSwitch = (node: Pick<NetNode, 'type'>): boolean => node.type === 'switch' || node.type === 'l3switch';

export const isValidVlanId = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= VLAN_MIN && n <= VLAN_MAX;

/** ポートの種類。未設定はアクセス */
export const isTrunkInterface = (iface: Pick<NetInterface, 'vlanMode'> | undefined): boolean => iface?.vlanMode === 'trunk';

/** ポートのアクセスVLAN。存在しないポート・未設定・不正な値は VLAN 1(トランクでは意味を持たない) */
export const vlanOfInterface = (iface: Pick<NetInterface, 'accessVlan'> | undefined): number =>
  iface && isValidVlanId(iface.accessVlan) ? iface.accessVlan : DEFAULT_VLAN;

export const vlanOfPort = (node: NetNode, ifaceId: string): number =>
  vlanOfInterface(node.interfaces.find(i => i.id === ifaceId));

/** 指定VLANのフレームが出られるポート: そのVLANのアクセスポートと、すべてのトランク(受けたポートは除く指定ができる) */
export const portsInVlan = (node: NetNode, vlan: number, exceptId?: string): string[] =>
  node.interfaces
    .filter(i => i.id !== exceptId && (isTrunkInterface(i) || vlanOfInterface(i) === vlan))
    .map(i => i.id);

/** アクセスポートに設定されているVLAN番号(昇順、重複なし)。クエリを送る対象 */
export const activeVlans = (node: NetNode): number[] => {
  const set = new Set(node.interfaces.filter(i => !isTrunkInterface(i)).map(vlanOfInterface));
  // SVIのVLANも、クエリを送る対象(トランクだけでつながるL3スイッチでも、SVIのVLANにクエリを出す)
  (node.svis || []).filter(s => !!s.ip).forEach(s => set.add(s.vlan));
  if (set.size === 0) set.add(DEFAULT_VLAN); // トランクだけの機器でも、VLAN 1 は存在する
  return [...set].sort((a, b) => a - b);
};

/** 使われているVLANごとのアクセスポート名と、トランクのポート名(画面の要約用) */
export const vlanSummary = (node: NetNode): { vlan: number; ports: string[] }[] => {
  const map = new Map<number, string[]>();
  node.interfaces.filter(i => !isTrunkInterface(i)).forEach(i => {
    const v = vlanOfInterface(i);
    map.set(v, [...(map.get(v) || []), i.name]);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([vlan, ports]) => ({ vlan, ports }));
};

export const trunkPortNames = (node: NetNode): string[] => node.interfaces.filter(isTrunkInterface).map(i => i.name);

/** そのVLANの状態(無ければ空) */
export const getVlanState = (node: NetNode, vlan: number): VlanState => node.vlanState?.[vlan] ?? {};

/** そのVLANの状態を一部だけ更新した、新しい vlanState を返す(値が undefined の項目は消える) */
export const patchVlanState = (node: NetNode, vlan: number, patch: Partial<VlanState>): Record<number, VlanState> => {
  const next: VlanState = { ...getVlanState(node, vlan), ...patch };
  (Object.keys(next) as (keyof VlanState)[]).forEach(k => { if (next[k] === undefined) delete next[k]; });
  return { ...(node.vlanState || {}), [vlan]: next };
};

/** VLANごとの入れ物すべてに、同じ変換をかける(期限の補正・片付けなど) */
export const mapVlanStates = (node: NetNode, fn: (s: VlanState, vlan: number) => VlanState): Record<number, VlanState> | undefined => {
  if (!node.vlanState) return undefined;
  const out: Record<number, VlanState> = {};
  Object.entries(node.vlanState).forEach(([k, s]) => { out[Number(k)] = fn(s, Number(k)); });
  return out;
};

/** 全VLANのMAC表を空にした vlanState(他の状態は残す) */
export const clearMacTables = (node: NetNode): Record<number, VlanState> | undefined =>
  mapVlanStates(node, s => ({ ...s, macTable: {} }));

/** 画面用: すべてのVLANのMAC表を、(VLAN, MAC, ポート)の一覧にする。VLANの昇順 */
export const allMacEntries = (node: NetNode): { vlan: number; mac: string; portId: string }[] =>
  Object.entries(node.vlanState || {}).flatMap(([vlan, s]) =>
    Object.entries(s.macTable || {}).map(([mac, portId]) => ({ vlan: Number(vlan), mac, portId })))
    .sort((a, b) => a.vlan - b.vlan);

/** 画面用: すべてのVLANのIGMPスヌーピング表を、(VLAN, グループ, ポートの一覧)にする */
export const allSnoopingEntries = (node: NetNode): { vlan: number; group: string; portIds: string[] }[] =>
  Object.entries(node.vlanState || {}).flatMap(([vlan, s]) =>
    Object.entries(s.igmpSnoopingTable || {}).map(([group, portIds]) => ({ vlan: Number(vlan), group, portIds })))
    .sort((a, b) => a.vlan - b.vlan);

/**
 * そのVLANで、クエリアが使う送信元IP。空なら、IPを持たない(選挙では常に負ける)。
 * SVIがあれば、そのVLANのSVIのIP。無ければ、VLAN 1 は管理IP、他のVLANはIPなし。
 */
export const querierSourceIp = (node: NetNode, vlan: number): string =>
  node.svis?.find(s => s.vlan === vlan)?.ip || (vlan === DEFAULT_VLAN ? (node.managementIP || '') : '');

export type IngressResult =
  | { ok: true; vlan: number }
  | { ok: false; reason: 'taggedOnAccess' | 'untaggedOnTrunk' };

/**
 * フレームを受けたポートで、VLANを決める(1回だけ)。
 *  アクセス: タグ無しを受け、ポートのVLANにする。タグ付きは破棄。
 *  トランク: タグ付きを受け、そのタグのVLANにする。タグ無し・不正なタグは破棄。
 */
export const classifyIngress = (node: NetNode, ifaceId: string, vlanTag: number | undefined): IngressResult => {
  const iface = node.interfaces.find(i => i.id === ifaceId);
  if (isTrunkInterface(iface)) {
    return isValidVlanId(vlanTag) ? { ok: true, vlan: vlanTag } : { ok: false, reason: 'untaggedOnTrunk' };
  }
  if (vlanTag !== undefined) return { ok: false, reason: 'taggedOnAccess' };
  return { ok: true, vlan: vlanOfInterface(iface) };
};

/** そのポートから出すときのタグ。アクセスは無し、トランクは vlan(無ければ VLAN 1) */
export const egressTag = (node: NetNode, ifaceId: string, vlan: number | undefined): number | undefined =>
  isTrunkInterface(node.interfaces.find(i => i.id === ifaceId)) ? (vlan ?? DEFAULT_VLAN) : undefined;

export interface PortVlanWarning {
  /**
   * 'mismatch': アクセス同士で、相手のVLANが違う
   * 'modeMismatch': 片方がアクセス、もう片方がトランク
   * 'trunkToHost': トランクが、スイッチ以外(ホスト・ルーター)につながっている
   */
  kind: 'mismatch' | 'modeMismatch' | 'trunkToHost';
  peerLabel: string;
  peerPort: string;
  peerVlan: number;
}

/** ポートごとの警告。キーはポートID */
export const portVlanWarnings = (node: NetNode, nodes: NetNode[], links: NetLink[]): Record<string, PortVlanWarning> => {
  const out: Record<string, PortVlanWarning> = {};
  if (!isVlanSwitch(node)) return out;
  for (const iface of node.interfaces) {
    const link = links.find(l => (l.from === node.id && l.fromInterfaceId === iface.id) || (l.to === node.id && l.toInterfaceId === iface.id));
    if (!link) continue;
    const mine = link.from === node.id && link.fromInterfaceId === iface.id;
    const peerNode = nodes.find(n => n.id === (mine ? link.to : link.from));
    const peerIface = peerNode?.interfaces.find(i => i.id === (mine ? link.toInterfaceId : link.fromInterfaceId));
    if (!peerNode || !peerIface) continue;
    const info = { peerLabel: peerNode.label, peerPort: peerIface.name, peerVlan: vlanOfInterface(peerIface) };
    if (!isVlanSwitch(peerNode)) {
      if (isTrunkInterface(iface) && peerNode.type !== 'hub') out[iface.id] = { kind: 'trunkToHost', ...info };
      continue;
    }
    if (isTrunkInterface(iface) !== isTrunkInterface(peerIface)) out[iface.id] = { kind: 'modeMismatch', ...info };
    else if (!isTrunkInterface(iface) && info.peerVlan !== vlanOfInterface(iface)) out[iface.id] = { kind: 'mismatch', ...info };
  }
  return out;
};
