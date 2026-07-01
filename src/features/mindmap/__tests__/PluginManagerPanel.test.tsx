import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PluginManagerPanel } from '../PluginManagerPanel';
import type { PluginManifest } from '../plugins';

const noop = () => undefined;
const developerProps = {
  onOpenPluginDevDir: noop,
  onCreateSamplePlugin: noop,
  logs: [],
  onClearLogs: noop,
};

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
  it('shows JSON Action workflow details, trust and recent run data', () => {
    const workflowPlugin: PluginManifest = {
      ...pluginWithMenus,
      pluginId: 'localmindmap.workflow.meeting-outline',
      name: '会议纪要结构生成器',
      pluginType: 'action-workflow',
      category: 'tool',
      capabilities: ['workflow', 'node:write'],
      permissions: ['node:read', 'node:write'],
      trusted: false,
      workflow: {
        name: '会议纪要结构',
        description: '生成会议节点',
        actions: [{
          type: 'addChildNodes',
          parentId: '$selectedNode.id',
          nodes: [{ text: '会议背景' }],
        }],
      },
    };
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        {...developerProps}
        plugins={[workflowPlugin]}
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
        workflowRunResults={{
          [workflowPlugin.pluginId]: {
            status: 'success',
            message: '已执行 1 个 actions。',
            lastRunAt: '2026-07-01T00:00:00.000Z',
            durationMs: 2,
            actionCount: 1,
            appliedActionCount: 1,
          },
        }}
      />,
    );

    expect(html).toContain('action-workflow');
    expect(html).toContain('JSON Action Workflow');
    expect(html).toContain('workflow.name:');
    expect(html).toContain('会议纪要结构');
    expect(html).toContain('addChildNodes');
    expect(html).toContain('hasWriteActions:');
    expect(html).toContain('最近一次工作流运行');
    expect(html).toContain('信任此插件');
  });

  it('keeps and displays the concrete last installation error', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        {...developerProps}
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
        {...developerProps}
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
        {...developerProps}
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
        {...developerProps}
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
        {...developerProps}
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

  it('renders a collapsed developer mode with safe local tooling entries', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        {...developerProps}
        plugins={[]}
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

    expect(html).toContain('<details');
    expect(html).not.toContain('<details open=""');
    expect(html).toContain('开发者模式');
    expect(html).toContain('打开插件开发目录');
    expect(html).toContain('创建示例插件');
    expect(html).toContain('查看插件 API 文档');
    expect(html).toContain('查看插件日志');
    expect(html).toContain('复制用户数据目录路径');
    expect(html).toContain('通过 Web Worker 执行本地脚本插件');
    expect(html).toContain('不支持 Shell、DLL、文件系统或网络访问');
    expect(html).toContain('不支持在 Web 端打开本地目录');
  });
});
