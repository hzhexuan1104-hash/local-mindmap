import { createMindmapLayoutStyle } from './layout';
import { serializeMindmapMarkdown } from './exportMarkdown';
import { serializeLmindDocument } from './saveMindmap';
import { serializeMindmapTxt } from './exportTxt';
import type { MindmapNode, MindmapNodeType } from './types';

export type PerformanceMindmap = {
  rootNode: MindmapNode;
  nodeCount: number;
  maxDepth: number;
  generateDurationMs: number;
};

export type PerformanceBenchmarkResult = {
  nodeCount: number;
  maxDepth: number;
  generateDurationMs: number;
  lmindSerializeMs: number;
  markdownSerializeMs: number;
  jsonSerializeMs: number;
  txtSerializeMs?: number;
  layoutComputeMs: number;
};

export type MindmapStats = {
  nodeCount: number;
  maxDepth: number;
};

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function createPerformanceNode(index: number): MindmapNode {
  return {
    id: `perf-node-${index}`,
    text: `性能测试节点 ${index}`,
    remark:
      index % 7 === 0
        ? `### 备注 ${index}\n- 生成节点：${index}\n- 用于性能测试`
        : '',
    children: [],
  };
}

export function collectMindmapStats(node: MindmapNode, depth = 1): MindmapStats {
  return node.children.reduce(
    (stats, child) => {
      const childStats = collectMindmapStats(child, depth + 1);

      return {
        nodeCount: stats.nodeCount + childStats.nodeCount,
        maxDepth: Math.max(stats.maxDepth, childStats.maxDepth),
      };
    },
    { nodeCount: 1, maxDepth: depth },
  );
}

export function generateLargeMindmap(targetNodeCount: number): PerformanceMindmap {
  const safeNodeCount = Math.max(1, Math.floor(targetNodeCount));
  const startedAt = now();
  const rootNode = createPerformanceNode(1);
  rootNode.text = `${safeNodeCount} 节点性能测试`;

  const queue: MindmapNode[] = [rootNode];
  let nextIndex = 2;

  while (nextIndex <= safeNodeCount) {
    const parent = queue.shift() ?? rootNode;
    const childCount = Math.min(3, safeNodeCount - nextIndex + 1);

    for (let offset = 0; offset < childCount; offset += 1) {
      const child = createPerformanceNode(nextIndex);
      parent.children.push(child);
      queue.push(child);
      nextIndex += 1;
    }
  }

  const stats = collectMindmapStats(rootNode);

  return {
    rootNode,
    nodeCount: stats.nodeCount,
    maxDepth: stats.maxDepth,
    generateDurationMs: now() - startedAt,
  };
}

function measure(operation: () => void) {
  const startedAt = now();
  operation();
  return now() - startedAt;
}

export function runPerformanceBenchmarks(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
  themeId = 'default-blue',
  includeTxt = true,
  generateDurationMs = 0,
): PerformanceBenchmarkResult {
  const stats = collectMindmapStats(rootNode);
  const lmindSerializeMs = measure(() => {
    serializeLmindDocument(rootNode, nodeTypes, themeId);
  });
  const markdownSerializeMs = measure(() => {
    serializeMindmapMarkdown(rootNode);
  });
  const jsonSerializeMs = measure(() => {
    JSON.stringify(JSON.parse(serializeLmindDocument(rootNode, nodeTypes, themeId)));
  });
  const txtSerializeMs = includeTxt
    ? measure(() => {
        serializeMindmapTxt(rootNode);
      })
    : undefined;
  const layoutComputeMs = measure(() => {
    createMindmapLayoutStyle();
  });

  return {
    nodeCount: stats.nodeCount,
    maxDepth: stats.maxDepth,
    generateDurationMs,
    lmindSerializeMs,
    markdownSerializeMs,
    jsonSerializeMs,
    txtSerializeMs,
    layoutComputeMs,
  };
}

export function formatPerformanceResultAsMarkdown(
  result: PerformanceBenchmarkResult,
) {
  const rows = [
    ['节点总数', `${result.nodeCount}`],
    ['最大层级', `${result.maxDepth}`],
    ['生成耗时', `${result.generateDurationMs.toFixed(2)} ms`],
    ['.lmind 序列化', `${result.lmindSerializeMs.toFixed(2)} ms`],
    ['Markdown 生成', `${result.markdownSerializeMs.toFixed(2)} ms`],
    ['JSON 生成', `${result.jsonSerializeMs.toFixed(2)} ms`],
    [
      'TXT 生成',
      result.txtSerializeMs === undefined
        ? '未启用 TXT 插件'
        : `${result.txtSerializeMs.toFixed(2)} ms`,
    ],
    ['布局计算', `${result.layoutComputeMs.toFixed(2)} ms`],
  ];

  return [
    '## 思维导图性能测试结果',
    '',
    '| 指标 | 结果 |',
    '|---|---|',
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
    '',
  ].join('\n');
}
