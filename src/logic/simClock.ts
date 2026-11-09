import type { NetNode, NetPacket } from '../types/network';

/**
 * 一時停止の補正ロジック。
 * Why: エイジングやリース期限は壁時計(Date.now)基準で保持されているため、
 * 停止中も時間が進んでしまう。再開時に「停止していた時間」を期限へ加算して、
 * 停止中にテーブルのエントリが消えないようにする。
 */

/** 速度の選択肢。UIとストアで共有する(SSOT) */
export const SIM_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

/** Date.now() を基準とする全ての期限・時刻を delta ミリ秒だけ後ろへずらす */
export const shiftNodeTimers = (nodes: NetNode[], deltaMs: number): NetNode[] => {
  if (deltaMs <= 0) return nodes;

  return nodes.map((n) => {
    const shifted: NetNode = { ...n };

    // VLANごとの mrouter の期限と、クエリの最終送信時刻
    if (n.vlanState) {
      const state: NonNullable<NetNode['vlanState']> = {};
      Object.entries(n.vlanState).forEach(([vlan, s]) => {
        const expires: Record<string, Record<string, number>> | undefined = s.igmpSnoopingExpires
          ? Object.fromEntries(Object.entries(s.igmpSnoopingExpires).map(([group, ports]) =>
              [group, Object.fromEntries(Object.entries(ports).map(([portId, at]) => [portId, at + deltaMs]))]))
          : undefined;
        state[Number(vlan)] = {
          ...s,
          ...(expires ? { igmpSnoopingExpires: expires } : {}),
          ...(s.mrouterPortExpiresAt !== undefined ? { mrouterPortExpiresAt: s.mrouterPortExpiresAt + deltaMs } : {}),
          ...(s.lastQuerierTime !== undefined ? { lastQuerierTime: s.lastQuerierTime + deltaMs } : {})
        };
      });
      shifted.vlanState = state;
    }

    if (n.dhcpScope?.leases) {
      const leases: Record<string, { ip: string; expiresAt: number }> = {};
      Object.entries(n.dhcpScope.leases).forEach(([mac, lease]) => {
        leases[mac] = { ...lease, expiresAt: lease.expiresAt + deltaMs };
      });
      shifted.dhcpScope = { ...n.dhcpScope, leases };
    }

    return shifted;
  });
};

/** ARP解決待ちパケットのタイムスタンプ(30秒GCの基準)をずらす */
export const shiftPendingTimestamps = (packets: NetPacket[], deltaMs: number): NetPacket[] => {
  if (deltaMs <= 0) return packets;
  return packets.map((p) => (p.timestamp ? { ...p, timestamp: p.timestamp + deltaMs } : p));
};

/**
 * 次に到着するパケットまでの進行量(0〜1)。パケットが無ければ null。
 * ステップ実行で「次の到着イベントまで」進めるために使う。
 */
export const progressUntilNextArrival = (packets: NetPacket[]): number | null => {
  if (packets.length === 0) return null;
  return Math.min(...packets.map((p) => Math.max(0, 1 - p.progress)));
};
