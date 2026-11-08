import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useNetworkStore } from '../store/useNetworkStore';
import { useT, useTLogInfo } from '../i18n/useT';
import { LOG_PROTOCOL_FILTERS, protocolLabel, routeLabel, statusGlyph, type LogEntry } from '../logic/logFormat';

/**
 * パケットログ(キャンバス下部のパネル)。
 * 1件1行(時刻 | 状態 | プロトコル | 経路 | 内容)で、幅いっぱいを使って多くの件数を見せる。
 * 高さはドラッグで変更でき、折りたたみもできる(キャンバスを狭くしすぎないため)。
 */

const HEIGHT_KEY = 'netvisualizer.logHeight';
const COLLAPSED_KEY = 'netvisualizer.logCollapsed';
const MIN_HEIGHT = 96;
const DEFAULT_HEIGHT = 190;
const HEADER_HEIGHT = 38;
const COLUMNS = '58px 74px 130px minmax(170px, 1.1fr) minmax(220px, 3fr)';

const readNumber = (key: string, fallback: number): number => {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= MIN_HEIGHT ? v : fallback;
  } catch { return fallback; }
};
const readBool = (key: string): boolean => {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
};
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* 保存できなくても動作する */ }
};

const statusColor = (status?: string) =>
  status === 'error' ? 'var(--c-red)' : status === 'dropped' ? 'var(--c-slate)' : status === 'sent' ? 'var(--c-blue)' : status === 'received' ? 'var(--c-green)' : 'var(--text-dim)';

export const LogPanel: React.FC = () => {
  const t = useT();
  const tInfo = useTLogInfo();
  const { packetLogs, clearPacketLogs } = useNetworkStore();
  const [height, setHeight] = useState(() => readNumber(HEIGHT_KEY, DEFAULT_HEIGHT));
  const [collapsed, setCollapsed] = useState(() => readBool(COLLAPSED_KEY));
  const [filter, setFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const logs = packetLogs as LogEntry[];
  const visible = useMemo(
    () => (filter === 'ALL' ? logs : logs.filter(l => l.protocol === filter)),
    [logs, filter]
  );

  // 上辺のハンドルをドラッグして高さを変える。上限は画面の6割(キャンバスを潰さない)
  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: height };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const max = Math.max(MIN_HEIGHT, window.innerHeight * 0.6);
      const next = dragRef.current.startHeight + (dragRef.current.startY - ev.clientY);
      setHeight(Math.min(max, Math.max(MIN_HEIGHT, next)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => { write(HEIGHT_KEY, String(Math.round(height))); }, [height]);
  useEffect(() => { write(COLLAPSED_KEY, collapsed ? '1' : '0'); }, [collapsed]);

  const cell: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <section
      aria-label={t('sidebar.packetLogs')}
      className="glass"
      style={{ flexShrink: 0, height: collapsed ? HEADER_HEIGHT : height + HEADER_HEIGHT, display: 'flex', flexDirection: 'column', borderRadius: '14px', overflow: 'hidden', position: 'relative' }}
    >
      {!collapsed && (
        <div
          onPointerDown={onResizeStart}
          title={t('logPanel.resize')}
          role="separator"
          aria-orientation="horizontal"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize', zIndex: 2 }}
        />
      )}

      <header style={{ height: HEADER_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', borderBottom: collapsed ? 'none' : '1px solid var(--border-color)' }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn-icon"
          aria-expanded={!collapsed}
          title={collapsed ? t('logPanel.expand') : t('logPanel.collapse')}
          aria-label={collapsed ? t('logPanel.expand') : t('logPanel.collapse')}
          style={{ width: '24px', height: '24px' }}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="form-label" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>{t('sidebar.packetLogs')}</span>
        <span className="label-mono" style={{ color: 'var(--text-dim)' }}>{t('logPanel.count', { n: visible.length })}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)' }}>
            {t('logPanel.filter')}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={t('logPanel.filter')}
              style={{ background: 'rgba(var(--shade), 0.3)', color: 'var(--text-main)', fontSize: '11px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 6px' }}
            >
              <option value="ALL" style={{ color: 'var(--text-main)', background: 'var(--node-bg)' }}>{t('logPanel.filterAll')}</option>
              {LOG_PROTOCOL_FILTERS.map(p => (
                <option key={p} value={p} style={{ color: 'var(--text-main)', background: 'var(--node-bg)' }}>{p}</option>
              ))}
            </select>
          </label>
          <button onClick={clearPacketLogs} className="btn btn-glass btn-small" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trash2 size={12} /> {t('sidebar.clearLogs')}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div role="table" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: '8px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
            <span role="columnheader">{t('logPanel.colTime')}</span>
            <span role="columnheader">{t('logPanel.colStatus')}</span>
            <span role="columnheader">{t('logPanel.colProtocol')}</span>
            <span role="columnheader">{t('logPanel.colRoute')}</span>
            <span role="columnheader">{t('logPanel.colDetails')}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '16px', fontSize: '12px' }}>{t('sidebar.noActivity')}</div>
            )}
            {visible.map(log => {
              const color = statusColor(log.status);
              const info = tInfo(log.info || '');
              const extra = log.payload?.message ? ` 💬 "${log.payload.message}"` : '';
              const expanded = expandedId === log.id;
              const statusText =
                log.status === 'error' ? t('log.error') :
                log.status === 'received' ? t('log.rcvd') :
                log.status === 'sent' ? t('log.sent') :
                log.status === 'dropped' ? t('log.drop') : '';
              return (
                <div
                  key={log.id}
                  role="row"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  title={`${info}${extra}`}
                  className="label-mono"
                  style={{
                    display: 'grid', gridTemplateColumns: COLUMNS, gap: '8px', alignItems: expanded ? 'start' : 'center',
                    padding: '3px 12px', cursor: 'pointer', borderLeft: `3px solid ${color}`,
                    background: expanded ? 'rgba(var(--ink), 0.06)' : 'transparent', fontSize: '11px'
                  }}
                >
                  <span role="cell" style={{ ...cell, color: 'var(--text-dim)' }}>{log.time || ''}</span>
                  <span role="cell" style={{ ...cell, color, fontWeight: 700 }}>{statusGlyph(log.status)} {statusText}</span>
                  <span role="cell" style={{ ...cell, color }}>{protocolLabel(log)}</span>
                  <span role="cell" style={{ ...cell, color: 'var(--text-main)' }}>{routeLabel(log)}</span>
                  <span role="cell" style={expanded ? { whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--text-main)' } : { ...cell, color: 'var(--text-main)' }}>{info}{extra}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
