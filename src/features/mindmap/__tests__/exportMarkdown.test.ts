import { describe, expect, it } from 'vitest';
import { serializeMindmapMarkdown } from '../exportMarkdown';
import type { MindmapNode } from '../types';

const mindmap: MindmapNode = {
  id: 'root',
  text: '中心主题',
  remark: '# remark title\n## should stay remark',
  children: [
    {
      id: 'child-1',
      text: '需求分析',
      remark: '备注内容',
      children: [],
    },
  ],
};

describe('serializeMindmapMarkdown', () => {
  it('exports nodes with LMIND_NODE markers and heading levels', () => {
    const markdown = serializeMindmapMarkdown(mindmap);

    expect(markdown).toContain('<!-- LMIND_NODE level=1 -->');
    expect(markdown).toContain('# 中心主题');
    expect(markdown).toContain('<!-- LMIND_NODE level=2 -->');
    expect(markdown).toContain('## 需求分析');
  });

  it('preserves markdown headings inside remarks without adding node markers', () => {
    const markdown = serializeMindmapMarkdown(mindmap);

    expect(markdown).toContain('# remark title');
    expect(markdown).toContain('## should stay remark');
    expect(markdown.match(/LMIND_NODE/g)).toHaveLength(2);
  });
});

