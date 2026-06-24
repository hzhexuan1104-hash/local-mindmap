import type { MindmapNode, MindmapNodeType } from './types';
import {
  formatPerformanceResultAsMarkdown,
  generateLargeMindmap,
  runPerformanceBenchmarks,
  type PerformanceBenchmarkResult,
} from './performanceTest';

type PerformancePanelProps = {
  rootNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
  themeId: string;
  canExportTxt: boolean;
  result: PerformanceBenchmarkResult | null;
  onGenerate: (
    rootNode: MindmapNode,
    result: PerformanceBenchmarkResult,
  ) => void;
  onResultChange: (result: PerformanceBenchmarkResult) => void;
  onMessage: (message: string) => void;
};

export function PerformancePanel({
  rootNode,
  nodeTypes,
  themeId,
  canExportTxt,
  result,
  onGenerate,
  onResultChange,
  onMessage,
}: PerformancePanelProps) {
  const generateAndLoad = (nodeCount: number) => {
    const generated = generateLargeMindmap(nodeCount);
    const benchmark = runPerformanceBenchmarks(
      generated.rootNode,
      nodeTypes,
      themeId,
      canExportTxt,
      generated.generateDurationMs,
    );
    onGenerate(generated.rootNode, benchmark);
  };

  const runCurrentBenchmark = () => {
    const benchmark = runPerformanceBenchmarks(
      rootNode,
      nodeTypes,
      themeId,
      canExportTxt,
    );
    onResultChange(benchmark);
    onMessage('已完成当前导图性能测试');
  };

  const copyResult = async () => {
    if (!result) {
      onMessage('暂无可复制的性能测试结果');
      return;
    }

    const markdown = formatPerformanceResultAsMarkdown(result);

    try {
      await navigator.clipboard.writeText(markdown);
      onMessage('已复制性能测试结果');
    } catch {
      onMessage('复制失败，请手动选择结果文本复制');
    }
  };

  return (
    <section className="feature-panel performance-panel" aria-label="性能测试">
      <div className="panel-heading">
        <h2>性能测试</h2>
        <span className="panel-note">纯本地生成</span>
      </div>
      <div className="compact-form">
        {[100, 500, 1000].map((nodeCount) => (
          <button
            key={nodeCount}
            type="button"
            className="secondary-action"
            onClick={() => generateAndLoad(nodeCount)}
          >
            生成 {nodeCount} 节点
          </button>
        ))}
        <button
          type="button"
          className="secondary-action"
          onClick={runCurrentBenchmark}
        >
          测试当前导图
        </button>
        <button type="button" className="secondary-action" onClick={copyResult}>
          复制结果
        </button>
      </div>

      <div className="performance-result" aria-live="polite">
        {result ? (
          <pre>{formatPerformanceResultAsMarkdown(result)}</pre>
        ) : (
          <p className="empty-note">
            可生成 100 / 500 / 1000 节点导图，或测试当前导图的内容生成耗时。
          </p>
        )}
      </div>
    </section>
  );
}

