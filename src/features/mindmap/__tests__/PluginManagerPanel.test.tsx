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
  contributions: {
    exporters: [
      {
        id: 'export',
        label: '导出',
        handler: 'builtin.exportText',
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
      />,
    );

    expect(html).toContain('菜单贡献测试插件');
    expect(html).toContain('已禁用');
    expect(html).toContain('menus: 1');
    expect(html).toContain('exporters: 1');
    expect(html).toContain('插件命令不存在：builtin.unknown');
    expect(html).toContain(
      'plugins/installed/test.menu.plugin/manifest.json',
    );
    expect(html).toContain('plugins/plugin-registry.json');
  });
});
