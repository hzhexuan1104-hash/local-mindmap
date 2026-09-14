import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from '../MarkdownPreview';
import { preserveStandaloneTripleAsterisks } from '../remarkMarkdown';

describe('remark Markdown preview normalization', () => {
  it('keeps a standalone triple-asterisk separator visible as source text', () => {
    expect(
      preserveStandaloneTripleAsterisks('# 用例概述\n\n***\n\n# 执行步骤'),
    ).toBe('# 用例概述\n\n\\*\\*\\*\n\n# 执行步骤');
  });

  it('leaves inline emphasis and fenced code unchanged', () => {
    expect(preserveStandaloneTripleAsterisks('**重点**')).toBe('**重点**');
    expect(preserveStandaloneTripleAsterisks('```md\n***\n```')).toBe(
      '```md\n***\n```',
    );
  });

  it('preserves ordinary soft line breaks while retaining Markdown block structure', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownPreview, {
        content: '第一行\n第二行\n第三行\n\n# 标题\n\n- 无序\n\n1. 有序\n\n- [ ] 任务\n\n```ts\nconst value = 1;\n```\n\n> 引用\n\n| 列A | 列B |\n| --- | --- |\n| 1 | 2 |',
      }),
    );
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(html).toContain('markdown-paragraph-with-soft-breaks');
    expect(html).toContain('第一行\n第二行\n第三行');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<pre>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
    expect(css).toMatch(/\.markdown-paragraph-with-soft-breaks\s*\{[^}]*white-space:\s*pre-line;/);
  });
});
