import { describe, expect, it, vi } from 'vitest';
import { focusEditorAtEnd } from '../nodeEditing';

describe('node text editor focus', () => {
  it.each(['plain text', '中文文本', '第一行\n第二行', 'emoji 😀'])('places the caret at the end of %s', (value) => {
    const editor = { value, focus: vi.fn(), setSelectionRange: vi.fn() };

    focusEditorAtEnd(editor);

    expect(editor.focus).toHaveBeenCalledOnce();
    expect(editor.setSelectionRange).toHaveBeenCalledWith(value.length, value.length);
  });

  it('keeps an empty editor focused at offset zero', () => {
    const editor = { value: '', focus: vi.fn(), setSelectionRange: vi.fn() };

    focusEditorAtEnd(editor);

    expect(editor.setSelectionRange).toHaveBeenCalledWith(0, 0);
  });
});
