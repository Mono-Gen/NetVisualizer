import type { NetNode, NetInterface } from '../types/network';
import type { DictKey } from '../i18n/en';
import { isIPv4 } from './commandForm';
import { ipToLong, isInSameSubnet, prefixLength } from './networkUtils';

/**
 * インターフェース設定の入力チェック(純粋関数)。
 * 方針: 入力は止めず(途中まで打つことがあるため)、間違っていそうな箇所に、
 * 「何が・なぜ・どうすれば」を含む説明を出す。空欄は「未設定」として許す。
 */

/** サブネットマスクとして正しいか(1が連続し、その後0が続く。/1〜/32) */
export const isValidMask = (mask: string): boolean => {
  if (!isIPv4(mask)) return false;
  const m = ipToLong(mask.trim());
  const n = prefixLength(mask.trim());
  if (n === 0) return false;
  // 先頭から n 個の1が並び、残りが全て0であること
  const expected = n === 32 ? 0xFFFFFFFF : ((0xFFFFFFFF << (32 - n)) >>> 0);
  return m === expected;
};

export interface IfaceIssues {
  ip?: DictKey;
  subnet?: DictKey;
  gateway?: DictKey;
  dns?: DictKey;
}

const hasValue = (s: string | undefined): s is string => !!s && s.trim() !== '';

/** 同じIPを、別のインターフェース(他の機器、または同じ機器の別NIC)が使っているか */
const isDuplicateIp = (ip: string, iface: NetInterface, allNodes: NetNode[]): boolean =>
  allNodes.some(n => n.interfaces.some(i => i.id !== iface.id && hasValue(i.ip) && i.ip.trim() === ip.trim()));

export const interfaceIssues = (iface: NetInterface, allNodes: NetNode[]): IfaceIssues => {
  const issues: IfaceIssues = {};
  const ipOk = hasValue(iface.ip) && isIPv4(iface.ip);
  const maskOk = hasValue(iface.subnet) && isValidMask(iface.subnet);

  if (hasValue(iface.ip)) {
    if (!ipOk) issues.ip = 'ip.invalid';
    else if (isDuplicateIp(iface.ip, iface, allNodes)) issues.ip = 'ip.duplicate';
    else if (maskOk && prefixLength(iface.subnet) <= 30) {
      // ホスト部が全て0(ネットワークアドレス)または全て1(ブロードキャスト)は、機器に付けられない
      const hostMask = (~ipToLong(iface.subnet.trim())) >>> 0;
      const hostPart = (ipToLong(iface.ip.trim()) & hostMask) >>> 0;
      if (hostPart === 0 || hostPart === hostMask) issues.ip = 'ip.reserved';
    }
  }

  if (hasValue(iface.subnet) && !maskOk) issues.subnet = 'mask.invalid';

  if (hasValue(iface.gateway)) {
    if (!isIPv4(iface.gateway)) issues.gateway = 'ip.invalid';
    else if (ipOk && iface.gateway.trim() === iface.ip.trim()) issues.gateway = 'gw.self';
    else if (ipOk && maskOk && !isInSameSubnet(iface.ip.trim(), iface.gateway.trim(), iface.subnet.trim())) issues.gateway = 'gw.outside';
  }

  if (hasValue(iface.dns) && !isIPv4(iface.dns)) issues.dns = 'ip.invalid';
  return issues;
};
