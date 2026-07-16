import { describe, expect, it } from 'vitest';
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
});
