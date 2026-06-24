import { describe, expect, it } from 'vitest';
import { parseMarkdownToMindmap } from '../importMarkdown';

describe('parseMarkdownToMindmap', () => {
  it('uses LMIND_NODE markers to separate real nodes from remark headings', () => {
    const markdown = [
      '<!-- LMIND_NODE level=1 -->',
      '# 中心主题',
      '',
      '# test',
      '## 123123',
      '### 312313132',
      '',
      '<!-- LMIND_NODE level=2 -->',
      '## 需求分析',
      '',
      '# remark heading',
    ].join('\n');

    const mindmap = parseMarkdownToMindmap(markdown);

    expect(mindmap.text).toBe('中心主题');
    expect(mindmap.children).toHaveLength(1);
    expect(mindmap.children[0].text).toBe('需求分析');
    expect(mindmap.remark).toContain('# test');
    expect(mindmap.remark).toContain('### 312313132');
    expect(mindmap.children[0].remark).toContain('# remark heading');
  });

  it('imports plain markdown by heading hierarchy', () => {
    const mindmap = parseMarkdownToMindmap(
      ['# 根节点', '根备注', '## 子节点', '子备注', '### 孙节点'].join('\n'),
    );

    expect(mindmap.text).toBe('根节点');
    expect(mindmap.remark).toBe('根备注');
    expect(mindmap.children[0].text).toBe('子节点');
    expect(mindmap.children[0].children[0].text).toBe('孙节点');
  });

  it('does not treat headings inside code fences as nodes', () => {
    const mindmap = parseMarkdownToMindmap(
      ['# 根节点', '```', '# not node', '```', '## 子节点'].join('\n'),
    );

    expect(mindmap.children).toHaveLength(1);
    expect(mindmap.children[0].text).toBe('子节点');
    expect(mindmap.remark).toContain('# not node');
  });
});

