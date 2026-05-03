import React from 'react';

interface TableSectionProps {
  title: string;
  color: string;
  data: Record<string, any>;
  renderRow: (key: string, value: any) => React.ReactNode;
}

export const TableSection: React.FC<TableSectionProps> = ({ title, color, data, renderRow }) => {
  const entries = Object.entries(data);
  
  return (
    <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 className="label-mono" style={{ color, fontWeight: 700, fontSize: '11px' }}>{title}</h3>
        <span className="label-mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>{entries.length} Entries</span>
      </div>
      <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody className="label-mono">
            {entries.map(([key, value]) => renderRow(key, value))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
