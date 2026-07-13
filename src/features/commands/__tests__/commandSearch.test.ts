import { describe, expect, it } from 'vitest';
import { parseSearchPrefix, searchPaletteResults } from '../commandSearch';
import type { PaletteResult } from '../commandTypes';

const result = (id: string, title: string, type: PaletteResult['type'] = 'command', extra: Partial<PaletteResult> = {}): PaletteResult => ({
  id,
  commandId: type === 'command' || type === 'plugin-command' ? id : undefined,
  title,
  type,
  category: type === 'plugin-command' ? 'plugin' : type === 'node' ? 'navigation' : type === 'recent-file' ? 'file' : 'edit',
  execute: () => undefined,
  ...extra,
});

describe('command search', () => {
  const results = [
    result('builtin.export.png', '导出 PNG', 'command', { keywords: ['export', '图片'] }),
    result('builtin.save', '保存', 'command', { keywords: ['save'] }),
    result('plugin.demo.run', '生成纪要', 'plugin-command', { pluginName: '会议插件' }),
    result('node.1', '技术路线', 'node', { searchText: '技术路线 这是备注命中' }),
    result('file.1', '项目规划.lmind', 'recent-file'),
  ];

  it('supports Chinese substring, case-insensitive English and multiple tokens', () => {
    expect(searchPaletteResults(results, '出 PnG').map((item) => item.id)).toEqual(['builtin.export.png']);
    expect(searchPaletteResults(results, 'SAVE')[0]?.id).toBe('builtin.save');
  });

  it('prioritizes exact title, title prefix and enabled items stably', () => {
    const candidates = [
      result('description', '别的命令', 'command', { description: '保存文件' }),
      result('prefix', '保存副本'),
      result('exact', '保存'),
      result('disabled', '保存旧版', 'command', { disabledReason: '不可用' }),
    ];
    expect(searchPaletteResults(candidates, '保存').map((item) => item.id)).toEqual([
      'exact', 'prefix', 'description', 'disabled',
    ]);
    expect(searchPaletteResults(candidates, '保存').map((item) => item.id)).toEqual(
      searchPaletteResults(candidates, '保存').map((item) => item.id),
    );
  });

  it('supports scope prefixes and excludes all nodes from an empty query', () => {
    expect(parseSearchPrefix('@ 技术')).toEqual({ prefix: 'nodes', query: '技术' });
    expect(searchPaletteResults(results, '> 导出').every((item) => item.type === 'command' || item.type === 'plugin-command')).toBe(true);
    expect(searchPaletteResults(results, '@ 路线').map((item) => item.id)).toEqual(['node.1']);
    expect(searchPaletteResults(results, '# 项目').map((item) => item.id)).toEqual(['file.1']);
    expect(searchPaletteResults(results, ': 纪要').map((item) => item.id)).toEqual(['plugin.demo.run']);
    expect(searchPaletteResults(results, '').some((item) => item.type === 'node')).toBe(false);
  });

  it('weights favorites and recent usage without promoting critical risks', () => {
    const candidates = [
      result('normal', '运行'),
      result('critical', '运行', 'plugin-command', { riskLevel: 'critical' }),
    ];
    const ordered = searchPaletteResults(candidates, '运行', {
      recentCommands: [{ commandId: 'critical', lastUsedAt: '2026-01-01', useCount: 100 }],
      favoriteCommandIds: ['normal'],
    });
    expect(ordered[0]?.id).toBe('normal');
  });
});
