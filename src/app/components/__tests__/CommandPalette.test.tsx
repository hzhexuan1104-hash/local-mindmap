import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandPalette } from '../CommandPalette';

describe('CommandPalette accessibility markup', () => {
  it('renders dialog, search, listbox, option and non-color-only risk/disabled text', () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        results={[
          {
            id: 'builtin.file.open',
            commandId: 'builtin.file.open',
            type: 'command',
            title: '打开导图',
            category: 'file',
            riskLevel: 'high',
            disabledReason: '测试禁用原因',
            execute: () => undefined,
          },
        ]}
        recentCommands={[]}
        favoriteCommandIds={[]}
        contextCategories={['file']}
        closeAfterExecute
        onClose={() => undefined}
        onRecordCommand={() => undefined}
        onToggleFavorite={() => undefined}
        onDisabled={() => undefined}
        onError={() => undefined}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="搜索命令、节点、最近文件、模板和插件"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('风险：high');
    expect(html).toContain('不可用：测试禁用原因');
  });
});
