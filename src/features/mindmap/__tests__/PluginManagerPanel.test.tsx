import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PluginManagerPanel } from '../PluginManagerPanel';
import type { PluginManifest } from '../plugins';

const noop = () => undefined;

const pluginWithMenus: PluginManifest = {
  manifestVersion: 1,
  pluginId: 'test.menu.plugin',
  name: '菜单贡献测试插件',
  version: '1.0.0',
  author: 'Tester',
  description: 'Menu test',
  pluginType: 'import-export',
  category: 'import-export',
  capabilities: ['export'],
  enabled: false,
  installedAt: '2026-06-28T00:00:00.000Z',
  source: 'external',
  manifestValid: true,
  validationWarnings: ['菜单贡献 bad-menu 无效：插件命令不存在'],
  contributions: {
    exporters: [
      {
        id: 'export',
        label: '导出',
        handler: 'builtin.exportText',
        valid: true,
      },
    ],
    menus: [
      {
        id: 'bad-menu',
        label: '无效菜单',
        command: 'builtin.unknown',
        location: 'plugins',
        when: 'always',
        valid: false,
        invalidReason: '插件命令不存在：builtin.unknown',
      },
    ],
  },
};

describe('PluginManagerPanel installation errors', () => {
  it('keeps and displays the concrete last installation error', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[]}
        lastInstallError="插件写入用户目录失败：access denied"
        userDataDir="C:/Users/test/AppData/Roaming/com.localmindmap.desktop"
        isDesktopApp
        onClose={noop}
        onInstall={noop}
        onToggle={noop}
        onUninstall={noop}
        onCopyUserDataDir={noop}
        onOpenUserDataDir={noop}
        onOpenPluginDir={noop}
        onCopyPluginId={noop}
        onCopyPath={noop}
        onOpenManifestDir={noop}
        onReload={noop}
        onRepairRegistry={noop}
        onCleanRecord={noop}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('最近一次安装错误');
    expect(html).toContain('插件写入用户目录失败：access denied');
  });

  it('shows contribution counts, menu details, paths, and disabled plugins', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[pluginWithMenus]}
        lastInstallError=""
        userDataDir="C:/Users/test/AppData/Roaming/com.localmindmap.desktop"
        isDesktopApp
        onClose={noop}
        onInstall={noop}
        onToggle={noop}
        onUninstall={noop}
        onCopyUserDataDir={noop}
        onOpenUserDataDir={noop}
        onOpenPluginDir={noop}
        onCopyPluginId={noop}
        onCopyPath={noop}
        onOpenManifestDir={noop}
        onReload={noop}
        onRepairRegistry={noop}
        onCleanRecord={noop}
      />,
    );

    expect(html).toContain('菜单贡献测试插件');
    expect(html).toContain('已禁用');
    expect(html).toContain('menus: 1');
    expect(html).toContain('exporters: 1');
    expect(html).toContain('插件命令不存在：builtin.unknown');
    expect(html).toContain('Schema warnings');
    expect(html).toContain('菜单贡献 bad-menu 无效');
    expect(html).toContain('manifestVersion');
    expect(html).toContain('外部安装');
    expect(html).toContain(
      'C:/Users/test/AppData/Roaming/com.localmindmap.desktop/plugins/installed/test.menu.plugin/manifest.json',
    );
    expect(html).toContain(
      'C:/Users/test/AppData/Roaming/com.localmindmap.desktop/plugins/plugin-registry.json',
    );
  });

  it('shows the explicit built-in manifest path explanation', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[
          {
            ...pluginWithMenus,
            pluginId: 'builtin-test',
            name: '内置测试插件',
            builtIn: true,
            source: 'built-in',
          },
        ]}
        lastInstallError=""
        userDataDir="C:/Users/test/AppData/Roaming/com.localmindmap.desktop"
        isDesktopApp
        onClose={noop}
        onInstall={noop}
        onToggle={noop}
        onUninstall={noop}
        onCopyUserDataDir={noop}
        onOpenUserDataDir={noop}
        onOpenPluginDir={noop}
        onCopyPluginId={noop}
        onCopyPath={noop}
        onOpenManifestDir={noop}
        onReload={noop}
        onRepairRegistry={noop}
        onCleanRecord={noop}
      />,
    );

    expect(html).toContain('内置插件，无独立 manifest 文件');
    expect(html).toContain('disabled=""');
  });

  it('shows an explicit empty contribution state', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[
          {
            ...pluginWithMenus,
            pluginId: 'empty-plugin',
            name: '无贡献插件',
            contributions: undefined,
          },
        ]}
        lastInstallError=""
        userDataDir="浏览器本地存储"
        isDesktopApp={false}
        onClose={noop}
        onInstall={noop}
        onToggle={noop}
        onUninstall={noop}
        onCopyUserDataDir={noop}
        onOpenUserDataDir={noop}
        onOpenPluginDir={noop}
        onCopyPluginId={noop}
        onCopyPath={noop}
        onOpenManifestDir={noop}
        onReload={noop}
        onRepairRegistry={noop}
        onCleanRecord={noop}
      />,
    );

    expect(html).toContain('暂无贡献点');
  });

  it('shows a missing installed manifest as invalid with every contribution count at zero', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[
          {
            ...pluginWithMenus,
            source: 'manifest-missing',
            manifestValid: false,
            manifestError: 'manifest.json 缺失。',
            validationErrors: [
              {
                code: 'invalid-json-object',
                message: 'manifest.json 缺失。',
              },
            ],
            contributions: undefined,
          },
        ]}
        lastInstallError=""
        userDataDir="C:/Users/test/AppData/Roaming/com.localmindmap.desktop"
        isDesktopApp
        onClose={noop}
        onInstall={noop}
        onToggle={noop}
        onUninstall={noop}
        onCopyUserDataDir={noop}
        onOpenUserDataDir={noop}
        onOpenPluginDir={noop}
        onCopyPluginId={noop}
        onCopyPath={noop}
        onOpenManifestDir={noop}
        onReload={noop}
        onRepairRegistry={noop}
        onCleanRecord={noop}
      />,
    );

    expect(html).toContain('<dd>false</dd>');
    expect(html).toContain('插件文件缺失');
    expect(html).toContain('Schema errors');
    expect(html).toContain('manifest.json 缺失');
    for (const contribution of [
      'themes',
      'icons',
      'exporters',
      'nodeTypes',
      'templates',
      'menus',
      'tools',
    ]) {
      expect(html).toContain(`${contribution}: 0`);
    }
    expect(html).toContain('清理异常记录');
    expect(html).toContain('卸载');
  });
});
