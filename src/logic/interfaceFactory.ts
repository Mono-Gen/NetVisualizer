import type { NetNode, NetInterface, NodeType } from '../types/network';
import { generateId } from './networkUtils';

/**
 * インターフェース(ポート)生成の唯一の入口。
 * Why: Sidebar・設定画面・サンプルでポート名/MAC/既定値の決め方が食い違っていたため集約する。
 */

/** ノード種別ごとのポート数の範囲。min===max はポート数を変更できない種別 */
export const PORT_LIMITS: Record<NodeType, { min: number; max: number }> = {
  pc: { min: 1, max: 4 },
  server: { min: 1, max: 4 },
  dns: { min: 1, max: 1 },
  dhcp: { min: 1, max: 1 },
  switch: { min: 2, max: 24 },
  hub: { min: 2, max: 24 },
  l3switch: { min: 2, max: 24 },
  router: { min: 2, max: 8 }
};

/** 初期ポート数(Sidebarからの追加時) */
export const DEFAULT_PORT_COUNT: Record<NodeType, number> = {
  pc: 1, server: 1, dns: 1, dhcp: 1, switch: 8, hub: 8, l3switch: 8, router: 4
};

export const canChangePortCount = (type: NodeType): boolean =>
  PORT_LIMITS[type].min !== PORT_LIMITS[type].max;

/** 全ノードで使用中のMACを集める(重複回避用) */
export const collectMacs = (nodes: NetNode[]): Set<string> =>
  new Set(nodes.flatMap(n => n.interfaces.map(i => i.mac.toUpperCase())).filter(Boolean));

const byte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');

/** 使用中MACと重複しないMACを返す(ハブはMACを持たない) */
export const generateUniqueMac = (used: Set<string>): string => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const mac = `00:00:00:${byte()}:${byte()}:${byte()}`.toUpperCase();
    if (!used.has(mac)) return mac;
  }
  throw new Error('Could not generate a unique MAC address');
};

/** 未使用の最小の eth{n} 名を返す(ポートを削除した後に追加しても名前が重ならない) */
const nextIfaceName = (existing: NetInterface[]): string => {
  const names = new Set(existing.map(i => i.name));
  let n = 0;
  while (names.has(`eth${n}`)) n++;
  return `eth${n}`;
};

/**
 * 新しいインターフェースを作る。
 * @param existing このノードが既に持つインターフェース(名前の重複回避)
 * @param usedMacs 全ノードのMAC集合(呼び出し側が collectMacs で用意)
 */
export const createInterface = (
  type: NodeType,
  existing: NetInterface[],
  usedMacs: Set<string>
): NetInterface => {
  const isFirst = existing.length === 0;
  const isL2Only = type === 'hub' || type === 'switch';
  const mac = type === 'hub' ? '' : generateUniqueMac(usedMacs);
  if (mac) usedMacs.add(mac);

  let ip = '';
  let subnet = '';
  if (!isL2Only) {
    if (type === 'dhcp' && isFirst) {
      // DHCPサーバーは固定IPが必要
      ip = '192.168.1.254';
      subnet = '255.255.255.0';
    } else if (isFirst) {
      // 他のノードは最初のIFがAPIPA(169.254.x.x)
      ip = `169.254.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
      subnet = '255.255.0.0';
    } else {
      subnet = '255.255.255.0';
    }
  }

  return { id: generateId('if_'), name: nextIfaceName(existing), ip, mac, subnet, gateway: '' };
};
