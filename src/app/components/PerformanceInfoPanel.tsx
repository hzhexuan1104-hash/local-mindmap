import type { PerformanceMetrics } from '../../features/mindmap/performanceMetrics';
type Props = { metrics: PerformanceMetrics; cullingEnabled: boolean; onReset: () => void };
export function PerformanceInfoPanel({ metrics, cullingEnabled, onReset }: Props) {
  const copy = async () => navigator.clipboard?.writeText(JSON.stringify({ ...metrics, content: undefined }, null, 2));
  return <section className="feature-panel performance-panel" aria-label="性能信息"><div className="panel-heading"><h2>性能信息</h2><span className="panel-note">仅本地，未包含节点内容</span></div><dl className="performance-info-grid">
    <div><dt>节点 / 渲染</dt><dd>{metrics.nodeCount} / {metrics.renderedNodeCount}</dd></div><div><dt>可见 / 连线</dt><dd>{metrics.visibleNodeCount} / {metrics.renderedEdgeCount}</dd></div><div><dt>折叠节点</dt><dd>{metrics.collapsedNodeCount}</dd></div><div><dt>布局耗时</dt><dd>{metrics.lastLayoutMs.toFixed(1)} ms</dd></div><div><dt>裁剪</dt><dd>{cullingEnabled ? '已启用' : '未启用'}</dd></div>
  </dl><div className="settings-actions"><button type="button" className="secondary-action" onClick={() => void copy()}>复制诊断 JSON</button><button type="button" className="secondary-action" onClick={onReset}>重置</button></div></section>;
}
