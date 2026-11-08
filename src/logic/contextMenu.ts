import type { NetNode, NetLink, NodeType } from '../types/network';
import { NODE_PALETTE } from './nodeFactory';
import { PORT_LIMITS, canChangePortCount } from './interfaceFactory';
import { isPortUsed } from './portLayout';
import type { DictKey } from '../i18n/en';
import type { Params } from '../i18n/translate';

/**
 * 右クリックメニューの項目組み立て(純粋関数)。
 * 方針: 構造操作(追加・削除・切断)に絞る。IPなど値の編集は設定パネルに集約し、入口を二重にしない。
 */

export type ContextTarget =
  | { kind: 'canvas'; x: number; y: number }          // x,y: 追加先のキャンバス座標
  | { kind: 'node'; nodeId: string }
  | { kind: 'port'; nodeId: string; ifaceId: string }
  | { kind: 'link'; linkId: string };

export type MenuItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'separator'; key: string }
  | { kind: 'item'; key: string; label: string; danger?: boolean; disabled?: boolean; hint?: string; run: () => void };

export interface MenuActions {
  addNode: (type: NodeType, pos: { x: number; y: number }) => void;
  selectNode: (nodeId: string) => void;
  addInterface: (nodeId: string) => void;
  removeInterface: (nodeId: string, ifaceId: string) => void;
  removeNode: (nodeId: string) => void;
  removeLink: (linkId: string) => void;
  clearArp: (nodeId: string) => void;
  clearMac: (nodeId: string) => void;
  clearDns: (nodeId: string) => void;
  /** 破壊的操作の確認。falseなら実行しない */
  confirm: (message: string) => boolean;
}

export interface MenuState {
  mode: 'DESIGN' | 'SIMULATE';
  nodes: NetNode[];
  links: NetLink[];
}

const linkIdOfPort = (links: NetLink[], nodeId: string, ifaceId: string) =>
  links.find(l => (l.from === nodeId && l.fromInterfaceId === ifaceId) || (l.to === nodeId && l.toInterfaceId === ifaceId))?.id;

export type Translator = (key: DictKey, params?: Params) => string;

export const buildContextMenuItems = (target: ContextTarget, state: MenuState, act: MenuActions, t: Translator): MenuItem[] => {
  const { mode, nodes, links } = state;
  const items: MenuItem[] = [];

  if (target.kind === 'canvas') {
    if (mode !== 'DESIGN') return [];
    items.push({ kind: 'header', key: 'h', label: t('ctx.addHere') });
    NODE_PALETTE.forEach(p => items.push({ kind: 'item', key: `add-${p.type}`, label: t(`device.${p.type}` as DictKey), run: () => act.addNode(p.type, { x: target.x, y: target.y }) }));
    return items;
  }

  if (target.kind === 'link') {
    if (mode !== 'DESIGN') return [];
    return [{ kind: 'item', key: 'del-link', label: t('ctx.deleteCable'), danger: true, run: () => act.removeLink(target.linkId) }];
  }

  const node = nodes.find(n => n.id === target.nodeId);
  if (!node) return [];

  if (target.kind === 'port') {
    if (mode !== 'DESIGN') return [];
    const iface = node.interfaces.find(i => i.id === target.ifaceId);
    if (!iface) return [];
    const linkId = linkIdOfPort(links, node.id, iface.id);
    items.push({ kind: 'header', key: 'h', label: `${node.label} · ${iface.name}` });
    items.push({
      kind: 'item', key: 'disconnect', label: t('ctx.disconnect'), danger: true,
      disabled: !linkId, hint: linkId ? undefined : t('ctx.noCable'),
      run: () => { if (linkId) act.removeLink(linkId); }
    });
    const canRemove = canChangePortCount(node.type) && node.interfaces.length > PORT_LIMITS[node.type].min;
    items.push({
      kind: 'item', key: 'rm-port', label: t('ctx.removePort'), danger: true, disabled: !canRemove,
      hint: canRemove ? undefined : t('ctx.minPorts', { n: PORT_LIMITS[node.type].min }),
      run: () => {
        if (isPortUsed(links, node.id, iface.id) && !act.confirm(t('iface.removeConfirm', { name: iface.name }))) return;
        act.removeInterface(node.id, iface.id);
      }
    });
    return items;
  }

  // node
  items.push({ kind: 'header', key: 'h', label: node.label });
  if (mode === 'DESIGN') {
    items.push({ kind: 'item', key: 'settings', label: t('ctx.openSettings'), run: () => act.selectNode(node.id) });
    if (canChangePortCount(node.type)) {
      const max = PORT_LIMITS[node.type].max;
      items.push({
        kind: 'item', key: 'add-port', label: t('ctx.addPort'), disabled: node.interfaces.length >= max,
        hint: node.interfaces.length >= max ? t('iface.maxPorts', { n: max }) : undefined,
        run: () => act.addInterface(node.id)
      });
    }
    items.push({ kind: 'separator', key: 's' });
    items.push({
      kind: 'item', key: 'del-node', label: t('settings.deleteDevice'), danger: true,
      run: () => {
        const cables = links.filter(l => l.from === node.id || l.to === node.id).length;
        if (cables > 0 && !act.confirm(t('settings.confirmDelete', { name: node.label, n: cables }))) return;
        act.removeNode(node.id);
      }
    });
    return items;
  }

  // SIMULATE: 学習テーブルのクリア(観察のやり直し用)
  if (['pc', 'router', 'server', 'dns', 'dhcp', 'l3switch'].includes(node.type)) {
    items.push({ kind: 'item', key: 'clr-arp', label: t('table.clearArp'), run: () => act.clearArp(node.id) });
  }
  if (['switch', 'l3switch'].includes(node.type)) {
    items.push({ kind: 'item', key: 'clr-mac', label: t('table.clearMac'), run: () => act.clearMac(node.id) });
  }
  if (['pc', 'server', 'router'].includes(node.type)) {
    items.push({ kind: 'item', key: 'clr-dns', label: t('table.clearDns'), run: () => act.clearDns(node.id) });
  }
  return items.length > 1 ? items : [];
};
