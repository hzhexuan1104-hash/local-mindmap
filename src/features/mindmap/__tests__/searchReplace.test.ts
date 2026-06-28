import { describe, expect, it } from 'vitest';
import {
  findMindmapMatches,
  findNextMatchIndex,
  replaceAllInMindmap,
  replaceMatchInMindmap,
  type SearchMatch,
} from '../searchReplace';
import type { MindmapNode } from '../types';

const createNode = (
  text: string,
  remark = '',
  children: MindmapNode[] = [],
): MindmapNode => ({
  id: 'root',
  text,
  remark,
  children,
});

function replaceAndFindNext(
  node: MindmapNode,
  match: SearchMatch,
  query: string,
  replacement: string,
) {
  const updated = replaceMatchInMindmap(node, match, query, replacement);
  const matches = findMindmapMatches(updated, query, 'all');
  const nextIndex = findNextMatchIndex(updated, matches, {
    nodeId: match.nodeId,
    field: match.field,
    offset: match.start + replacement.length,
  });
  return { updated, matches, nextIndex, nextMatch: matches[nextIndex] };
}

describe('search and replace', () => {
  it('continues after replacement text that retains the query prefix', () => {
    const node = createNode('测试测试');
    const [match] = findMindmapMatches(node, '测试', 'all');
    const result = replaceAndFindNext(node, match, '测试', '测试123');

    expect(result.updated.text).toBe('测试123测试');
    expect(result.nextMatch).toMatchObject({
      field: 'text',
      start: 5,
      end: 7,
      text: '测试',
    });
  });

  it('does not repeatedly stop inside newly inserted longer text', () => {
    const node = createNode('aaaa');
    const firstMatch = findMindmapMatches(node, 'a', 'all')[0];
    const first = replaceAndFindNext(node, firstMatch, 'a', 'aa');
    const second = replaceAndFindNext(
      first.updated,
      first.nextMatch,
      'a',
      'aa',
    );

    expect(first.nextMatch.start).toBe(2);
    expect(second.nextMatch.start).toBe(4);
  });

  it('advances when replacement and query are identical', () => {
    const node = createNode('test test');
    const firstMatch = findMindmapMatches(node, 'test', 'all')[0];
    const result = replaceAndFindNext(node, firstMatch, 'test', 'test');

    expect(result.updated.text).toBe('test test');
    expect(result.nextMatch.start).toBe(5);
  });

  it('continues from the deletion position for an empty replacement', () => {
    const node = createNode('abc abc');
    const firstMatch = findMindmapMatches(node, 'abc', 'all')[0];
    const result = replaceAndFindNext(node, firstMatch, 'abc', '');

    expect(result.updated.text).toBe(' abc');
    expect(result.nextMatch.start).toBe(1);
  });

  it('replaces only the active field', () => {
    const node = createNode('test title', 'test remark');
    const [textMatch, remarkMatch] = findMindmapMatches(node, 'test', 'all');
    const textUpdated = replaceMatchInMindmap(node, textMatch, 'test', 'text');
    const remarkUpdated = replaceMatchInMindmap(
      node,
      remarkMatch,
      'test',
      'note',
    );

    expect(textUpdated).toMatchObject({
      text: 'text title',
      remark: 'test remark',
    });
    expect(remarkUpdated).toMatchObject({
      text: 'test title',
      remark: 'note remark',
    });
  });

  it('includes remark matches with explicit ranges and stable text-before-remark order', () => {
    const node = createNode('测试标题', '这是备注测试内容');
    const matches = findMindmapMatches(node, '测试', 'all');

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      nodeId: 'root',
      field: 'text',
      start: 0,
      end: 2,
      text: '测试',
    });
    expect(matches[1]).toMatchObject({
      nodeId: 'root',
      field: 'remark',
      start: 4,
      end: 6,
      text: '测试',
    });
  });

  it('finds a remark when node text does not contain the query', () => {
    const node = createNode('普通标题', '这是备注测试内容');

    expect(findMindmapMatches(node, '测试', 'all')).toEqual([
      {
        nodeId: 'root',
        field: 'remark',
        start: 4,
        end: 6,
        text: '测试',
      },
    ]);
  });

  it('replaces all matches across text and remark and reports the original total', () => {
    const node = createNode('测试标题', '备注测试测试');
    const matches = findMindmapMatches(node, '测试', 'all');
    const updated = replaceAllInMindmap(node, '测试', '测试123', 'all');

    expect(matches).toHaveLength(3);
    expect(updated.text).toBe('测试123标题');
    expect(updated.remark).toBe('备注测试123测试123');
  });
});
