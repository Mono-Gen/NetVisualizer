import type { Lang } from './translate';

/**
 * パケットログの文言テンプレート(英語の確定文 → 日本語)。
 *
 * 方式: ログの info は英語の確定文のまま生成される(ロジック側は変更しない)。
 * 表示時に、ここのテンプレートと全文一致で照合して、現在の言語へ訳す。一致しなければ英語のまま表示する。
 * - {名前} は任意の文字列に一致するパラメータ。
 * - 英語の文言を変えたら、ここも同じ形に直す(検証スクリプトがソースを走査して、未登録の文言を検出する)。
 * - プロトコル名・状態名(ARP, DHCP, ESTABLISHED, FIN-ACK など)は訳さない。
 */
export const LOG_TEMPLATES: ReadonlyArray<readonly [string, string]> = [
  // 応答待ちのタイムアウト
  ['Request timed out: no reply from {ip}. Check the IP address, subnet mask, gateway and cables.', '要求がタイムアウトしました: {ip} から応答がありません。IPアドレス、サブネットマスク、ゲートウェイ、ケーブルを確認してください。'],
  ['DNS query for "{name}" timed out: no response from the DNS server. Check the DNS server address and the cables.', 'DNS問い合わせ "{name}" がタイムアウトしました: DNSサーバーから応答がありません。DNSサーバーのアドレスとケーブルを確認してください。'],

  // 経路(複数NICのノードが、どのNICから送るか)
  ['Route: {dest} via {port} - connected network /{prefix}, metric {metric}', '経路: {dest} は {port} から送信 (直接つながったネットワーク /{prefix}、メトリック {metric})'],
  ['Route: {dest} via {port} - default gateway {gw}, metric {metric}', '経路: {dest} は {port} から送信 (デフォルトゲートウェイ {gw}、メトリック {metric})'],

  // L2 / L3
  ['L2 Flood: {proto}', 'L2フラッド: {proto}'],
  ['L2 Loop Detected: Packet dropped by {label} (L2 TTL expired)', 'L2ループ検出: {label} でパケットを破棄しました (L2 TTL 超過)'],
  ['L2 Drop: Target MAC {mac} does not match any interface of {label}.', 'L2破棄: 宛先MAC {mac} は {label} のどのインターフェースにも一致しません。'],
  ['IGMP Snooping: Target {ip} is unregistered. Packet dropped on {label}.', 'IGMP Snooping: 宛先 {ip} は未登録です。{label} でパケットを破棄しました。'],
  ['Switch: Source and Target port are the same', 'スイッチ: 送信元と宛先のポートが同じです'],
  ['Time Exceeded: TTL=0 when forwarding to {ip}', '時間超過: {ip} への転送中に TTL=0 になりました'],
  ['Routing Error: No route to {ip} (Destination Host Unreachable)', 'ルーティングエラー: {ip} への経路がありません (Destination Host Unreachable)'],
  ['L3 Drop: Packet for {ip} reached host {label} which is not a router.', 'L3破棄: {ip} 宛のパケットが、ルーターではないホスト {label} に届きました。'],
  ['No Gateway', 'ゲートウェイがありません'],
  ['Gateway Unreachable', 'ゲートウェイに到達できません'],
  ['No link found on {port}', '{port} にリンクが見つかりません'],

  // ARP
  ['ARP Request: Who has {ip}? Tell {from}', 'ARP要求: {ip} を持っているのは誰? {from} に教えて'],
  ['ARP Reply: {ip} is at {mac}', 'ARP応答: {ip} は {mac} にあります'],
  ['ARP Request Match! {label} is sending Reply.', 'ARP要求に一致しました。{label} が応答を返します。'],
  ['ARP Request for {ip} ignored by {label}', 'ARP要求 ({ip}) は {label} に無視されました'],
  ['ARP Reply Received: {ip} is at {mac}', 'ARP応答を受信: {ip} は {mac} にあります'],

  // ICMP
  ['ICMP Echo Request Received by {label}', '{label} が ICMP Echo Request を受信'],
  ['ICMP Echo Reply Received from {ip}', '{ip} から ICMP Echo Reply を受信'],
  ['ICMP Error ({type}) from {ip}: {err}', 'ICMPエラー ({type}) 送信元 {ip}: {err}'],

  // DHCP
  ['DHCP Pool Exhausted on {label}. Cannot offer IP.', '{label} のDHCPプールが枯渇しました。IPを提供できません。'],
  ['DHCP DISCOVER sent: Searching for DHCP Server...', 'DHCP DISCOVER を送信: DHCPサーバーを探しています...'],
  ['DHCP DISCOVER received. Offering {ip}.', 'DHCP DISCOVER を受信。{ip} を提案します。'],
  ['DHCP OFFER sent: {ip}', 'DHCP OFFER を送信: {ip}'],
  ['DHCP Conflict: IP {ip} already assigned to another host.', 'DHCP競合: IP {ip} は既に別のホストに割り当て済みです。'],
  ['DHCP REQUEST for {ip} accepted. Sending ACK.', 'DHCP REQUEST ({ip}) を受理。ACK を送信します。'],
  ['DHCP ACK sent: {ip}', 'DHCP ACK を送信: {ip}'],
  ['DHCP OFFER received: {ip}. Sending REQUEST.', 'DHCP OFFER を受信: {ip}。REQUEST を送信します。'],
  ['DHCP REQUEST sent for {ip}', '{ip} の DHCP REQUEST を送信'],
  ['DHCP ACK received. IP configured: {ip}', 'DHCP ACK を受信。IPを設定: {ip}'],

  // DNS / mDNS
  ['DNS Query for "{name}" resolved to {ip}', 'DNS問い合わせ "{name}" は {ip} に解決されました'],
  ['DNS Query for "{name}" failed (NXDOMAIN)', 'DNS問い合わせ "{name}" は失敗しました (NXDOMAIN)'],
  ['DNS Response: {name} is {ip}. Cache updated.', 'DNS応答: {name} は {ip}。キャッシュを更新しました。'],
  ['mDNS discovery failed: Device must join Multicast Group {ip} first!', 'mDNS探索に失敗: 先にこの機器がマルチキャストグループ {ip} に参加する必要があります。'],
  ['Initiating mDNS discovery for "{name}"...', '"{name}" のmDNS探索を開始します...'],
  ['mDNS Query sent: Searching for "{name}"...', 'mDNS Query を送信: "{name}" を探しています...'],
  ['mDNS Query received for "{label}"', '"{label}" 宛の mDNS Query を受信'],
  ['mDNS Response sent: I am {label}', 'mDNS Response を送信: 私は {label} です'],
  ['mDNS Query ignored by {label} ({reason})', '{label} は mDNS Query を無視しました ({reason})'],
  ['mDNS Response received: {name} is at {ip}. Cache updated.', 'mDNS Response を受信: {name} は {ip} にあります。キャッシュを更新しました。'],

  // TCP
  ['TCP RST: Port {port} closed on {label}', 'TCP RST: {label} のポート {port} は閉じています'],
  ['TCP Connection Reset by peer ({ip}). Socket closed.', 'TCP接続が相手 ({ip}) によりリセットされました。ソケットを閉じました。'],
  ['TCP SYN Received. Sending SYN-ACK.', 'TCP SYN を受信。SYN-ACK を送信します。'],
  ['TCP SYN-ACK Received. Connection ESTABLISHED.', 'TCP SYN-ACK を受信。接続が ESTABLISHED になりました。'],
  ['TCP ACK Received. Connection ESTABLISHED.', 'TCP ACK を受信。接続が ESTABLISHED になりました。'],
  ['TCP Data Received: "{text}". Sending ACK.', 'TCPデータを受信: "{text}"。ACK を送信します。'],
  ['TCP Connection CLOSED.', 'TCP接続を閉じました。'],
  ['TCP FIN Received. Sending FIN-ACK.', 'TCP FIN を受信。FIN-ACK を送信します。'],
  ['TCP FIN-ACK Received. Sending final ACK and closing socket.', 'TCP FIN-ACK を受信。最後の ACK を送信し、ソケットを閉じます。'],
  ["No active TCP socket found for {ip}:{port}. Please click 'TCP Connect' first.", "{ip}:{port} への有効なTCPソケットがありません。先に「TCP接続」を押してください。"],
  ['TCP socket for {ip}:{port} is not ESTABLISHED (Current state: {state}).', '{ip}:{port} のTCPソケットは ESTABLISHED ではありません (現在の状態: {state})。'],

  // UDP / マルチキャスト
  ['Multicast packet ignored by {label}: Not a member of group {ip}.', '{label} はマルチキャストパケットを無視しました: グループ {ip} のメンバーではありません。'],
  ['UDP {kind} on port {port} ignored by {label} (Port Closed)', 'ポート {port} 宛の UDP {kind} は {label} に無視されました (ポート閉鎖)'],
  ['UDP Port {port} closed. Sending ICMP Port Unreachable.', 'UDPポート {port} は閉じています。ICMP Port Unreachable を送信します。'],
  ['UDP Echo Request received on port {port}', 'ポート {port} で UDP Echo Request を受信'],
  ['UDP Packet received on port {port} - Message: "{text}"', 'ポート {port} で UDP パケットを受信 - メッセージ: "{text}"'],
  ['UDP Packet received on port {port}', 'ポート {port} で UDP パケットを受信'],
  ['Joining Multicast Group {ip}', 'マルチキャストグループ {ip} に参加します'],
  ['Leaving Multicast Group {ip}', 'マルチキャストグループ {ip} から退出します'],

  // 入力・ループバック
  ['Loopback test successful. {proto} processed internally.', 'ループバックテスト成功。{proto} は内部で処理されました。'],
  ['Invalid IP or Port. Please check input.', 'IPまたはポートが不正です。入力を確認してください。'],
  ['Invalid IP or Port.', 'IPまたはポートが不正です。'],
];

interface Compiled { names: string[]; re: RegExp; ja: string }

const compile = (): Compiled[] =>
  LOG_TEMPLATES.map(([en, ja]) => {
    const names: string[] = [];
    // {name} 以外の部分は正規表現として無害化し、{name} は「できるだけ短い任意の文字列」に一致させる
    const pattern = en
      .split(/(\{\w+\})/)
      .map(part => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) { names.push(m[1]); return '(.+?)'; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { names, re: new RegExp('^' + pattern + '$', 's'), ja };
  });

let compiled: Compiled[] | null = null;

/** 英語のログ文を現在の言語へ訳す。日本語でテンプレートに一致しなければ、そのまま返す */
export const translateLogInfo = (lang: Lang, info: string): string => {
  if (lang === 'en' || !info) return info;
  compiled ??= compile();
  for (const c of compiled) {
    const m = c.re.exec(info);
    if (!m) continue;
    const params: Record<string, string> = {};
    c.names.forEach((n, i) => { if (!(n in params)) params[n] = m[i + 1]; });
    return c.ja.replace(/\{(\w+)\}/g, (whole, n: string) => (n in params ? params[n] : whole));
  }
  return info;
};
