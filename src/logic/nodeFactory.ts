import type { NetNode, NodeType } from '../types/network';
import { DEFAULT_PORT_COUNT, createInterface, collectMacs } from './interfaceFactory';
import { generateId } from './networkUtils';

/**
 * ノード生成と配置位置の決定。Sidebar(クリック追加)とキャンバス(ドロップ追加)で共用する。
 */

/** サイドバーに並べる部品。表示名はラベルの接頭辞にも使う */
export const NODE_PALETTE: { type: NodeType; label: string }[] = [
  { type: 'pc', label: 'PC' },
  { type: 'router', label: 'Router' },
  { type: 'switch', label: 'Switch' },
  { type: 'l3switch', label: 'L3 Switch' },
  { type: 'server', label: 'Server' },
  { type: 'hub', label: 'Hub' },
  { type: 'dns', label: 'DNS Server' },
  { type: 'dhcp', label: 'DHCP Server' }
];

/** ドラッグ&ドロップで種別を運ぶ dataTransfer のキー */
export const DND_NODE_TYPE = 'application/x-netvisualizer-node-type';

const NODE_SIZE = 64;
const GRID_STEP = 120;
const GRID_COLUMNS = 6;
const GRID_ORIGIN = { x: 120, y: 120 };

/** 既存ノードと重ならない最初のグリッド位置(クリック追加用。乱数は使わない) */
export const findFreePosition = (nodes: NetNode[]): { x: number; y: number } => {
  for (let i = 0; i < 1000; i++) {
    const x = GRID_ORIGIN.x + (i % GRID_COLUMNS) * GRID_STEP;
    const y = GRID_ORIGIN.y + Math.floor(i / GRID_COLUMNS) * GRID_STEP;
    const overlaps = nodes.some(n => Math.abs(n.x - x) < NODE_SIZE * 1.5 && Math.abs(n.y - y) < NODE_SIZE * 1.5);
    if (!overlaps) return { x, y };
  }
  return GRID_ORIGIN;
};

/** 同じ接頭辞で未使用の最小番号のラベル(削除後に追加しても重複しない) */
const nextLabel = (prefix: string, nodes: NetNode[]): string => {
  const used = new Set(nodes.map(n => n.label));
  let n = 1;
  while (used.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
};

export const createNode = (type: NodeType, nodes: NetNode[], position?: { x: number; y: number }): NetNode => {
  const prefix = NODE_PALETTE.find(p => p.type === type)?.label ?? type;
  const usedMacs = collectMacs(nodes);
  const interfaces: NetNode['interfaces'] = [];
  for (let i = 0; i < DEFAULT_PORT_COUNT[type]; i++) {
    interfaces.push(createInterface(type, interfaces, usedMacs));
  }
  const pos = position ?? findFreePosition(nodes);

  return {
    id: generateId('n_'),
    type,
    x: pos.x,
    y: pos.y,
    label: nextLabel(prefix, nodes),
    interfaces,
    macTable: {},
    arpTable: {},
    igmpSnoopingTable: {},
    joinedGroups: [],
    ...(type === 'dhcp' ? {
      dhcpScope: {
        startIP: '192.168.1.100',
        endIP: '192.168.1.200',
        gateway: '192.168.1.1',
        dns: '192.168.1.1',
        subnet: '255.255.255.0',
        leaseTime: 3600,
        leases: {}
      }
    } : {})
  };
};
