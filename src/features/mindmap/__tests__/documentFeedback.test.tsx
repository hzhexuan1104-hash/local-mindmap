import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSelectionExport } from '../exportSelection';
import { normalizeAttachment } from '../nodeAttachments';
import { serializeLmindDocument } from '../saveMindmap';
import { parseLmindDocument } from '../openMindmap';
import { getKeyboardShortcutAction } from '../keyboardShortcuts';
import { RemarkPreviewDialog } from '../remarkPreview';
import { MarkdownPreview } from '../MarkdownPreview';
import { getNodeContentSize } from '../layout';
import { createScriptPluginContext } from '../../plugins/pluginScriptActions';
import type { MindmapNode, NodeAttachment } from '../types';

const root: MindmapNode = { id: 'root', text: '导图', remark: '', children: [
  { id: 'a', text: 'A', remark: '备注', tags: ['重要'], children: [{ id: 'b', text: 'B', remark: '', children: [] }] },
  { id: 'c', text: 'C', remark: '', children: [] },
] };

describe('document feedback regressions', () => {
  it('reserves width for an attachment next to a remark and blocks remote images in plugin docs', () => {
    const node = { ...root, text: '附件布局测试节点', remark: '备注' };
    const withAttachment = { ...node, attachment: { kind: 'link' as const, name: '资料', url: 'https://example.com' } };
    expect(getNodeContentSize(withAttachment).width).toBeGreaterThan(getNodeContentSize(node).width);
    const html = renderToStaticMarkup(<MarkdownPreview content="![远程图](https://example.com/pixel.png)" allowRemoteImages={false} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('远程图');
  });
  it('exports one branch or several branches without duplicate descendants or mutating the document', () => {
    expect(buildSelectionExport(root, ['a', 'b'])?.id).toBe('a');
    const multi = buildSelectionExport(root, ['c', 'a', 'b'])!;
    expect(multi.children.map((node) => node.id)).toEqual(['a', 'c']);
    multi.children[0].text = 'changed';
    expect(root.children[0].text).toBe('A');
    expect(buildSelectionExport(root, [])).toBeNull();
    expect(buildSelectionExport(root, ['missing'])).toBeNull();
  });
  it.each<NodeAttachment>([
    { kind: 'file', name: '说明.txt', dataUrl: 'data:text/plain;base64,aGVsbG8=' },
    { kind: 'image', name: '图.png', dataUrl: 'data:image/png;base64,aGVsbG8=' },
    { kind: 'link', name: '资料', url: 'https://example.com/doc' },
  ])('preserves $kind attachments through save and reopen', (attachment) => {
    const node = { ...root, attachment };
    expect(parseLmindDocument(serializeLmindDocument(node)).attachment).toEqual(attachment);
  });
  it('rejects unsafe links, invalid embedded data and active image formats', () => {
    expect(() => normalizeAttachment({ kind: 'link', name: 'bad', url: 'javascript:alert(1)' })).toThrow();
    expect(() => normalizeAttachment({ kind: 'image', name: 'bad.svg', dataUrl: 'data:image/svg+xml;base64,AAAA' })).toThrow();
    expect(() => normalizeAttachment({ kind: 'file', name: 'bad', dataUrl: 'file:///secret' })).toThrow();
    expect(normalizeAttachment(undefined)).toBeUndefined();
  });
  it('includes the saved path and cloned tags in every plugin context', () => {
    const context = createScriptPluginContext(root, 'a', ['a'], 'C:/导图/demo.lmind');
    expect(context.mindmap.filePath).toBe('C:/导图/demo.lmind');
    expect(context.selectedNode?.tags).toEqual(['重要']);
    expect(context.nodes.find((node) => node.id === 'a')?.tags).toEqual(['重要']);
    context.selectedNode!.tags.push('other');
    expect(root.children[0].tags).toEqual(['重要']);
    expect(createScriptPluginContext(root, null).mindmap.filePath).toBe('');
  });
  it.each(['INPUT', 'TEXTAREA', 'DIV'])('routes Ctrl/Cmd+F from %s to the app search', (tagName) => {
    const target = { closest: () => ({ tagName }) } as unknown as EventTarget;
    const state = { hasModalOpen: false, hasContextMenuOpen: false, isBoxSelecting: false, hasSelection: true };
    expect(getKeyboardShortcutAction({ key: 'f', ctrlKey: true, target }, state)).toBe('find');
    expect(getKeyboardShortcutAction({ key: 'f', metaKey: true, target }, state)).toBe('find');
    expect(getKeyboardShortcutAction({ key: 'h', ctrlKey: true, target }, state)).toBe('replace');
  });
  it('keeps the preview title and body separated without redundant labels', () => {
    const html = renderToStaticMarkup(<RemarkPreviewDialog title="标题" content="正文" onClose={() => undefined} />);
    expect(html).toContain('remark-preview-dialog-header');
    expect(html).toContain('remark-preview-dialog-body');
    expect(html).toContain('标题'); expect(html).toContain('正文');
    expect(html).not.toContain('节点内容'); expect(html).not.toContain('备注内容');
  });
});
