import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeRenderer } from './canvas/NodeRenderer';
import { LinkRenderer } from './canvas/LinkRenderer';
import { PacketRenderer } from './canvas/PacketRenderer';
import { CanvasControls } from './canvas/CanvasControls';
import { InterfaceSelector } from './canvas/InterfaceSelector';
import { PlaybackControls } from './canvas/PlaybackControls';
import { DND_NODE_TYPE, createNode } from '../logic/nodeFactory';
import type { NodeType } from '../types/network';
import { PORT_SIZE, findNearestPort, getPortPosition, isPortUsed, validateConnection, type PortRef } from '../logic/portLayout';

export const NetworkCanvas: React.FC = () => {
  const { 
    nodes, links, packets, mode, isLinkMode, isDeleteMode, linkingSourceId, 
    selectedNodeId, simSourceId, zoom, isInspectMode, isPaused,
    updateNodePosition, addNode, setLinkingSourceId, setSelectedNodeId, setSimSourceId, 
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
  const [portMenu, setPortMenu] = useState<{ nodeId: string, isSource: boolean } | null>(null);
  const [pendingFromInterfaceId, setPendingFromInterfaceId] = useState<string | null>(null);
  const [simTargetId, setSimTargetId] = useState<string | null>(null);
  // ポートからのドラッグ配線: 配線元と現在のポインタ位置(キャンバス座標)
  const [wiring, setWiring] = useState<{ source: PortRef; x: number; y: number } | null>(null);
  const [wireMessage, setWireMessage] = useState<string | null>(null);

  const usedPortIds = useMemo(() => {
    const ids = new Set<string>();
    links.forEach(l => { ids.add(l.fromInterfaceId); ids.add(l.toInterfaceId); });
    return ids;
  }, [links]);
  const canWire = mode === 'DESIGN' && !isDeleteMode && !isLinkMode;

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
      if (mode === 'DESIGN' && selectedNodeId) {
        const activeElement = document.activeElement;
        const isTyping = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
        if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace')) {
          removeNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedNodeId, removeNode, setSelectedNodeId]);

  const selectPort = (nodeId: string, interfaceId: string, isSource: boolean) => {
    if (isSource) {
      setLinkingSourceId(nodeId);
      setPendingFromInterfaceId(interfaceId);
    } else if (linkingSourceId) {
      addLink({ 
        id: `l_${Math.random().toString(36).substr(2, 9)}`, 
        from: linkingSourceId, 
        to: nodeId,
        fromInterfaceId: pendingFromInterfaceId!,
        toInterfaceId: interfaceId
      });
      setLinkingSourceId(null);
      setPendingFromInterfaceId(null);
    }
    setPortMenu(null);
  };

  const handleNodeClick = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    if (mode === 'DESIGN') {
      if (isDeleteMode) {
        removeNode(id);
      } else if (isLinkMode) {
        // Function to check if a port is already occupied
        const isPortOccupied = (nId: string, iId: string) => 
          links.some(l => (l.from === nId && l.fromInterfaceId === iId) || (l.to === nId && l.toInterfaceId === iId));

        if (!linkingSourceId) {
          if (node.interfaces.length === 1) {
            if (!isPortOccupied(id, node.interfaces[0].id)) {
              setLinkingSourceId(id);
              setPendingFromInterfaceId(node.interfaces[0].id);
            }
          } else {
            setPortMenu({ nodeId: id, isSource: true });
          }
        } else if (linkingSourceId !== id) {
          if (node.interfaces.length === 1) {
            if (!isPortOccupied(id, node.interfaces[0].id)) {
              selectPort(id, node.interfaces[0].id, false);
            }
          } else {
            setPortMenu({ nodeId: id, isSource: false });
          }
        }
      } else {
        setSelectedNodeId(id);
      }
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
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedNodeId(null);
          setSimSourceId(null);
        }
      }}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {portMenu && (
        <InterfaceSelector 
          nodeId={portMenu.nodeId} 
          nodes={nodes} 
          links={links} 
          isSource={portMenu.isSource} 
          onSelect={selectPort} 
          onClose={() => setPortMenu(null)} 
        />
      )}

      <CanvasControls 
        mode={mode} 
        isDeleteMode={isDeleteMode} 
        isLinkMode={isLinkMode} 
        isInspectMode={isInspectMode} 
        linkingSourceId={linkingSourceId}
        zoom={zoom}
        setZoom={setZoom}
        isPaused={isPaused}
      />

      {mode === 'SIMULATE' && <PlaybackControls />}

      {wireMessage && (
        <div role="status" style={{ position: 'absolute', top: '84px', left: '50%', transform: 'translateX(-50%)', zIndex: 120, maxWidth: '80%', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#fecaca', background: 'rgba(127, 29, 29, 0.9)', border: '1px solid rgba(248, 113, 113, 0.6)' }}>
          ⚠ {wireMessage}
        </div>
      )}

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px' }}>
          {links.map(link => (
            <LinkRenderer key={link.id} link={link} nodes={nodes} isDeleteMode={isDeleteMode} onRemove={removeLink} />
          ))}
          {wiring && (() => {
            const srcNode = nodes.find(n => n.id === wiring.source.nodeId);
            if (!srcNode) return null;
            const s = getPortPosition(srcNode, wiring.source.ifaceId);
            return <line x1={s.x} y1={s.y} x2={wiring.x} y2={wiring.y} stroke="#f97316" strokeWidth="2" strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />;
          })()}
          {packets.map(packet => (
            <PacketRenderer key={packet.id} packet={packet} nodes={nodes} />
          ))}
        </svg>

        {nodes.map(node => (
          <NodeRenderer 
            key={node.id} 
            node={node} 
            isSelected={node.id === selectedNodeId} 
            isSimSource={node.id === simSourceId} 
            isSimTarget={node.id === simTargetId}
            isLinkingSource={node.id === linkingSourceId}
            isInspectMode={isInspectMode}
            mode={mode} 
            isLinkMode={isLinkMode} 
            zoom={zoom} 
            onUpdatePosition={updateNodePosition} 
            onClick={handleNodeClick} 
            usedPortIds={usedPortIds}
            wireSource={wiring ? wiring.source : null}
            canWire={canWire}
            onPortStart={handlePortStart}
          />
        ))}
      </div>
    </div>
  );
};
