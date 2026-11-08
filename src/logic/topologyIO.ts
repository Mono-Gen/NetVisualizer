import type { NetNode, NetLink, NetInterface, NodeType, FwRule } from '../types/network';
import { fwRuleIssue } from './firewall';

/**
 * トポロジー(構成)の保存形式と、読み込み時の検証(純粋関数)。
 * 保存するのは「構成」だけ。学習した状態(ARP/MAC表・キャッシュ・TCP接続・リース)は保存しない。
 * 読み込みは、保存データが壊れていても、アプリが落ちないよう、全てを検証して、
 * 既知の項目だけを取り出す(ホワイトリスト)。将来のファイル読込にもそのまま使える。
 */

export const TOPOLOGY_APP = 'NetVisualizer';
export const TOPOLOGY_VERSION = 1;
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_NODES = 200;

const NODE_TYPES: NodeType[] = ['pc', 'router', 'switch', 'l3switch', 'hub', 'server', 'dns', 'dhcp'];

export type ParseResult =
  | { ok: true; nodes: NetNode[]; links: NetLink[] }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 構成の部分だけを残したノード(学習状態は含めない) */
const configOf = (n: NetNode): NetNode => {
  const out: NetNode = {
    id: n.id, type: n.type, x: n.x, y: n.y, label: n.label,
    interfaces: n.interfaces.map(i => ({
      id: i.id, name: i.name, ip: i.ip, mac: i.mac, subnet: i.subnet,
      ...(i.gateway !== undefined ? { gateway: i.gateway } : {}),
      ...(i.dns !== undefined ? { dns: i.dns } : {}),
      ...(i.metric !== undefined ? { metric: i.metric } : {})
    }))
  };
  const copy = <K extends keyof NetNode>(k: K) => { if (n[k] !== undefined) (out as any)[k] = n[k]; };
  (['managementIP', 'managementSubnet', 'igmpSnoopingEnabled', 'igmpSnoopingAgingTime', 'igmpQuerierEnabled',
    'igmpQuerierInterval', 'joinedGroups', 'dnsRecords', 'listeningPorts', 'services', 'firewall'] as (keyof NetNode)[]).forEach(copy);
  if (n.dhcpScope) out.dhcpScope = { ...n.dhcpScope, leases: {} };
  return out;
};

export const serializeTopology = (nodes: NetNode[], links: NetLink[]): string =>
  JSON.stringify({
    app: TOPOLOGY_APP,
    version: TOPOLOGY_VERSION,
    nodes: nodes.map(configOf),
    links: links.map(l => ({ id: l.id, from: l.from, to: l.to, fromInterfaceId: l.fromInterfaceId, toInterfaceId: l.toInterfaceId }))
  });

const fail = (error: string): ParseResult => ({ ok: false, error });

const parseInterface = (raw: unknown): NetInterface | null => {
  if (!isObj(raw) || !str(raw.id) || !str(raw.name) || !str(raw.ip) || !str(raw.mac) || !str(raw.subnet)) return null;
  const iface: NetInterface = { id: raw.id, name: raw.name, ip: raw.ip, mac: raw.mac, subnet: raw.subnet };
  if (str(raw.gateway)) iface.gateway = raw.gateway;
  if (str(raw.dns)) iface.dns = raw.dns;
  if (num(raw.metric)) iface.metric = raw.metric;
  return iface;
};

export const parseTopology = (text: string): ParseResult => {
  if (!str(text) || text.length > MAX_TEXT_BYTES) return fail('too-large');
  let data: unknown;
  try { data = JSON.parse(text); } catch { return fail('invalid-json'); }
  if (!isObj(data) || data.app !== TOPOLOGY_APP) return fail('not-a-topology');
  if (data.version !== TOPOLOGY_VERSION) return fail('unsupported-version');
  if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) return fail('missing-lists');
  if (data.nodes.length > MAX_NODES) return fail('too-many-nodes');

  const nodes: NetNode[] = [];
  const nodeIds = new Set<string>();
  const ifaceIds = new Set<string>();
  for (const raw of data.nodes) {
    if (!isObj(raw) || !str(raw.id) || !str(raw.label) || !num(raw.x) || !num(raw.y)) return fail('bad-node');
    if (!str(raw.type) || !NODE_TYPES.includes(raw.type as NodeType)) return fail('bad-node-type');
    if (nodeIds.has(raw.id)) return fail('duplicate-id');
    if (!Array.isArray(raw.interfaces) || raw.interfaces.length === 0) return fail('bad-interfaces');
    const interfaces: NetInterface[] = [];
    for (const r of raw.interfaces) {
      const iface = parseInterface(r);
      if (!iface) return fail('bad-interface');
      if (ifaceIds.has(iface.id)) return fail('duplicate-id');
      ifaceIds.add(iface.id);
      interfaces.push(iface);
    }
    nodeIds.add(raw.id);
    const node: NetNode = {
      id: raw.id, type: raw.type as NodeType, x: raw.x, y: raw.y, label: raw.label, interfaces,
      macTable: {}, arpTable: {}, igmpSnoopingTable: {}, joinedGroups: []
    };
    // 任意項目は、型が合うものだけ取り込む
    if (str(raw.managementIP)) node.managementIP = raw.managementIP;
    if (str(raw.managementSubnet)) node.managementSubnet = raw.managementSubnet;
    if (typeof raw.igmpSnoopingEnabled === 'boolean') node.igmpSnoopingEnabled = raw.igmpSnoopingEnabled;
    if (num(raw.igmpSnoopingAgingTime)) node.igmpSnoopingAgingTime = raw.igmpSnoopingAgingTime;
    if (typeof raw.igmpQuerierEnabled === 'boolean') node.igmpQuerierEnabled = raw.igmpQuerierEnabled;
    if (num(raw.igmpQuerierInterval)) node.igmpQuerierInterval = raw.igmpQuerierInterval;
    if (Array.isArray(raw.joinedGroups)) node.joinedGroups = raw.joinedGroups.filter(str);
    if (isObj(raw.dnsRecords)) node.dnsRecords = Object.fromEntries(Object.entries(raw.dnsRecords).filter(([, v]) => str(v))) as Record<string, string>;
    if (Array.isArray(raw.listeningPorts)) {
      node.listeningPorts = raw.listeningPorts.filter(isObj)
        .filter(p => num(p.port) && (p.protocol === 'TCP' || p.protocol === 'UDP'))
        .map(p => ({ port: p.port as number, protocol: p.protocol as 'TCP' | 'UDP', ...(str(p.service) ? { service: p.service } : {}) }));
    }
    if (Array.isArray(raw.services)) {
      node.services = raw.services.filter(isObj).filter(p => num(p.port) && str(p.protocol)).map(p => ({ port: p.port as number, protocol: p.protocol as string }));
    }
    if (isObj(raw.firewall)) {
      // 不正なルールだけを捨てる(全体の読込は失敗させない)
      const rules: FwRule[] = Array.isArray(raw.firewall.rules) ? raw.firewall.rules.filter(isObj).flatMap(x => {
        if (!str(x.id) || (x.action !== 'allow' && x.action !== 'deny') || !str(x.src) || !str(x.dst)) return [];
        if (x.protocol !== 'any' && x.protocol !== 'ICMP' && x.protocol !== 'TCP' && x.protocol !== 'UDP') return [];
        const rule: FwRule = { id: x.id, action: x.action, protocol: x.protocol, src: x.src, dst: x.dst, ...(num(x.dstPort) ? { dstPort: x.dstPort } : {}) };
        return fwRuleIssue(rule) === null ? [rule] : [];
      }) : [];
      node.firewall = { rules, defaultAction: raw.firewall.defaultAction === 'deny' ? 'deny' : 'allow' };
    }
    if (isObj(raw.dhcpScope)) {
      const d = raw.dhcpScope;
      if (str(d.startIP) && str(d.endIP) && str(d.gateway) && str(d.dns) && str(d.subnet) && num(d.leaseTime)) {
        node.dhcpScope = { startIP: d.startIP, endIP: d.endIP, gateway: d.gateway, dns: d.dns, subnet: d.subnet, leaseTime: d.leaseTime, leases: {} };
      }
    }
    nodes.push(node);
  }

  const links: NetLink[] = [];
  const linkIds = new Set<string>();
  const usedPorts = new Set<string>();
  for (const raw of data.links) {
    if (!isObj(raw) || !str(raw.id) || !str(raw.from) || !str(raw.to) || !str(raw.fromInterfaceId) || !str(raw.toInterfaceId)) return fail('bad-link');
    if (linkIds.has(raw.id)) return fail('duplicate-id');
    const a = nodes.find(n => n.id === raw.from), b = nodes.find(n => n.id === raw.to);
    if (!a || !b) return fail('dangling-link');
    if (!a.interfaces.some(i => i.id === raw.fromInterfaceId) || !b.interfaces.some(i => i.id === raw.toInterfaceId)) return fail('dangling-link');
    if (usedPorts.has(raw.fromInterfaceId) || usedPorts.has(raw.toInterfaceId)) return fail('port-reused');
    usedPorts.add(raw.fromInterfaceId); usedPorts.add(raw.toInterfaceId);
    linkIds.add(raw.id);
    links.push({ id: raw.id, from: raw.from, to: raw.to, fromInterfaceId: raw.fromInterfaceId, toInterfaceId: raw.toInterfaceId });
  }
  return { ok: true, nodes, links };
};
