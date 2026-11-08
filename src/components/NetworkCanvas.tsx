import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeRenderer } from './canvas/NodeRenderer';
import { LinkRenderer, LinkPortLabels } from './canvas/LinkRenderer';
import { PacketRenderer } from './canvas/PacketRenderer';
import { CanvasControls } from './canvas/CanvasControls';
import { PlaybackControls } from './canvas/PlaybackControls';
import { WelcomeGuide } from './canvas/WelcomeGuide';
import { ContextMenu } from './canvas/ContextMenu';
import { StormBanner } from './canvas/StormBanner';
import { buildContextMenuItems, type ContextTarget } from '../logic/contextMenu';
import { DND_NODE_TYPE, createNode } from '../logic/nodeFactory';
import type { NodeType } from '../types/network';
import { PORT_SIZE, findNearestPort, getPortPosition, isPortUsed, validateConnection, type PortRef } from '../logic/portLayout';

export const NetworkCanvas: React.FC = () => {
  const { 
    nodes, links, packets, mode, 
    selectedNodeId, selectedLinkId, setSelectedLinkId, simSourceId, zoom, isInspectMode, isPaused,
    updateNodePosition, addNode, addInterface, removeInterface, clearNodeArpTable, clearNodeMacTable, clearDnsCache, setSelectedNodeId, setSimSourceId, 
    setZoom, addLink, sendPacket, removeNode, removeLink 
  } = useNetworkStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // サイドバーからのドロップでノードを追加する(DESIGNモードのみ)。
  // 画面座標 → キャンバス座標: コンテナ左上を引き、ズームで割る(ノード中心がカーソルに来るよう半分戻す)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const type = e.dataTransfer.getData(DND_NODE_TYPE) as NodeType;
    if (!type || mode !== 'DESIGN') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, (e.clientX - rect.left) / zoom - 32);
    const y = Math.max(0, (e.clientY - rect.top) / zoom - 32);
    addNode(createNode(type, nodes, { x, y }));
  };
  const [simTargetId, setSimTargetId] = useState<string | null>(null);
  // ポートからのドラッグ配線: 配線元と現在のポインタ位置(キャンバス座標)
  const [wiring, setWiring] = useState<{ source: PortRef; x: number; y: number } | null>(null);
  const [wireMessage, setWireMessage] = useState<string | null>(null);
  // 右クリックメニュー: 表示位置(コンテナ内の画面px)と対象
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // 画面座標 → キャンバス座標(ズーム補正)
  const toCanvasPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

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
      const name = node.interfaces.find(i => i.id === ifaceId)?.name ?? 'This port';
      setWireMessage(`${node.label} ${name} is already connected. Remove the cable first (Eraser mode), then reconnect.`);
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
    const toCanvas = (e: PointerEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    };
    const onMove = (e: PointerEvent) => setWiring(w => (w ? { ...w, ...toCanvas(e) } : w));
    const onUp = (e: PointerEvent) => {
      // 画面上で一定の許容(約16px)を持たせる。ズームアウト時でも狙いやすくする
      const target = findNearestPort(nodes, toCanvas(e), Math.max(PORT_SIZE / 2 + 2, 16 / zoom));
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

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container?.removeEventListener('wheel', handleWheel);
  }, [zoom, setZoom]);

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
      setMenu({ x: point.x * zoom, y: point.y * zoom, target });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, nodes, links, selectedNodeId, selectedLinkId, zoom]);

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
        if (e.target === e.currentTarget) {
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setSimSourceId(null);
        }
      }}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <CanvasControls 
        mode={mode} 
        isInspectMode={isInspectMode}
        zoom={zoom}
        setZoom={setZoom}
        isPaused={isPaused}
      />

      {mode === 'SIMULATE' && <PlaybackControls />}
      {mode === 'SIMULATE' && <StormBanner />}

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
          })}
        />
      )}

      {wireMessage && (
        <div role="status" style={{ position: 'absolute', top: '84px', left: '50%', transform: 'translateX(-50%)', zIndex: 120, maxWidth: '80%', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#fecaca', background: 'rgba(127, 29, 29, 0.9)', border: '1px solid rgba(248, 113, 113, 0.6)' }}>
          ⚠ {wireMessage}
        </div>
      )}

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
        {/* svg自体はクリックを素通りさせ、リンクの当たり判定だけを個別に有効にする(空白クリックで選択解除できるように) */}
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px', pointerEvents: 'none' }}>
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
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px', pointerEvents: 'none', zIndex: 60 }}>
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
