import type { NetNode, NetPacket } from '../types/network';
import { isMulticastMAC, isLinkLocalMulticast } from './MulticastEngine';
import { IGMPHandler } from './IGMPHandler';
import { portsInVlan, getVlanState, classifyIngress, isVlanSwitch } from './vlan';

export interface L2ProcessingResult {
  action: 'drop' | 'forward' | 'process' | 'flood';
  forwardPorts?: string[];
  updatedMacTable?: Record<string, string>;
  updatedArpTable?: Record<string, string>;
  updatedIgmpTable?: Record<string, string[]>;
  updatedIgmpExpires?: Record<string, Record<string, number>>;
  /** mrouter・クエリアの更新が、どのVLANの状態か(受けたポートのVLAN) */
  vlan?: number;
  updatedMrouterPortId?: string;
  updatedMrouterPortExpiresAt?: number;
  updatedQuerierStandby?: boolean; // クエリアの選挙に負けたとき true
  processAtL3?: boolean;
  log?: {
    status: 'error' | 'sent' | 'dropped';
    info: string;
  };
}

const normalizeMAC = (mac: string): string => {
  if (!mac) return '';
  return mac.replace(/:/g, '').replace(/^0+/g, '').toLowerCase();
};

const compareMAC = (mac1: string, mac2: string): boolean => {
  return normalizeMAC(mac1) === normalizeMAC(mac2);
};

/**
 * Logic for L2 Devices (Hub, Switch) and L2-filtering for L3 devices
 */
export const processL2 = (
  currentNode: NetNode,
  packet: NetPacket
): L2ProcessingResult => {
  const result: L2ProcessingResult = { action: 'process' };
  const ingressPortId = packet.toInterfaceId || '';

  // 0. VLAN: スイッチは、受けたポートで1回だけ、フレームのVLANを決める(学習より前)。
  //    アクセスはタグ無し、トランクはタグ付きだけを受ける。守られていないフレームは、学習せずに破棄する。
  let ingressVlan = 1;
  if (isVlanSwitch(currentNode)) {
    const cls = classifyIngress(currentNode, ingressPortId, packet.vlanTag);
    if (!cls.ok) {
      const port = currentNode.interfaces.find(i => i.id === ingressPortId)?.name || ingressPortId;
      return {
        action: 'drop',
        log: {
          status: 'error',
          info: cls.reason === 'taggedOnAccess'
            ? `VLAN Drop: ${currentNode.label} received a tagged frame on access port ${port}. Access ports only accept untagged frames.`
            : `VLAN Drop: ${currentNode.label} received an untagged frame on trunk port ${port}. Trunk ports only accept tagged frames.`
        }
      };
    }
    ingressVlan = cls.vlan;
    result.vlan = ingressVlan;
  }
  const vlanState = getVlanState(currentNode, ingressVlan);

  // 1. MAC Learning (for Switch / L3Switch): そのVLANの表へ
  if (['switch', 'l3switch'].includes(currentNode.type) && packet.senderMAC && ingressPortId) {
    const macTable = { ...(vlanState.macTable || {}) };
    if (!compareMAC(macTable[packet.senderMAC] || '', ingressPortId)) {
      macTable[packet.senderMAC] = ingressPortId;
      result.updatedMacTable = macTable;
    }
  }

  // 2. L2 Filtering for L3 Devices (PC, Router, Server, DNS, DHCP Server)
  if (['pc', 'router', 'server', 'dns', 'dhcp'].includes(currentNode.type)) {
    // タグ付きフレームは、VLANスイッチのトランクの上だけのもの。ホストやルーターは受け付けない
    if (packet.vlanTag !== undefined) {
      return {
        action: 'drop',
        log: { status: 'dropped', info: `VLAN Drop: ${currentNode.label} received a tagged frame. Hosts and routers only accept untagged frames; connect them to an access port.` }
      };
    }
    // DROP if the packet is from ME (prevent loop/reflection processing)
    if (packet.senderMAC && currentNode.interfaces.some(i => compareMAC(i.mac, packet.senderMAC || ''))) {
      return { action: 'drop' };
    }

    const isBroadcast = packet.targetMAC === 'FF:FF:FF:FF:FF:FF';
    const isMulticast = isMulticastMAC(packet.targetMAC);
    
    // Check if the target MAC matches any of the device's interfaces
    const isForMe = isBroadcast || isMulticast || currentNode.interfaces.some(i => compareMAC(i.mac, packet.targetMAC || ''));

    if (!isForMe) {
      return { 
        action: 'drop',
        log: { status: 'dropped', info: `L2 Drop: Target MAC ${packet.targetMAC} does not match any interface of ${currentNode.label}.` }
      };
    }
    return { ...result, action: 'process' };
  }

  // 3. Hub Logic: Simple repeating to all other ports
  if (currentNode.type === 'hub') {
    // A Hub MUST NOT send the packet back to the port it arrived on.
    // If ingressPortId is missing, it will flood to all, which is dangerous.
    const otherPorts = currentNode.interfaces
      .filter(iface => ingressPortId ? iface.id !== ingressPortId : true)
      .map(iface => iface.id);
    
    return { ...result, action: 'forward', forwardPorts: otherPorts };
  }

  // 4. Switch/L3Switch Logic: MAC learning and targeted forwarding
  if (currentNode.type === 'switch' || currentNode.type === 'l3switch') {
    const isBroadcast = packet.targetMAC === 'FF:FF:FF:FF:FF:FF';
    const isMulticast = isMulticastMAC(packet.targetMAC);
    // VLAN: フレームは、受けたポートで決まったVLANに属し、そのVLANのポート(とトランク)にしか出ない
    const sameVlanPorts = portsInVlan(currentNode, ingressVlan, ingressPortId);
    
    // L3Switch intercepts packets targeted to its own MAC
    if (currentNode.type === 'l3switch') {
      const isMyMac = currentNode.interfaces.some(i => compareMAC(i.mac, packet.targetMAC || ''));
      if (isMyMac && !isBroadcast && !isMulticast) {
        return { ...result, action: 'process' };
      }
    }

    // IGMP Snooping Learning
    if (packet.protocol === 'IGMP' && ingressPortId && currentNode.igmpSnoopingEnabled !== false) {
      const igmpResult = IGMPHandler.handleSnooping(currentNode, packet, ingressPortId, ingressVlan);
      if (igmpResult.updatedIgmpTable) {
        result.updatedIgmpTable = igmpResult.updatedIgmpTable;
      }
      if (igmpResult.updatedIgmpExpires) {
        result.updatedIgmpExpires = igmpResult.updatedIgmpExpires;
      }
      if (igmpResult.updatedMrouterPortId !== undefined) {
        result.updatedMrouterPortId = igmpResult.updatedMrouterPortId;
      }
      if (igmpResult.updatedMrouterPortExpiresAt !== undefined) {
        result.updatedMrouterPortExpiresAt = igmpResult.updatedMrouterPortExpiresAt;
      }
      // 選挙の結果を、呼び出し側(エンジン)へ渡す。ここで落とすと、負けても待機に回らない
      if (igmpResult.updatedQuerierStandby !== undefined) {
        result.updatedQuerierStandby = igmpResult.updatedQuerierStandby;
      }
    }

    // IGMP Snooping Check
    if (isMulticast) {
      // RFC 4541: 224.0.0.x is Link-Local Multicast, which must always be flooded
      if (isLinkLocalMulticast(packet.targetIP)) {
        return { ...result, action: 'flood', forwardPorts: sameVlanPorts };
      }

      // If Snooping is disabled, flood to all ports except ingress
      if (currentNode.igmpSnoopingEnabled === false) {
        return { ...result, action: 'flood', forwardPorts: sameVlanPorts };
      }

      const snoopingTable = vlanState.igmpSnoopingTable || {};
      const registeredPorts = snoopingTable[packet.targetIP] || [];
      // 登録されたポートのうち、同じVLANのものだけ(アクセスポートは1つのVLANにしか属さないので、これで分離できる)
      let egressPortIds = registeredPorts.filter(p => p !== ingressPortId && sameVlanPorts.includes(p));
      
      // If there's an active mrouter port and it's not the ingress port, duplicate traffic to it
      const currentMrouterPortId = result.updatedMrouterPortId !== undefined ? result.updatedMrouterPortId : vlanState.mrouterPortId;
      if (currentMrouterPortId && currentMrouterPortId !== ingressPortId && sameVlanPorts.includes(currentMrouterPortId) && !egressPortIds.includes(currentMrouterPortId)) {
        egressPortIds = [...egressPortIds, currentMrouterPortId];
      }

      // If no receiver or mrouter port is registered, strictly drop (no flooding)
      if (egressPortIds.length === 0) {
        // ...result: このReport自体の学習結果(snooping table/MAC)を失わないために必須
        return {
          ...result,
          action: 'drop',
          log: { status: 'dropped', info: `IGMP Snooping: Target ${packet.targetIP} is unregistered. Packet dropped on ${currentNode.label}.` } 
        };
      }

      return { ...result, action: 'forward', forwardPorts: egressPortIds };
    }

    const macTable = result.updatedMacTable || vlanState.macTable || {};
    
    // Find entry using fuzzy MAC comparison
    const learnedPortId = Object.keys(macTable).find(m => compareMAC(m, packet.targetMAC || '')) 
      ? macTable[Object.keys(macTable).find(m => compareMAC(m, packet.targetMAC || ''))!] 
      : undefined;
    // 別のVLANのポートで学習した相手は、このVLANでは「未学習」として扱う(このVLANの中でフラッドする)
    const targetPortId = learnedPortId && (learnedPortId === ingressPortId || sameVlanPorts.includes(learnedPortId)) ? learnedPortId : undefined;

    if (isBroadcast || !targetPortId) {
      // 同じVLANの、受けたポート以外へフラッド
      return { 
        ...result, 
        action: 'flood', 
        forwardPorts: sameVlanPorts,
        processAtL3: currentNode.type === 'l3switch' && isBroadcast 
      };
    } else {
      // Targeted forwarding
      if (targetPortId === ingressPortId) {
        return { ...result, action: 'drop', log: { status: 'error', info: 'Switch: Source and Target port are the same' } };
      }
      return { ...result, action: 'forward', forwardPorts: [targetPortId] };
    }
  }

  return result;
};
