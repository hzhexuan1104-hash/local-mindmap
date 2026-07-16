import { describe, expect, it } from 'vitest';
import {
  getRemarkEditorValue,
  shouldPersistRemarkEditorValue,
  shouldShowVirtualRemarkTemplate,
  VIRTUAL_REMARK_TEMPLATE,
} from '../remarkTemplate';

describe('virtual remark template', () => {
  it('shows the Markdown example only for a new empty remark', () => {
    expect(shouldShowVirtualRemarkTemplate('', false)).toBe(true);
    expect(getRemarkEditorValue('', true)).toBe(VIRTUAL_REMARK_TEMPLATE);
    expect(VIRTUAL_REMARK_TEMPLATE).toBe(
      '# 用例概述\n\n***\n\n# 执行步骤\n\n***\n\n# 预期结果',
    );
  });

  it('does not replace an existing remark or a template dismissed by the user', () => {
    expect(shouldShowVirtualRemarkTemplate('# 已保存内容', false)).toBe(false);
    expect(getRemarkEditorValue('# 已保存内容', false)).toBe('# 已保存内容');
    expect(shouldShowVirtualRemarkTemplate('', true)).toBe(false);
    expect(getRemarkEditorValue('', false)).toBe('');
  });

  it('does not save the virtual example when it is deleted without changes', () => {
    expect(shouldPersistRemarkEditorValue('', true)).toBe(false);
    expect(shouldPersistRemarkEditorValue('# 实际备注', true)).toBe(true);
    expect(shouldPersistRemarkEditorValue('', false)).toBe(true);
  });
});
