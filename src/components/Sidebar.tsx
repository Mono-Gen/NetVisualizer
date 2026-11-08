import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { NodeIcon } from './canvas/NodeIcon';
import type { NodeType } from '../types/network';
import { Plus, Play, Settings } from 'lucide-react';
import { SidebarCommandPanel } from './SidebarCommandPanel';
import { SampleMenu } from './SampleMenu';
import { ThemeToggle } from './ThemeToggle';
import { NODE_PALETTE, DND_NODE_TYPE, createNode } from '../logic/nodeFactory';
import { useT } from '../i18n/useT';
import type { DictKey } from '../i18n/en';
import { LanguageToggle } from './LanguageToggle';

export const Sidebar: React.FC = () => {
  const t = useT();
  const { 
    nodes, addNode, mode, setMode, 
    clearCanvas, selectedNodeId
  } = useNetworkStore();

  const nodeTypes = NODE_PALETTE;

  // 全消去は取り返しがつかないため、機器がある場合は確認する
  const handleClearAll = () => {
    if (nodes.length > 0 && !window.confirm(t('sidebar.confirmClearAll'))) return;
    clearCanvas();
  };

  // クリックでも追加できる(キーボード/タッチ向け)。位置は空いているグリッドに自動配置
  const handleAddNode = (type: NodeType) => addNode(createNode(type, nodes));

  return (
    <div className="sidebar glass" style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary-blue)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="white" />
        </div>
        <h1 className="heading-sm" style={{ margin: 0 }}>NetVisualizer</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', background: 'rgba(var(--shade), 0.2)', padding: '4px', borderRadius: '10px' }}>
        <button 
          onClick={() => setMode('DESIGN')} 
          className={`tab ${mode === 'DESIGN' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'DESIGN' ? 'var(--primary-blue)' : 'transparent', color: mode === 'DESIGN' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={14} /> {t('sidebar.mode.design')}
        </button>
        <button 
          onClick={() => setMode('SIMULATE')} 
          className={`tab ${mode === 'SIMULATE' ? 'active' : ''}`}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: mode === 'SIMULATE' ? 'var(--solid-green)' : 'transparent', color: mode === 'SIMULATE' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Play size={14} /> {t('sidebar.mode.simulate')}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minHeight: 0 }}>
        {mode === 'DESIGN' ? (
          <>
            <div>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>{t('sidebar.components')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {nodeTypes.map((nt) => (
                  <button 
                    key={nt.type}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData(DND_NODE_TYPE, nt.type); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => handleAddNode(nt.type)}
                    title={t('palette.hint', { name: t(`device.${nt.type}` as DictKey) })}
                    className="btn btn-glass"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px', height: 'auto', fontSize: '11px' }}
                  >
                    <NodeIcon type={nt.type} size={20} />
                    {t(`device.${nt.type}` as DictKey)}
                  </button>
                ))}
              </div>
            </div>

          </>
        ) : (
          <>
            <div>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>{t('sidebar.simTools')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                  {/* Unified Command Center for selected PC/Server */}
                  {(() => {
                    const selectedNode = nodes.find(n => n.id === selectedNodeId);
                    if (selectedNode && ['pc', 'server'].includes(selectedNode.type)) {
                      return <SidebarCommandPanel node={selectedNode} />;
                    }
                    return (
                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(var(--ink), 0.03)', borderRadius: '10px', fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', border: '1px dashed rgba(var(--ink), 0.1)' }}>
                        {t('sidebar.selectToStart')}
                      </div>
                    );
                  })()}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(var(--ink), 0.05)', paddingTop: '12px' }}>
        <SampleMenu />
      </div>

      {mode === 'DESIGN' && (
        <div style={{ borderTop: '1px solid rgba(var(--ink), 0.05)', paddingTop: '20px' }}>
          <button onClick={handleClearAll} className="btn btn-glass" style={{ width: '100%', color: 'var(--c-red)' }}>
            {t('sidebar.clearAll')}
          </button>
        </div>
      )}
      {/* 言語とテーマは、一度決めたらほとんど触らない設定なので、サイドバー下端にまとめる */}
      <div style={{ borderTop: '1px solid rgba(var(--ink), 0.08)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
};
