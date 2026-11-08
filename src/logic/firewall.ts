import type { NetNode, NetPacket, FwRule, FirewallConfig } from '../types/network';
import type { DictKey } from '../i18n/en';
import { isIPv4 } from './commandForm';
import { ipToLong } from './networkUtils';

/**
 * ルーターのファイアウォール(純粋関数)。
 * 方針: 上から順に評価し、最初に一致したルールを適用する。どれにも一致しなければ既定の動作。
 * ステートレス: 戻りの通信も別のパケットとして評価する。
 */

export const DEFAULT_FIREWALL: FirewallConfig = { rules: [], defaultAction: 'allow' };

/** パケットの種別を、ルールのプロトコルへ寄せる(DNS/DHCP/mDNSはUDP) */
const ruleProtocolOf = (p: NetPacket): 'ICMP' | 'TCP' | 'UDP' | null => {
  switch (p.protocol) {
    case 'ICMP': return 'ICMP';
    case 'TCP': return 'TCP';
    case 'UDP': case 'DNS': case 'DHCP': case 'mDNS': return 'UDP';
    default: return null;
  }
};

/** 'any' / a.b.c.d / a.b.c.d/長さ のどれかとして正しいか */
export const isValidFwAddress = (s: string): boolean => {
  const v = s.trim();
  if (v === 'any') return true;
  const [ip, len, ...rest] = v.split('/');
  if (rest.length > 0 || !isIPv4(ip)) return false;
  if (len === undefined) return true;
  return /^\d{1,2}$/.test(len) && Number(len) >= 0 && Number(len) <= 32;
};

const addressMatches = (spec: string, ip: string): boolean => {
  const v = spec.trim();
  if (v === 'any') return true;
  if (!isIPv4(ip)) return false;
  const [base, len] = v.split('/');
  const n = len === undefined ? 32 : Number(len);
  const mask = n === 0 ? 0 : ((0xFFFFFFFF << (32 - n)) >>> 0);
  return ((ipToLong(base) & mask) >>> 0) === ((ipToLong(ip) & mask) >>> 0);
};

export const ruleMatches = (rule: FwRule, packet: NetPacket): boolean => {
  const proto = ruleProtocolOf(packet);
  if (rule.protocol !== 'any' && rule.protocol !== proto) return false;
  if (!addressMatches(rule.src, packet.senderIP)) return false;
  if (!addressMatches(rule.dst, packet.targetIP)) return false;
  if (rule.dstPort !== undefined && packet.destinationPort !== rule.dstPort) return false;
  return true;
};

export interface FwDecision {
  action: 'allow' | 'deny';
  /** 一致したルールの番号(1始まり)。既定の動作が適用されたときは undefined */
  ruleNumber?: number;
}

export const evaluateFirewall = (node: NetNode, packet: NetPacket): FwDecision => {
  const fw = node.firewall;
  if (!fw) return { action: 'allow' };
  // 入力途中(不正)のルールは、評価から外す
  const idx = fw.rules.findIndex(r => fwRuleIssue(r) === null && ruleMatches(r, packet));
  if (idx >= 0) return { action: fw.rules[idx].action, ruleNumber: idx + 1 };
  return { action: fw.defaultAction };
};

/** ルールの入力チェック。問題がなければ null */
export const fwRuleIssue = (rule: Pick<FwRule, 'protocol' | 'src' | 'dst' | 'dstPort'> & { dstPortText?: string }): DictKey | null => {
  if (!isValidFwAddress(rule.src) || !isValidFwAddress(rule.dst)) return 'fw.addr.invalid';
  const hasPort = rule.dstPortText !== undefined ? rule.dstPortText.trim() !== '' : rule.dstPort !== undefined;
  if (hasPort) {
    if (rule.protocol !== 'TCP' && rule.protocol !== 'UDP') return 'fw.port.needsProto';
    const n = rule.dstPortText !== undefined ? Number(rule.dstPortText) : rule.dstPort!;
    if (!Number.isInteger(n) || n < 1 || n > 65535) return 'fw.port.invalid';
  }
  return null;
};
