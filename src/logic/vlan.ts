import type { NetNode, NetLink, NetInterface } from '../types/network';

/**
 * VLAN(ポートベース)の純粋関数。
 * 方針: スイッチ/L3スイッチのポートは、アクセスVLANを1つ持つ。未設定は VLAN 1(既存のトポロジーはそのまま動く)。
 * フレームは、受けたポートのVLANに属し、同じVLANのポートにしか出ない。
 */

export const VLAN_MIN = 1;
export const VLAN_MAX = 4094;
export const DEFAULT_VLAN = 1;

/** VLANを持つ機器(ハブ・ホスト・ルーターのポートは持たない) */
export const isVlanSwitch = (node: Pick<NetNode, 'type'>): boolean => node.type === 'switch' || node.type === 'l3switch';

export const isValidVlanId = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= VLAN_MIN && n <= VLAN_MAX;

/** ポートのVLAN。存在しないポートや未設定は VLAN 1 */
export const vlanOfInterface = (iface: Pick<NetInterface, 'accessVlan'> | undefined): number =>
  iface && isValidVlanId(iface.accessVlan) ? iface.accessVlan : DEFAULT_VLAN;

export const vlanOfPort = (node: NetNode, ifaceId: string): number =>
  vlanOfInterface(node.interfaces.find(i => i.id === ifaceId));

/** 指定VLANに属するポートのID一覧(ingress を除く指定ができる) */
export const portsInVlan = (node: NetNode, vlan: number, exceptId?: string): string[] =>
  node.interfaces.filter(i => i.id !== exceptId && vlanOfInterface(i) === vlan).map(i => i.id);

/** 使われているVLANごとの、ポート名の一覧(画面の要約用)。VLANの昇順 */
export const vlanSummary = (node: NetNode): { vlan: number; ports: string[] }[] => {
  const map = new Map<number, string[]>();
  node.interfaces.forEach(i => {
    const v = vlanOfInterface(i);
    map.set(v, [...(map.get(v) || []), i.name]);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([vlan, ports]) => ({ vlan, ports }));
};

export interface PortVlanWarning {
  /** 'mismatch': つながった相手のポートのVLANが、自分と違う */
  kind: 'mismatch';
  peerLabel: string;
  peerPort: string;
  peerVlan: number;
}

/** ポートごとの警告(つながった相手がVLANスイッチで、VLANが違う場合)。キーはポートID */
export const portVlanWarnings = (node: NetNode, nodes: NetNode[], links: NetLink[]): Record<string, PortVlanWarning> => {
  const out: Record<string, PortVlanWarning> = {};
  if (!isVlanSwitch(node)) return out;
  for (const iface of node.interfaces) {
    const link = links.find(l => (l.from === node.id && l.fromInterfaceId === iface.id) || (l.to === node.id && l.toInterfaceId === iface.id));
    if (!link) continue;
    const mine = link.from === node.id && link.fromInterfaceId === iface.id;
    const peerNode = nodes.find(n => n.id === (mine ? link.to : link.from));
    const peerIface = peerNode?.interfaces.find(i => i.id === (mine ? link.toInterfaceId : link.fromInterfaceId));
    if (!peerNode || !peerIface || !isVlanSwitch(peerNode)) continue;
    const peerVlan = vlanOfInterface(peerIface);
    if (peerVlan !== vlanOfInterface(iface)) {
      out[iface.id] = { kind: 'mismatch', peerLabel: peerNode.label, peerPort: peerIface.name, peerVlan };
    }
  }
  return out;
};
