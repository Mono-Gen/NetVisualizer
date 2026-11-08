import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeRenderer } from './canvas/NodeRenderer';
import { LinkRenderer, LinkPortLabels } from './canvas/LinkRenderer';
import { PacketRenderer } from './canvas/PacketRenderer';
import { CanvasControls } from './canvas/CanvasControls';
import { PlaybackControls } from './canvas/PlaybackControls';
import { WelcomeGuide } from './canvas/WelcomeGuide';
import { ContextMenu } from './canvas/ContextMenu';
import { useT, useTMsg } from '../i18n/useT';
import { msg } from '../i18n/msg';
import type { Msg } from '../i18n/translate';
import { StormBanner } from './canvas/StormBanner';
import { ProtocolLegend } from './canvas/ProtocolLegend';
import { canvasToScreen, fitView, panBy, screenToCanvas, wheelDeltaPx, zoomAt, type View } from '../logic/viewport';
import { buildContextMenuItems, type ContextTarget } from '../logic/contextMenu';
import { DND_NODE_TYPE, createNode } from '../logic/nodeFactory';
import type { NodeType } from '../types/network';
import { PORT_SIZE, findNearestPort, getPortPosition, isPortUsed, validateConnection, type PortRef } from '../logic/portLayout';

export const NetworkCanvas: React.FC = () => {
  const { 
    nodes, links, packets, mode, 
    selectedNodeId, selectedLinkId, setSelectedLinkId, simSourceId, zoom, panX, panY, isInspectMode, isPaused,
    updateNodePosition, addNode, addInterface, removeInterface, clearNodeArpTable, clearNodeMacTable, clearDnsCache, setSelectedNodeId, setSimSourceId, 
    setView, addLink, sendPacket, removeNode, removeLink 
  } = useNetworkStore();

  const t = useT();
  const tMsg = useTMsg();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);

  // 現在の表示。イベントハンドラ(ホイール・ドラッグ)から最新値を読むために ref にも持つ
  const view: View = { x: panX, y: panY, zoom };
  const viewRef = useRef<View>(view);
  viewRef.current = view;

  /** クライアント座標 → コンテナ内の画面座標 */
  const toScreenPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // サイドバーからのドロップでノードを追加する(DESIGNモードのみ)。
  // 画面座標 → キャンバス座標: コンテナ左上を引き、ズームで割る(ノード中心がカーソルに来るよう半分戻す)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const type = e.dataTransfer.getData(DND_NODE_TYPE) as NodeType;
    if (!type || mode !== 'DESIGN') return;
    e.preventDefault();
    // 表示の移動・拡大を考慮して、キャンバス座標へ。ノードの中心がカーソルに来るよう半分戻す
    const p = screenToCanvas(viewRef.current, toScreenPoint(e.clientX, e.clientY));
    addNode(createNode(type, nodes, { x: p.x - 32, y: p.y - 32 }));
  };
  const [simTargetId, setSimTargetId] = useState<string | null>(null);
  // ポートからのドラッグ配線: 配線元と現在のポインタ位置(キャンバス座標)
  const [wiring, setWiring] = useState<{ source: PortRef; x: number; y: number } | null>(null);
  const [wireMessage, setWireMessage] = useState<Msg | null>(null);
  // 右クリックメニュー: 表示位置(コンテナ内の画面px)と対象
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // 画面座標 → キャンバス座標(ズーム補正)
  const toCanvasPoint = (clientX: number, clientY: number) =>
    screenToCanvas(viewRef.current, toScreenPoint(clientX, clientY));

  const openMenu = (target: ContextTarget, clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    // リンクを右クリックしたときは、削除対象が分かるよう選択状態にする
    if (target.kind === 'link') setSelectedLinkId(target.linkId);
    setMenu({ x: clientX - rect.left, y: clientY - rect.top, target });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = toCanvasPoint(e.clientX, e.clientY);
    openMenu({ kind: 'canvas', x: Math.max(0, p.x - 32), y: Math.max(0, p.y - 32) }, e.clientX, e.clientY);
  };

  const usedPortIds = useMemo(() => {
    const ids = new Set<string>();
    links.forEach(l => { ids.add(l.fromInterfaceId); ids.add(l.toInterfaceId); });
    return ids;
  }, [links]);
  const canWire = mode === 'DESIGN';
  const canSelectLinks = canWire;

  const handlePortStart = (nodeId: string, ifaceId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (isPortUsed(links, nodeId, ifaceId)) {
      const name = node.interfaces.find(i => i.id === ifaceId)?.name ?? '?';
      setWireMessage(msg('wire.alreadyConnected', { node: node.label, port: name }));
      return;
    }
    setWireMessage(null);
    const p = getPortPosition(node, ifaceId);
    setWiring({ source: { nodeId, ifaceId }, x: p.x, y: p.y });
  };

  // 配線ドラッグ中: ポインタ追従 → 離した位置の近くのポートへ接続 / Escapeで取消
  useEffect(() => {
    if (!wiring) return;
    const source = wiring.source;
    const toCanvas = (e: PointerEvent) => toCanvasPoint(e.clientX, e.clientY);
    const onMove = (e: PointerEvent) => setWiring(w => (w ? { ...w, ...toCanvas(e) } : w));
    const onUp = (e: PointerEvent) => {
      // 画面上で一定の許容(約16px)を持たせる。ズームアウト時でも狙いやすくする
      const target = findNearestPort(nodes, toCanvas(e), Math.max(PORT_SIZE / 2 + 2, 16 / viewRef.current.zoom));
      if (target) {
        const check = validateConnection(nodes, links, source, target);
        if (check.ok) {
          addLink({ id: `l_${Math.random().toString(36).substr(2, 9)}`, from: source.nodeId, to: target.nodeId, fromInterfaceId: source.ifaceId, toInterfaceId: target.ifaceId });
          setWireMessage(null);
        } else {
          setWireMessage(check.reason);
        }
      }
      setWiring(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setWiring(null); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [wiring !== null, nodes, links, zoom, addLink]); // eslint-disable-line react-hooks/exhaustive-deps

  // 案内メッセージは数秒で消す
  useEffect(() => {
    if (!wireMessage) return;
    const timer = setTimeout(() => setWireMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [wireMessage]);

  // ホイール: Ctrl(またはトラックパッドのピンチ)=カーソル中心の拡大縮小 / それ以外=移動(Shiftで横)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.('[role="menu"]')) return; // メニュー自身のスクロールは邪魔しない
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-wheelDeltaPx(e.deltaY, e.deltaMode, rect.height) * 0.0015);
        setView(zoomAt(v, v.zoom * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top }));
      } else {
        let dx = wheelDeltaPx(e.deltaX, e.deltaMode, rect.width);
        let dy = wheelDeltaPx(e.deltaY, e.deltaMode, rect.height);
        if (e.shiftKey) { dx = dx || dy; dy = 0; } // Shift+ホイールは横移動
        setView(panBy(v, -dx, -dy));
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [setView]);

  // 空白のドラッグ(左ボタン)またはホイールボタンのドラッグで、表示を動かす。
  // 動かさずに離した左クリックは、従来どおり「選択解除」として扱う。
  const startPan = (e: React.PointerEvent) => {
    const start = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false, button: e.button };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return; // 少しの手ぶれはクリック扱い
      start.moved = true;
      setIsPanning(true);
      setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsPanning(false);
      if (!start.moved && start.button === 0) {
        setSelectedNodeId(null);
        setSelectedLinkId(null);
        setSimSourceId(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // 拡大縮小ボタン・全体表示。ボタンの拡大縮小は画面中央を中心にする
  const containerSize = () => ({ width: containerRef.current?.clientWidth ?? 0, height: containerRef.current?.clientHeight ?? 0 });
  const zoomFromCenter = (newZoom: number) => {
    const { width, height } = containerSize();
    setView(zoomAt(viewRef.current, newZoom, { x: width / 2, y: height / 2 }));
  };
  const handleFit = () => setView(fitView(nodes, containerSize()));

  // 方眼の背景を、表示の移動・拡大に合わせて動かす(CSS変数)
  useEffect(() => {
    const host = containerRef.current?.parentElement;
    if (!host) return;
    host.style.setProperty('--view-x', `${panX}px`);
    host.style.setProperty('--view-y', `${panY}px`);
    host.style.setProperty('--view-zoom', String(zoom));
  }, [panX, panY, zoom]);

  // Keyboard Shortcuts (Delete Node)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'DESIGN' && (selectedNodeId || selectedLinkId)) {
        const activeElement = document.activeElement;
        const isTyping = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement;
        if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace')) {
          if (selectedLinkId) {
            removeLink(selectedLinkId);
            setSelectedLinkId(null);
          } else if (selectedNodeId) {
            removeNode(selectedNodeId);
            setSelectedNodeId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedNodeId, selectedLinkId, removeNode, removeLink, setSelectedNodeId, setSelectedLinkId]);

  // キーボードからメニューを開く(ContextMenuキー / Shift+F10)。選択中のケーブル→デバイスの順に対象にする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) || mode !== 'DESIGN') return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      const link = links.find(l => l.id === selectedLinkId);
      const node = nodes.find(n => n.id === selectedNodeId);
      let point: { x: number; y: number } | null = null;
      let target: ContextTarget | null = null;
      if (link) {
        const a = nodes.find(n => n.id === link.from), b = nodes.find(n => n.id === link.to);
        if (a && b) {
          const p1 = getPortPosition(a, link.fromInterfaceId), p2 = getPortPosition(b, link.toInterfaceId);
          point = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          target = { kind: 'link', linkId: link.id };
        }
      } else if (node) {
        point = { x: node.x + 32, y: node.y + 32 };
        target = { kind: 'node', nodeId: node.id };
      }
      if (!point || !target) return;
      e.preventDefault();
      const s = canvasToScreen(viewRef.current, point);
      setMenu({ x: s.x, y: s.y, target });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, nodes, links, selectedNodeId, selectedLinkId, zoom, panX, panY]);

  const handleNodeClick = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // DESIGNモード: クリックで選択(設定パネルを開く)。接続・削除はポートのドラッグ/選択+Deleteで行う
    if (mode === 'DESIGN') {
      setSelectedNodeId(id);
      return;
    }

    if (mode === 'SIMULATE') {
      if (isInspectMode) {
        setSelectedNodeId(id);
        return;
      }
      if (!simSourceId) {
        setSimSourceId(id);
        setSimTargetId(null);
        setSelectedNodeId(id);
      } else if (simSourceId === id) {
        setSimSourceId(null);
        setSimTargetId(null);
        setSelectedNodeId(null);
      } else {
        // Just switch selection
        setSimSourceId(id);
        setSelectedNodeId(id);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      onDragOver={(e) => { if (mode === 'DESIGN' && e.dataTransfer.types.includes(DND_NODE_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={handleDrop}
      onContextMenu={handleCanvasContextMenu}
      onPointerDown={(e) => {
        // 空白(コンテナ自身、または機器・線を載せる土台)の左ボタン、または、ホイールボタンで、移動を始める
        const blank = e.target === e.currentTarget || e.target === sceneRef.current;
        if ((blank && e.button === 0) || e.button === 1) startPan(e);
      }}
      onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }} // ホイールボタンの自動スクロールを防ぐ
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'default', userSelect: 'none' }}
    >
      <CanvasControls 
        mode={mode} 
        isInspectMode={isInspectMode}
        zoom={zoom}
        onZoomIn={() => zoomFromCenter(viewRef.current.zoom + 0.1)}
        onZoomOut={() => zoomFromCenter(viewRef.current.zoom - 0.1)}
        onZoomReset={() => zoomFromCenter(1)}
        onFit={handleFit}
        isPaused={isPaused}
      />

      {mode === 'SIMULATE' && <PlaybackControls />}
      {mode === 'SIMULATE' && <StormBanner />}
      {mode === 'SIMULATE' && <ProtocolLegend />}

      {nodes.length === 0 && mode === 'DESIGN' && <WelcomeGuide />}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          boundsWidth={containerRef.current?.clientWidth ?? 800}
          boundsHeight={containerRef.current?.clientHeight ?? 600}
          onClose={closeMenu}
          items={buildContextMenuItems(menu.target, { mode, nodes, links }, {
            addNode: (type, pos) => addNode(createNode(type, nodes, pos)),
            selectNode: setSelectedNodeId,
            addInterface,
            removeInterface,
            removeNode: (id) => { removeNode(id); setSelectedNodeId(null); },
            removeLink: (id) => { removeLink(id); setSelectedLinkId(null); },
            clearArp: clearNodeArpTable,
            clearMac: clearNodeMacTable,
            clearDns: clearDnsCache,
            confirm: (message) => window.confirm(message)
          }, t)}
        />
      )}

      {wireMessage && (
        <div role="status" style={{ position: 'absolute', top: '84px', left: '50%', transform: 'translateX(-50%)', zIndex: 120, maxWidth: '80%', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#fecaca', background: 'rgba(127, 29, 29, 0.9)', border: '1px solid rgba(248, 113, 113, 0.6)' }}>
          ⚠ {tMsg(wireMessage)}
        </div>
      )}

      <div ref={sceneRef} style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
        {/* svg自体はクリックを素通りさせ、リンクの当たり判定だけを個別に有効にする(空白クリックで選択解除できるように) */}
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px', pointerEvents: 'none', overflow: 'visible' }}>
          {links.map(link => (
            <LinkRenderer key={link.id} link={link} nodes={nodes} isSelected={link.id === selectedLinkId} canSelect={canSelectLinks} onSelect={setSelectedLinkId} onContextMenu={(id, x, y) => openMenu({ kind: 'link', linkId: id }, x, y)} onRemove={removeLink} />
          ))}
          {wiring && (() => {
            const srcNode = nodes.find(n => n.id === wiring.source.nodeId);
            if (!srcNode) return null;
            const s = getPortPosition(srcNode, wiring.source.ifaceId);
            return <line x1={s.x} y1={s.y} x2={wiring.x} y2={wiring.y} strokeWidth="2" strokeDasharray="6 4" style={{ stroke: 'var(--c-orange)', pointerEvents: 'none' }} />;
          })()}
        </svg>

        {nodes.map(node => (
          <NodeRenderer 
            key={node.id} 
            node={node} 
            isSelected={node.id === selectedNodeId} 
            isSimSource={node.id === simSourceId} 
            isSimTarget={node.id === simTargetId}
            isInspectMode={isInspectMode}
            mode={mode} 
            zoom={zoom} 
            onUpdatePosition={updateNodePosition} 
            onClick={handleNodeClick} 
            usedPortIds={usedPortIds}
            wireSource={wiring ? wiring.source : null}
            canWire={canWire}
            onPortStart={handlePortStart}
            onContextMenu={(target, x, y) => openMenu(target, x, y)}
          />
        ))}

        {/* ノードより上の透明な層: パケットとポート名。ノードやポートの円に隠れないようにする */}
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px', pointerEvents: 'none', zIndex: 60, overflow: 'visible' }}>
          {links.map(link => (
            <LinkPortLabels key={link.id} link={link} nodes={nodes} />
          ))}
          {packets.map(packet => (
            <PacketRenderer key={packet.id} packet={packet} nodes={nodes} />
          ))}
        </svg>
      </div>
    </div>
  );
};
