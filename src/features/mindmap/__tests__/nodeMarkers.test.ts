import { describe, expect, it } from 'vitest';
import {
  isNodePriority,
  isNodeProgress,
  normalizeNodeTag,
  normalizeNodeTags,
} from '../nodeMarkers';

describe('node markers', () => {
  it('accepts only the supported priority and completion values', () => {
    expect(isNodePriority(1)).toBe(true);
    expect(isNodePriority(9)).toBe(true);
    expect(isNodePriority(0)).toBe(false);
    expect(isNodePriority(1.5)).toBe(false);
    expect(isNodeProgress(0)).toBe(true);
    expect(isNodeProgress(75)).toBe(true);
    expect(isNodeProgress(60)).toBe(false);
  });

  it('trims, bounds, and de-duplicates node tags', () => {
    expect(normalizeNodeTag('  里程碑  ')).toBe('里程碑');
    expect(normalizeNodeTag('   ')).toBeNull();
    expect(normalizeNodeTag('a'.repeat(31))).toBe('a'.repeat(30));
    expect(normalizeNodeTags(['  设计 ', '设计', '', 12, '测试'])).toEqual([
      '设计',
      '测试',
    ]);
  });

  it('uses a shared fixed badge footprint without a progress inset ring', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(/\.node-priority-badge,[\s\S]*?\.node-progress-badge,[\s\S]*?width: 16px;[\s\S]*?height: 16px;/);
    expect(css).toMatch(/\.node-progress-badge\s*\{[\s\S]*?background: conic-gradient[\s\S]*?box-shadow: none;/);
  });
});
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
