import React from 'react';
import type { NetNode, NetLink } from '../../types/network';

interface InterfaceSelectorProps {
  nodeId: string;
  nodes: NetNode[];
  links: NetLink[];
  isSource: boolean;
  onSelect: (nodeId: string, interfaceId: string, isSource: boolean) => void;
  onClose: () => void;
}

export const InterfaceSelector: React.FC<InterfaceSelectorProps> = ({
  nodeId,
  nodes,
  links,
  isSource,
  onSelect,
  onClose,
}) => {
  const NetNode = nodes.find(n => n.id === nodeId);
  if (!NetNode) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', marginBottom: '12px' }}>Select Interface</h3>
        {NetNode.interfaces.map((iface) => {
          const isOccupied = links.some(l => 
            (l.from === nodeId && l.fromInterfaceId === iface.id) ||
            (l.to === nodeId && l.toInterfaceId === iface.id)
          );
          return (
            <button 
              key={iface.id}
              onClick={() => !isOccupied && onSelect(nodeId, iface.id, isSource)}
              disabled={isOccupied}
              style={{ 
                display: 'block', 
                width: '100%', 
                padding: '8px', 
                background: isOccupied ? 'rgba(255,255,255,0.05)' : '#334155', 
                color: isOccupied ? 'rgba(255,255,255,0.2)' : 'white', 
                border: 'none', 
                borderRadius: '4px', 
                marginBottom: '4px',
                cursor: isOccupied ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                textAlign: 'left'
              }}
            >
              {iface.name} {iface.ip ? `(${iface.ip})` : ''} {isOccupied ? ' - [Occupied]' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
};
