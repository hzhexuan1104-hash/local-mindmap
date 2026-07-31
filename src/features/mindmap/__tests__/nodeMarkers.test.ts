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
});
