import type { NetNode, NetLink, NodeType } from '../types/network';

/**
 * 初心者向けサンプルトポロジー。
 * Why: 空のキャンバスから始めると「何をすればよいか」が分からないため、
 * 目的別にすぐ観察できる構成を用意する。IP/MACは固定値で、構成内で重複しない。
 */

export interface SampleTopology {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: NetNode[]; links: NetLink[] };
}

// ノード生成の共通ヘルパー(Sidebar.handleAddNode と同じ初期フィールドを持つ)
// MACは連番で採番し、サンプル内で必ず一意にする(buildごとにリセット)
const MAC_SEQ = {
  value: 0,
  next() { this.value += 1; return this.value; },
  reset() { this.value = 0; }
};

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

const makeIface = (nodeKey: string, index: number, ip: string, subnet: string, gateway = '') => ({
  id: `${nodeKey}_if${index}`,
  name: `eth${index}`,
  ip,
  mac: `00:00:00:00:${hex2(Math.floor(MAC_SEQ.next() / 256))}:${hex2(MAC_SEQ.value % 256)}`.toUpperCase(),
  subnet,
  gateway
});

const makeNode = (
  id: string, type: NodeType, label: string, x: number, y: number,
  interfaces: NetNode['interfaces'], extra: Partial<NetNode> = {}
): NetNode => ({
  id, type, label, x, y, interfaces,
  macTable: {}, arpTable: {}, igmpSnoopingTable: {}, joinedGroups: [],
  ...extra
});

// 空きポート(IP無し)を count 個作る。スイッチ・ルーターの未使用ポート用
const makeSwitchPorts = (key: string, count: number) =>
  Array.from({ length: count }, (_, i) => makeIface(key, i, '', ''));

const link = (id: string, from: NetNode, fromIf: number, to: NetNode, toIf: number): NetLink => ({
  id, from: from.id, to: to.id,
  fromInterfaceId: from.interfaces[fromIf].id,
  toInterfaceId: to.interfaces[toIf].id
});

const LAN = '255.255.255.0';

const basicLan: SampleTopology = {
  id: 'basic-lan',
  name: '1. Basic LAN (ARP & Ping)',
  description: '2 PCs + Switch. In Simulate mode, select PC 1 and ping 10.0.0.2 to watch ARP, then ICMP.',
  build: () => {
    MAC_SEQ.reset();
    const sw = makeNode('sw1', 'switch', 'Switch 1', 380, 120, makeSwitchPorts('sw1', 8));
    const pc1 = makeNode('pc1', 'pc', 'PC 1', 180, 320, [makeIface('pc1', 0, '10.0.0.1', LAN)]);
    const pc2 = makeNode('pc2', 'pc', 'PC 2', 580, 320, [makeIface('pc2', 0, '10.0.0.2', LAN)]);
    return { nodes: [sw, pc1, pc2], links: [link('l1', pc1, 0, sw, 0), link('l2', pc2, 0, sw, 1)] };
  }
};

const routed: SampleTopology = {
  id: 'routed',
  name: '2. Two Networks via Router',
  description: 'PC 1 (192.168.1.0/24) and PC 2 (192.168.2.0/24) joined by a router. Ping 192.168.2.10 from PC 1 and watch the gateway ARP.',
  build: () => {
    MAC_SEQ.reset();
    const sw1 = makeNode('sw1', 'switch', 'Switch 1', 140, 120, makeSwitchPorts('sw1', 8));
    const sw2 = makeNode('sw2', 'switch', 'Switch 2', 620, 120, makeSwitchPorts('sw2', 8));
    const rt = makeNode('rt1', 'router', 'Router 1', 380, 120, [
      makeIface('rt1', 0, '192.168.1.1', LAN),
      makeIface('rt1', 1, '192.168.2.1', LAN),
      makeIface('rt1', 2, '', '255.255.0.0'),
      makeIface('rt1', 3, '', '255.255.0.0')
    ]);
    const pc1 = makeNode('pc1', 'pc', 'PC 1', 140, 340, [makeIface('pc1', 0, '192.168.1.10', LAN, '192.168.1.1')]);
    const pc2 = makeNode('pc2', 'pc', 'PC 2', 620, 340, [makeIface('pc2', 0, '192.168.2.10', LAN, '192.168.2.1')]);
    return {
      nodes: [sw1, sw2, rt, pc1, pc2],
      links: [
        link('l1', pc1, 0, sw1, 0), link('l2', sw1, 1, rt, 0),
        link('l3', rt, 1, sw2, 1), link('l4', pc2, 0, sw2, 0)
      ]
    };
  }
};

const igmp: SampleTopology = {
  id: 'igmp',
  name: '3. IGMP Snooping',
  description: 'Sender + 2 receivers on a switch with a Querier. Make Receiver 1 join 239.1.1.1, then send multicast from the Sender: only Receiver 1 gets it.',
  build: () => {
    MAC_SEQ.reset();
    const sw = makeNode('sw1', 'switch', 'Switch 1', 380, 120, makeSwitchPorts('sw1', 8), {
      managementIP: '10.0.0.254',
      managementSubnet: LAN,
      igmpSnoopingEnabled: true,
      igmpSnoopingAgingTime: 60,
      igmpQuerierEnabled: true,
      igmpQuerierInterval: 20
    });
    const tx = makeNode('pc1', 'pc', 'Sender', 140, 340, [makeIface('pc1', 0, '10.0.0.1', LAN)]);
    const rx1 = makeNode('pc2', 'pc', 'Receiver 1', 380, 360, [makeIface('pc2', 0, '10.0.0.2', LAN)]);
    const rx2 = makeNode('pc3', 'pc', 'Receiver 2', 620, 340, [makeIface('pc3', 0, '10.0.0.3', LAN)]);
    return {
      nodes: [sw, tx, rx1, rx2],
      links: [link('l1', tx, 0, sw, 0), link('l2', rx1, 0, sw, 1), link('l3', rx2, 0, sw, 2)]
    };
  }
};

const switchLoop: SampleTopology = {
  id: 'switch-loop',
  name: '4. Switch Loop (Broadcast Storm)',
  description: 'Two switches joined by three cables. Ping 10.0.0.2 from PC 1: the ARP broadcast is copied around the loop and the packet count explodes. Pause to watch the MAC tables flip between ports, then remove two of the three cables.',
  build: () => {
    MAC_SEQ.reset();
    const sw1 = makeNode('sw1', 'switch', 'Switch 1', 160, 200, makeSwitchPorts('sw1', 8));
    const sw2 = makeNode('sw2', 'switch', 'Switch 2', 560, 200, makeSwitchPorts('sw2', 8));
    const pc1 = makeNode('pc1', 'pc', 'PC 1', 160, 420, [makeIface('pc1', 0, '10.0.0.1', LAN)]);
    const pc2 = makeNode('pc2', 'pc', 'PC 2', 560, 420, [makeIface('pc2', 0, '10.0.0.2', LAN)]);
    return {
      nodes: [sw1, sw2, pc1, pc2],
      links: [
        link('l1', sw1, 0, sw2, 0), link('l2', sw1, 1, sw2, 1), link('l3', sw1, 2, sw2, 2),
        link('l4', pc1, 0, sw1, 3), link('l5', pc2, 0, sw2, 3)
      ]
    };
  }
};

const multiNic: SampleTopology = {
  id: 'multi-nic',
  name: '5. PC with Two NICs',
  description: 'PC 1 has two NICs on two different networks. Ping 192.168.1.20 and 192.168.2.20 and watch which NIC each packet leaves from. Then give both NICs the same network and change the Metric.',
  build: () => {
    MAC_SEQ.reset();
    const sw1 = makeNode('sw1', 'switch', 'Switch 1', 140, 120, makeSwitchPorts('sw1', 8));
    const sw2 = makeNode('sw2', 'switch', 'Switch 2', 620, 120, makeSwitchPorts('sw2', 8));
    // 2つのNIC。eth0 は 192.168.1.0/24、eth1 は 192.168.2.0/24
    const pc1 = makeNode('pc1', 'pc', 'PC 1', 380, 380, [
      makeIface('pc1', 0, '192.168.1.10', LAN),
      makeIface('pc1', 1, '192.168.2.10', LAN)
    ]);
    const pc2 = makeNode('pc2', 'pc', 'PC 2', 140, 380, [makeIface('pc2', 0, '192.168.1.20', LAN)]);
    const pc3 = makeNode('pc3', 'pc', 'PC 3', 620, 380, [makeIface('pc3', 0, '192.168.2.20', LAN)]);
    return {
      nodes: [sw1, sw2, pc1, pc2, pc3],
      links: [
        link('l1', pc1, 0, sw1, 0), link('l2', pc1, 1, sw2, 0),
        link('l3', pc2, 0, sw1, 1), link('l4', pc3, 0, sw2, 1)
      ]
    };
  }
};

const firewall: SampleTopology = {
  id: 'firewall',
  name: '6. Firewall Blocks Ping',
  description: 'Same network as sample 2, but the router denies ping from 192.168.1.0/24 to 192.168.2.0/24. Ping from PC 1 times out; open the router to see the rule.',
  build: () => {
    const { nodes, links } = routed.build();
    const rt = nodes.find(n => n.id === 'rt1')!;
    rt.firewall = {
      rules: [{ id: 'fw_sample_1', action: 'deny', protocol: 'ICMP', src: '192.168.1.0/24', dst: '192.168.2.0/24' }],
      defaultAction: 'allow'
    };
    return { nodes, links };
  }
};

const natSample: SampleTopology = {
  id: 'nat',
  name: '7. NAT Lets Inside PCs Go Out',
  description: 'Two inside PCs reach an outside server through a router with NAT. The server has no route back to the inside network; turn NAT off to see the difference.',
  build: () => {
    MAC_SEQ.reset();
    const sw1 = makeNode('sw1', 'switch', 'Switch 1', 140, 120, makeSwitchPorts('sw1', 8));
    const sw2 = makeNode('sw2', 'switch', 'Switch 2', 620, 120, makeSwitchPorts('sw2', 8));
    const rt = makeNode('rt1', 'router', 'Router 1', 380, 120, [
      makeIface('rt1', 0, '192.168.1.1', LAN),
      makeIface('rt1', 1, '203.0.113.1', LAN),
      makeIface('rt1', 2, '', '255.255.0.0'),
      makeIface('rt1', 3, '', '255.255.0.0')
    ]);
    rt.nat = { enabled: true, outsideInterfaceId: 'rt1_if1' };
    const pc1 = makeNode('pc1', 'pc', 'PC 1', 60, 340, [makeIface('pc1', 0, '192.168.1.10', LAN, '192.168.1.1')]);
    const pc2 = makeNode('pc2', 'pc', 'PC 2', 220, 340, [makeIface('pc2', 0, '192.168.1.20', LAN, '192.168.1.1')]);
    // 外側のサーバーにはゲートウェイを設定しない: NATが無いと、内側(192.168.1.0/24)へ応答を返せない
    // TCP 80 で待ち受ける(TCP接続の観察用)
    const srv = makeNode('srv1', 'server', 'Server 1', 620, 340, [makeIface('srv1', 0, '203.0.113.10', LAN)],
      { listeningPorts: [{ port: 80, protocol: 'TCP' }], services: [{ port: 80, protocol: 'TCP' }] });
    return {
      nodes: [sw1, sw2, rt, pc1, pc2, srv],
      links: [
        link('l1', pc1, 0, sw1, 0), link('l2', pc2, 0, sw1, 1), link('l3', sw1, 2, rt, 0),
        link('l4', rt, 1, sw2, 1), link('l5', srv, 0, sw2, 0)
      ]
    };
  }
};

export const SAMPLE_TOPOLOGIES: SampleTopology[] = [basicLan, routed, igmp, switchLoop, multiNic, firewall, natSample];
