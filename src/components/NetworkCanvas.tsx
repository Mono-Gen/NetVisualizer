import React, { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeRenderer } from './canvas/NodeRenderer';
import { LinkRenderer } from './canvas/LinkRenderer';
import { PacketRenderer } from './canvas/PacketRenderer';
import { CanvasControls } from './canvas/CanvasControls';
import { InterfaceSelector } from './canvas/InterfaceSelector';

export const NetworkCanvas: React.FC = () => {
  const { 
    nodes, links, packets, mode, isLinkMode, isDeleteMode, linkingSourceId, 
    selectedNodeId, simSourceId, zoom, isInspectMode,
    updateNodePosition, setLinkingSourceId, setSelectedNodeId, setSimSourceId, 
    setZoom, addLink, sendPacket, removeNode, removeLink 
  } = useNetworkStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [portMenu, setPortMenu] = useState<{ nodeId: string, isSource: boolean } | null>(null);
  const [pendingFromInterfaceId, setPendingFromInterfaceId] = useState<string | null>(null);
  const [simTargetId, setSimTargetId] = useState<string | null>(null);

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
      />

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '5000px', height: '5000px' }}>
          {links.map(link => (
            <LinkRenderer key={link.id} link={link} nodes={nodes} isDeleteMode={isDeleteMode} onRemove={removeLink} />
          ))}
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
          />
        ))}
      </div>
    </div>
  );
};
