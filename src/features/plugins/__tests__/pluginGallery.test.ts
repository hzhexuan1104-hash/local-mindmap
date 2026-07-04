import { describe, expect, it } from 'vitest';
import type { PluginManifest } from '../../mindmap/plugins';
import {
  comparePluginVersions,
  filterPluginGalleryItems,
  getPluginGalleryInstallLabel,
  getPluginGalleryInstallWarning,
  getPluginGallerySafetyText,
  getPluginGalleryState,
  normalizePluginGalleryCatalog,
} from '../pluginGallery';

const rawManifest = {
  manifestVersion: 1,
  pluginId: 'builtin-gallery.text-export',
  name: 'TXT 导出插件',
  version: '1.2.0',
  author: 'Local Mindmap',
  description: '声明式导出',
  pluginType: 'import-export',
  capabilities: ['export'],
  contributions: {
    menus: [
      {
        id: 'exportText',
        label: '导出 TXT',
        location: 'plugins',
        command: 'builtin.exportText',
        when: 'hasMindmap',
      },
    ],
  },
};

const catalog = normalizePluginGalleryCatalog({
  version: 1,
  items: [
    {
      id: 'builtin-gallery.text-export',
      title: 'TXT 导出插件',
      description: '示例声明式 TXT 导出插件',
      category: '导入导出',
      pluginType: 'import-export',
      runtime: null,
      path: 'text-export-plugin/manifest.json',
      tags: ['txt', 'export'],
      recommended: true,
      riskLevel: 'low',
      manifest: rawManifest,
      readme: '# TXT',
      installable: true,
    },
  ],
});

describe('local plugin gallery state', () => {
  it('normalizes local catalog manifests without changing catalog metadata', () => {
    expect(catalog.error).toBeUndefined();
    expect(catalog.items[0]).toMatchObject({
      id: 'builtin-gallery.text-export',
      pluginType: 'import-export',
      riskLevel: 'low',
      installable: true,
    });
    expect(catalog.items[0].manifest).toMatchObject({
      pluginId: 'builtin-gallery.text-export',
      version: '1.2.0',
      enabled: true,
    });
  });

  it('derives install, reinstall, update, disabled, trusted and damaged states', () => {
    const item = catalog.items[0];
    const newState = getPluginGalleryState(item, []);
    expect(newState.state).toBe('not-installed');
    expect(getPluginGalleryInstallLabel(newState)).toBe('安装');

    const installed = {
      ...item.manifest,
      source: 'external',
      enabled: false,
      trusted: true,
    } as PluginManifest;
    const currentState = getPluginGalleryState(item, [installed]);
    expect(currentState).toMatchObject({
      state: 'installed',
      enabled: false,
      trusted: true,
    });
    expect(getPluginGalleryInstallLabel(currentState)).toBe('重新安装');

    const outdatedState = getPluginGalleryState(item, [
      { ...installed, version: '1.1.9' },
    ]);
    expect(outdatedState.state).toBe('outdated');
    expect(getPluginGalleryInstallLabel(outdatedState)).toBe('更新');

    expect(
      getPluginGalleryState(item, [
        { ...installed, source: 'manifest-missing' },
      ]).state,
    ).toBe('manifest-missing');
    expect(
      getPluginGalleryState(item, [
        { ...installed, source: 'manifest-damaged' },
      ]).state,
    ).toBe('manifest-damaged');
  });

  it('searches title, description, tags and pluginId and filters type/category', () => {
    const items = catalog.items;
    expect(filterPluginGalleryItems(items, 'TXT', '', '')).toHaveLength(1);
    expect(filterPluginGalleryItems(items, 'export', '', '')).toHaveLength(1);
    expect(
      filterPluginGalleryItems(items, 'builtin-gallery', '', ''),
    ).toHaveLength(1);
    expect(filterPluginGalleryItems(items, '', '工作流', '')).toHaveLength(0);
    expect(
      filterPluginGalleryItems(items, '', '', 'external-command'),
    ).toHaveLength(0);
  });

  it('compares simple semver without throwing on unusual versions', () => {
    expect(comparePluginVersions('1.2.0', '1.3.0')).toBe(-1);
    expect(comparePluginVersions('2.0.0', '1.9.9')).toBe(1);
    expect(comparePluginVersions('1.0.0-beta', '1.0.0')).toBe(0);
    expect(comparePluginVersions('dev', '1.0.0')).toBeNull();
  });

  it('provides the required runner and risk messages', () => {
    expect(getPluginGallerySafetyText('action-workflow')).toContain('不执行代码');
    expect(getPluginGallerySafetyText('import-export')).toContain('不执行代码');
    expect(getPluginGalleryInstallWarning('script')).toContain(
      '实验性脚本插件',
    );
    expect(getPluginGalleryInstallWarning('external-command')).toContain(
      '系统层面具有更高风险',
    );
    expect(getPluginGalleryInstallWarning('import-export')).toBeNull();
  });

  it('marks invalid embedded manifests unavailable without crashing the catalog', () => {
    const invalid = normalizePluginGalleryCatalog({
      version: 1,
      items: [
        {
          ...catalog.items[0],
          manifest: { pluginId: 'broken' },
        },
      ],
    });
    expect(invalid.items[0].installable).toBe(false);
    expect(invalid.items[0].manifest).toBeNull();
    expect(invalid.items[0].error).toContain('导入失败');
  });
});
