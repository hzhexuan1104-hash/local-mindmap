import { describe, expect, it } from 'vitest';
import { buildRecentFilesMenu, buildPluginCommandMenu } from '../menuBuilders';
import { validateMenuDefinition } from '../menuTypes';

describe('menu builders', () => {
  it('limits recent files and nests plugin commands by plugin', () => {
    const recent = buildRecentFilesMenu(Array.from({ length: 7 }, (_, index) => ({ id: `${index}`, name: `file-${index}`, execute: () => undefined })), () => undefined);
    expect(recent).toHaveLength(6);
    expect(recent[recent.length - 1]?.label).toBe('查看全部最近文件');
    const plugins = buildPluginCommandMenu([{ pluginId: 'demo', pluginName: 'Demo', items: [{ id: 'run', label: '运行', execute: () => undefined }] }]);
    expect(plugins[0].children?.[0].label).toBe('运行');
  });

  it('rejects empty, duplicate, mixed, and over-deep menu definitions', () => {
    const result = validateMenuDefinition([{ id: 'file', label: '文件', items: [{ id: 'empty', label: '空' }, { id: 'empty', label: '重复', execute: () => undefined }, { id: 'mixed', label: '混合', execute: () => undefined, children: [{ id: 'leaf', label: '叶子', execute: () => undefined }] }] }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
