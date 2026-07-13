import { useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapIndex } from '../../features/mindmap/mindmapIndex';
import { createOutlineRows, getVirtualRows } from '../../features/mindmap/outlineNavigation';

type OutlinePanelProps = {
  index: MindmapIndex;
  selectedNodeId: string | null;
  focusedRootId: string | null;
  onLocate: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onFocus: (nodeId: string) => void;
};

const ROW_HEIGHT = 32;

export function OutlinePanel({ index, selectedNodeId, focusedRootId, onLocate, onToggle, onFocus }: OutlinePanelProps) {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => createOutlineRows(index), [index]);
  const matchingRows = useMemo(() => query.trim() ? rows.filter((row) => {
    const node = index.nodeById.get(row.id)!;
    return `${node.text}\n${node.remark}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }) : rows, [index, query, rows]);
  const virtual = getVirtualRows(matchingRows, scrollTop, 420, ROW_HEIGHT);

  useEffect(() => {
    if (!selectedNodeId || !listRef.current) return;
    const rowIndex = matchingRows.findIndex((row) => row.id === selectedNodeId);
    if (rowIndex >= 0) listRef.current.scrollTop = Math.max(0, rowIndex * ROW_HEIGHT - 5 * ROW_HEIGHT);
  }, [matchingRows, selectedNodeId]);

  return <section className="feature-panel outline-panel" aria-label="大纲导航">
    <div className="panel-heading"><h2>大纲</h2><span className="panel-note">{index.flattenedNodeIds.length} 个节点</span></div>
    <input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点或备注" aria-label="搜索大纲" />
    <div className="outline-list" ref={listRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: virtual.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${virtual.offsetTop}px)` }}>
          {virtual.rows.map((row) => {
            const node = index.nodeById.get(row.id)!;
            return <div className={`outline-row ${selectedNodeId === row.id ? 'is-selected' : ''}`} key={row.id} style={{ height: ROW_HEIGHT, paddingLeft: 8 + row.depth * 16 }}>
              {row.hasChildren ? <button type="button" className="outline-toggle" aria-label={row.collapsed ? '展开' : '折叠'} onClick={() => onToggle(row.id)}>{row.collapsed ? '›' : '⌄'}</button> : <span className="outline-toggle-placeholder" />}
              <button type="button" className="outline-title" onClick={() => onLocate(row.id)} title={node.text}>{node.text || '未命名节点'}</button>
              {row.hasRemark ? <span aria-label="有备注" title="有备注">▤</span> : null}
              {row.hasChildren ? <span className="outline-count">{row.childCount}</span> : null}
              <button type="button" className="outline-focus" title="聚焦分支" aria-label="聚焦分支" onClick={() => onFocus(row.id)}>{focusedRootId === row.id ? '●' : '◎'}</button>
            </div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}
