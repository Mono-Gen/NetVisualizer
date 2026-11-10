import type { NetNode, NetInterface, Svi } from '../types/network';
import { isIPv4 } from './commandForm';
import { isValidMask } from './ipValidation';
import { ipToLong, prefixLength } from './networkUtils';
import { isValidVlanId, vlanOfInterface, isTrunkInterface, DEFAULT_VLAN } from './vlan';
import { generateUniqueMac, collectMacs } from './interfaceFactory';

/**
 * L3スイッチのSVI(VLANごとの論理インターフェース)の純粋関数。
 * 方針: SVIは interfaces[] に入れない(ケーブルの端になる物理ポートと混ざるため)。
 * 既存のL3の部品(経路検索・ARP・ICMP)は node.interfaces を読むので、
 * SVIを interfaces に見せかけた「ルーティング用ビュー」を渡して再利用する。
 */

/** SVI方式のL3スイッチか(svis が配列。旧方式の保存データは undefined) */
export const isSviMode = (node: Pick<NetNode, 'type' | 'svis'>): boolean =>
  node.type === 'l3switch' && Array.isArray(node.svis);

export const sviName = (svi: Pick<Svi, 'vlan'>): string => `Vlan${svi.vlan}`;

export const sviToInterface = (svi: Svi): NetInterface => ({
  id: svi.id, name: sviName(svi), ip: svi.ip, mac: svi.mac, subnet: svi.subnet, sviVlan: svi.vlan
});

/** IPを持つSVIだけを、インターフェースの形にしたもの */
export const sviInterfaces = (node: NetNode): NetInterface[] =>
  (node.svis || []).filter(s => !!s.ip && !!s.subnet).map(sviToInterface);

/** そのVLANのSVI(IPが設定済みのもの)。無ければ undefined */
export const sviForVlan = (node: NetNode, vlan: number): Svi | undefined =>
  (node.svis || []).find(s => s.vlan === vlan && !!s.ip && !!s.subnet);

/**
 * ルーティング用ビュー。SVI方式のL3スイッチでなければ、そのノードをそのまま返す。
 * 管理IPは VLAN 1 のSVIが兼ねるので、ビューでは消す。
 * 更新はノードIDで書くので、ビューに対する結果は、そのまま実ノードに反映される。
 */
export const routingView = (node: NetNode): NetNode =>
  isSviMode(node)
    ? { ...node, managementIP: undefined, managementSubnet: undefined, interfaces: sviInterfaces(node) }
    : node;

export type SviIssue = 'vlanInvalid' | 'vlanDuplicate' | 'ipInvalid' | 'ipDuplicate' | 'ipReserved' | 'maskInvalid';

/** SVIの入力チェック。問題が無ければ null。IPと比較する他の機器は allNodes(自分自身のSVIは除いて比較) */
export const sviIssue = (svi: Svi, node: NetNode, allNodes: NetNode[]): SviIssue | null => {
  if (!isValidVlanId(svi.vlan)) return 'vlanInvalid';
  if ((node.svis || []).some(s => s.id !== svi.id && s.vlan === svi.vlan)) return 'vlanDuplicate';
  if (!isIPv4(svi.ip)) return 'ipInvalid';
  if (!isValidMask(svi.subnet)) return 'maskInvalid';
  const used = allNodes.some(n =>
    n.interfaces.some(i => i.ip && i.ip.trim() === svi.ip.trim()) ||
    (n.svis || []).some(s => s.id !== svi.id && s.ip && s.ip.trim() === svi.ip.trim()) ||
    (n.managementIP && n.managementIP.trim() === svi.ip.trim()));
  if (used) return 'ipDuplicate';
  if (prefixLength(svi.subnet) <= 30) {
    const hostMask = (~ipToLong(svi.subnet.trim())) >>> 0;
    const hostPart = (ipToLong(svi.ip.trim()) & hostMask) >>> 0;
    if (hostPart === 0 || hostPart === hostMask) return 'ipReserved';
  }
  return null;
};

/** ユニキャストのMACアドレス(xx:xx:xx:xx:xx:xx で、先頭バイトの最下位ビットが0)。マルチキャスト/ブロードキャストは機器に付けられない */
export const isUnicastMac = (mac: string): boolean =>
  /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac) && (parseInt(mac.slice(0, 2), 16) & 1) === 0;

/**
 * 読込時用: 形式だけを見て(重複はVLAN・IP・ID・MAC)、使えるSVIだけを残す。1件の不正で全体を失敗させない。
 * usedMacs / usedIds は、全機器のポートの値(呼び出し側が、全機器を読み終えてから渡す)。SVIのIDは物理ポートのIDと重ねない
 * (出口が物理ポートかSVIかを、IDで見分けるため)。
 */
export const sanitizeSvis = (raw: unknown[], usedMacs: Set<string>, usedIds: Set<string>): Svi[] => {
  const out: Svi[] = [];
  const vlans = new Set<number>(), ips = new Set<string>(), ids = new Set<string>();
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.ip !== 'string' || typeof o.subnet !== 'string' || typeof o.mac !== 'string') continue;
    if (!isValidVlanId(o.vlan) || !isIPv4(o.ip) || !isValidMask(o.subnet) || !isUnicastMac(o.mac)) continue;
    const mac = o.mac.toUpperCase();
    if (vlans.has(o.vlan) || ips.has(o.ip) || ids.has(o.id) || usedIds.has(o.id) || usedMacs.has(mac)) continue;
    vlans.add(o.vlan); ips.add(o.ip); ids.add(o.id); usedIds.add(o.id); usedMacs.add(mac);
    out.push({ id: o.id, vlan: o.vlan, ip: o.ip, subnet: o.subnet, mac: o.mac });
  }
  return out;
};

/** 次に作るSVIのVLAN: SVIがまだ無いアクセスVLANのうち最小のもの。無ければ、使われていない最小の番号 */
export const nextSviVlan = (node: NetNode): number => {
  const have = new Set((node.svis || []).map(s => s.vlan));
  const used = [...new Set(node.interfaces.filter(i => !isTrunkInterface(i)).map(vlanOfInterface))].sort((a, b) => a - b);
  const free = used.find(v => !have.has(v));
  if (free !== undefined) return free;
  let v = DEFAULT_VLAN;
  while (have.has(v)) v++;
  return v;
};

/** 新しいSVI(IPは空。全機器のMAC・既存SVIのMACと重ならないMACを振る) */
export const createSvi = (node: NetNode, allNodes: NetNode[]): Svi => {
  const macs = collectMacs(allNodes);
  allNodes.forEach(n => (n.svis || []).forEach(s => macs.add(s.mac.toUpperCase())));
  const vlan = nextSviVlan(node);
  return { id: `${node.id}_svi_${vlan}_${Math.random().toString(36).slice(2, 7)}`, vlan, ip: '', subnet: '255.255.255.0', mac: generateUniqueMac(macs) };
};
