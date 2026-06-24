import { describe, expect, it } from 'vitest';
import {
  collectMindmapStats,
  generateLargeMindmap,
  runPerformanceBenchmarks,
} from '../performanceTest';
import type { MindmapNode } from '../types';

function collectIds(node: MindmapNode, ids = new Set<string>()) {
  ids.add(node.id);
  node.children.forEach((child) => collectIds(child, ids));
  return ids;
}

describe('performanceTest', () => {
  it('generates exactly 100 nodes', () => {
    const generated = generateLargeMindmap(100);

    expect(generated.nodeCount).toBe(100);
    expect(collectMindmapStats(generated.rootNode).nodeCount).toBe(100);
  });

  it('generates exactly 1000 nodes with unique ids', () => {
    const generated = generateLargeMindmap(1000);
    const ids = collectIds(generated.rootNode);

    expect(generated.nodeCount).toBe(1000);
    expect(ids.size).toBe(1000);
  });

  it('generates a multi-level tree', () => {
    const generated = generateLargeMindmap(100);

    expect(generated.maxDepth).toBeGreaterThan(2);
    expect(generated.rootNode.children.length).toBeGreaterThan(0);
    expect(generated.rootNode.children[0].children.length).toBeGreaterThan(0);
  });

  it('runs benchmark measurements', () => {
    const generated = generateLargeMindmap(100);
    const result = runPerformanceBenchmarks(generated.rootNode, [], 'default-blue', true);

    expect(result.nodeCount).toBe(100);
    expect(result.markdownSerializeMs).toBeGreaterThanOrEqual(0);
    expect(result.txtSerializeMs).toBeGreaterThanOrEqual(0);
  });
});

