import { describe, expect, it } from 'vitest';
import { stdout } from 'node:process';
import { createMindmapLayout } from '../layout';
import { generateLargeMindmap } from '../largeMapGenerator';
import { createMindmapIndex } from '../mindmapIndex';
import { findMindmapMatches } from '../searchReplace';
import { getVisibleNodeIds } from '../viewportCulling';

const now = () => performance.now();
const measure = <T>(operation: () => T) => {
  const startedAt = now();
  const result = operation();
  return { result, durationMs: now() - startedAt };
};

describe('mindmap performance baseline (informational)', () => {
  it.each([100, 500, 1000, 3000])('reports local baseline for %i nodes', (nodeCount) => {
    const generated = measure(() => generateLargeMindmap({ nodeCount, maxDepth: 20, maxChildren: 8, includeRemarks: true, includeCustomStyles: true, seed: 1160 }));
    const index = measure(() => createMindmapIndex(generated.result.rootNode));
    const layout = measure(() => createMindmapLayout(generated.result.rootNode));
    const search = measure(() => findMindmapMatches(generated.result.rootNode, 'Test node', 'all'));
    const culling = measure(() => getVisibleNodeIds(layout.result.nodes, { left: 0, top: 0, width: 1200, height: 800 }));
    const serialization = measure(() => JSON.stringify(generated.result.rootNode));
    stdout.write(`[perf] nodes=${nodeCount} generate=${generated.durationMs.toFixed(2)}ms index=${index.durationMs.toFixed(2)}ms layout=${layout.durationMs.toFixed(2)}ms search=${search.durationMs.toFixed(2)}ms culling=${culling.durationMs.toFixed(2)}ms serialize=${serialization.durationMs.toFixed(2)}ms visible=${culling.result.size}\n`);
    expect(index.result.flattenedNodeIds).toHaveLength(nodeCount);
  });
});
