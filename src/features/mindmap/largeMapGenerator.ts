import type { MindmapNode } from './types';
import { collectMindmapStats } from './performanceTest';

export type LargeMindmapOptions = {
  nodeCount: number;
  maxDepth?: number;
  maxChildren?: number;
  includeRemarks?: boolean;
  includeCustomStyles?: boolean;
  seed?: number;
};

export type LargeMindmapResult = { rootNode: MindmapNode; nodeCount: number; maxDepth: number };

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function generateLargeMindmap(options: LargeMindmapOptions): LargeMindmapResult {
  const nodeCount = Math.max(1, Math.floor(options.nodeCount));
  const maxDepth = Math.max(1, Math.floor(options.maxDepth ?? 20));
  const maxChildren = Math.max(1, Math.floor(options.maxChildren ?? 6));
  const random = createRandom(options.seed ?? 1160);
  const rootNode: MindmapNode = { id: 'large-root', text: `Large map (${nodeCount})`, remark: '', children: [] };
  const candidates: Array<{ node: MindmapNode; depth: number }> = [{ node: rootNode, depth: 1 }];

  for (let index = 2; index <= nodeCount; index += 1) {
    let candidateIndex = Math.floor(random() * candidates.length);
    let candidate = candidates[candidateIndex];
    while (candidate && (candidate.depth >= maxDepth || candidate.node.children.length >= maxChildren)) {
      candidates.splice(candidateIndex, 1);
      candidateIndex = Math.floor(random() * candidates.length);
      candidate = candidates[candidateIndex];
    }
    if (!candidate) break;
    const child: MindmapNode = {
      id: `large-node-${index}`,
      text: `Test node ${index}`,
      remark: options.includeRemarks && index % 7 === 0 ? `Generated remark ${index}` : '',
      ...(options.includeCustomStyles && index % 11 === 0 ? { style: { shape: index % 22 === 0 ? 'diamond' : 'rounded', backgroundColor: '#e8f1ff', fontSize: 14 } } : {}),
      ...(index % 17 === 0 ? { collapsed: true } : {}),
      children: [],
    };
    candidate.node.children.push(child);
    candidates.push({ node: child, depth: candidate.depth + 1 });
    if (candidate.node.children.length >= maxChildren || candidate.depth >= maxDepth) candidates.splice(candidateIndex, 1);
  }
  const stats = collectMindmapStats(rootNode);
  return { rootNode, ...stats };
}
