import { describe, expect, it } from 'vitest';
import {
  getDesktopPluginDir,
  installDesktopPluginManifest,
  isTauriDesktopRuntime,
  listDesktopPlugins,
  normalizeNativeDesktopPluginManifest,
  setDesktopPluginEnabled,
  uninstallDesktopPlugin,
} from '../desktopPlugins';
import { ensureDesktopConfigDir, getDesktopConfigDir } from '../desktopConfig';
import {
  FORBIDDEN_PLUGIN_FIELDS,
  SUPPORTED_CAPABILITIES,
  SUPPORTED_PLUGIN_TYPES,
  getPluginNodeTypes,
  getPluginMenuGroups,
  getPluginTemplates,
  installPluginManifest,
  normalizePluginManifest,
  parsePluginManifestText,
  setPluginEnabled,
  uninstallPlugin,
  validatePluginManifest,
  type PluginManifest,
} from '../plugins';

const validManifest = {
  pluginId: 'example-plugin',
  name: '示例插件',
  version: '1.0.0',
  author: 'Tester',
  description: 'A local plugin manifest.',
  category: 'theme',
  capabilities: ['themePack'],
};

describe('normalizePluginManifest', () => {
  it('accepts a valid plugin manifest', () => {
    const manifest = normalizePluginManifest(validManifest);

    expect(manifest?.pluginId).toBe('example-plugin');
    expect(manifest?.enabled).toBe(true);
    expect(manifest?.category).toBe('theme');
  });

  it.each(['pluginId', 'name', 'version', 'category'])(
    'rejects manifest missing %s',
    (fieldName) => {
      const invalidManifest = { ...validManifest };
      delete invalidManifest[fieldName as keyof typeof invalidManifest];

      expect(normalizePluginManifest(invalidManifest)).toBeNull();
    },
  );
});

const validDeclarativeManifest = {
  manifestVersion: 1,
  pluginId: 'localmindmap.export.example',
  name: '示例导出插件',
  version: '1.0.0',
  author: 'Tester',
  description: 'Declarative exporter.',
  pluginType: 'import-export',
  capabilities: ['export'],
  enabled: true,
  contributions: {
    exporters: [
      {
        id: 'exportText',
        label: 'TXT 导出',
        handler: 'builtin.exportText',
      },
    ],
  },
};

describe('declarative plugin manifest validation', () => {
  it('reports a concrete JSON parsing error', () => {
    expect(() => parsePluginManifestText('{')).toThrow('插件 JSON 解析失败。');
  });

  it('publishes one canonical schema vocabulary', () => {
    expect(SUPPORTED_PLUGIN_TYPES).toEqual([
      'theme-pack',
      'icon-pack',
      'import-export',
      'node-type-pack',
      'template-pack',
      'tool',
    ]);
    expect(SUPPORTED_CAPABILITIES).toEqual([
      'themes',
      'icons',
      'export',
      'nodeTypes',
      'templates',
      'tools',
    ]);
  });

  it('accepts the minimal persistence test plugin without contributions', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.test.persistence.theme',
      name: '持久化测试主题插件',
      version: '1.0.0',
      author: 'Local Mindmap Test',
      description: 'Persistence test.',
      pluginType: 'theme-pack',
      capabilities: ['themes'],
      enabled: true,
    });

    expect(result.errors).toEqual([]);
    expect(result.manifest).toMatchObject({
      pluginId: 'localmindmap.test.persistence.theme',
      pluginType: 'theme-pack',
      contributions: undefined,
    });
  });

  it.each([
    ['theme-pack', 'themes'],
    ['import-export', 'export'],
  ] as const)('accepts a legal %s plugin', (pluginType, capability) => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: `localmindmap.test.${pluginType}`,
      name: `${pluginType} test`,
      version: '1.0.0',
      pluginType,
      capabilities: [capability],
    });

    expect(result.errors).toEqual([]);
    expect(result.manifest?.pluginType).toBe(pluginType);
  });

  it('accepts a legal v1 manifest', () => {
    const result = validatePluginManifest(validDeclarativeManifest);

    expect(result.errors).toEqual([]);
    expect(result.manifest).toMatchObject({
      manifestVersion: 1,
      pluginId: 'localmindmap.export.example',
      pluginType: 'import-export',
    });
  });

  it('normalizes valid menu contributions and filters them by enabled state and when', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      contributions: {
        ...validDeclarativeManifest.contributions,
        menus: [
          {
            id: 'export-menu',
            label: '导出为 TXT',
            location: 'plugins',
            command: 'builtin.exportText',
            when: 'hasMindmap',
          },
          {
            id: 'selection-menu',
            label: '选中节点操作',
            location: 'plugins',
            command: 'builtin.exportText',
            when: 'hasSelectedNode',
          },
        ],
      },
    });
    const manifest = result.manifest as PluginManifest;

    expect(manifest.contributions?.menus).toMatchObject([
      { id: 'export-menu', valid: true },
      { id: 'selection-menu', valid: true },
    ]);
    expect(
      getPluginMenuGroups([manifest], {
        hasMindmap: true,
        hasSelectedNode: false,
      })[0]?.items.map((menu) => menu.id),
    ).toEqual(['export-menu']);
    expect(
      getPluginMenuGroups(setPluginEnabled([manifest], manifest.pluginId, false), {
        hasMindmap: true,
        hasSelectedNode: true,
      }),
    ).toEqual([]);
  });

  it('keeps an unknown menu command visible in manager data but marks it invalid', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      contributions: {
        menus: [
          {
            id: 'unknown-command',
            label: '未知命令',
            location: 'plugins',
            command: 'builtin.notRegistered',
          },
          {
            id: 'wrong-location',
            label: '错误位置',
            location: 'file',
            command: 'builtin.exportText',
          },
        ],
      },
    });

    expect(result.manifest?.contributions?.menus).toMatchObject([
      {
        id: 'unknown-command',
        valid: false,
        invalidReason: '插件命令不存在：builtin.notRegistered',
      },
      {
        id: 'wrong-location',
        valid: false,
        invalidReason: '不支持的菜单位置：file',
      },
    ]);
    expect(
      getPluginMenuGroups([result.manifest as PluginManifest], {
        hasMindmap: true,
        hasSelectedNode: true,
      }),
    ).toEqual([]);
  });

  it('keeps v1.6 manifests without menus compatible', () => {
    const result = validatePluginManifest(validDeclarativeManifest);

    expect(result.errors).toEqual([]);
    expect(result.manifest?.contributions?.menus).toBeUndefined();
  });

  it.each(['pluginId', 'name'])('rejects a manifest missing %s', (fieldName) => {
    const value = { ...validDeclarativeManifest };
    delete value[fieldName as keyof typeof value];

    const result = validatePluginManifest(value);
    expect(result.manifest).toBeNull();
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'missing-required-field',
        field: fieldName,
        message: `缺少必填字段：${fieldName}`,
      }),
    );
  });

  it('rejects capabilities when it is not an array', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      capabilities: 'export',
    });
    expect(result.manifest).toBeNull();
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'invalid-capabilities',
        message: 'capabilities 必须是数组。',
      }),
    );
  });

  it('reports a missing pluginType with the supported type list', () => {
    const value: Partial<typeof validDeclarativeManifest> = {
      ...validDeclarativeManifest,
    };
    delete value.pluginType;
    const result = validatePluginManifest(value);

    expect(result.manifest).toBeNull();
    expect(result.errors[0]?.message).toContain('缺少必填字段：pluginType');
    expect(result.errors[0]?.message).toContain(
      SUPPORTED_PLUGIN_TYPES.join(', '),
    );
  });

  it('reports an unsupported pluginType and the supported type list', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      pluginType: 'exporter',
    });

    expect(result.manifest).toBeNull();
    expect(result.errors[0]).toMatchObject({
      code: 'unsupported-plugin-type',
      field: 'pluginType',
      value: 'exporter',
    });
    expect(result.errors[0]?.message).toContain(
      SUPPORTED_PLUGIN_TYPES.join(', '),
    );
  });

  it.each(FORBIDDEN_PLUGIN_FIELDS)(
    'rejects forbidden field %s recursively with the field name',
    (fieldName) => {
      const result = validatePluginManifest({
        ...validDeclarativeManifest,
        contributions: {
          ...validDeclarativeManifest.contributions,
          metadata: { [fieldName]: 'dangerous' },
        },
      });

      expect(result.manifest).toBeNull();
      expect(result.errors).toContainEqual({
        code: 'forbidden-field',
        field: fieldName,
        message: `插件包含非法字段：${fieldName}`,
      });
    },
  );

  it('rejects handlers outside the builtin namespace', () => {
    expect(
      validatePluginManifest({
        ...validDeclarativeManifest,
        contributions: {
          exporters: [
            {
              id: 'unsafe',
              label: 'Unsafe',
              handler: 'custom.execute',
            },
          ],
        },
      }).manifest,
    ).toBeNull();
  });

  it('records a real installation time and persists lifecycle state in registry data', () => {
    const manifest = validatePluginManifest(validDeclarativeManifest)
      .manifest as PluginManifest;
    const installed = installPluginManifest([], manifest);
    const installedTimestamp = Date.parse(installed[0].installedAt);

    expect(Number.isFinite(installedTimestamp)).toBe(true);
    expect(new Date(installedTimestamp).getUTCFullYear()).toBeGreaterThan(2000);
    expect(setPluginEnabled(installed, manifest.pluginId, false)[0].enabled).toBe(
      false,
    );
    expect(uninstallPlugin(installed, manifest.pluginId)).toEqual([]);
  });

  it('shows node type and template pack contributions only while enabled', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.resources.example',
      name: '资源包',
      version: '1.0.0',
      pluginType: 'template-pack',
      capabilities: ['nodeTypes', 'templates'],
      contributions: {
        nodeTypePacks: [
          {
            version: '1.0',
            kind: 'local-mindmap-node-type-pack',
            meta: {
              name: '节点包',
              description: '',
              createdAt: '2026-06-27T00:00:00.000Z',
              source: 'test',
            },
            nodeTypes: [
              {
                id: 'plugin-task',
                name: '插件任务',
                icon: '✅',
                shape: 'rounded',
                backgroundColor: '#fff',
                borderColor: '#000',
                textColor: '#111',
                fontSize: 16,
                bold: false,
                defaultText: '任务',
                defaultRemark: '',
              },
            ],
          },
        ],
        templatePacks: [
          {
            version: '1.0',
            kind: 'local-mindmap-template-pack',
            meta: {
              name: '模板包',
              description: '',
              createdAt: '2026-06-27T00:00:00.000Z',
              source: 'test',
            },
            templates: [
              {
                id: 'plugin-template',
                name: '插件模板',
                category: '插件',
                description: '',
                createTime: '2026-06-27T00:00:00.000Z',
                rootNode: {
                  id: 'root',
                  text: '插件模板',
                  remark: '',
                  children: [],
                },
                nodeTypes: [],
                themeId: 'default-blue',
                thumbnail: '插件模板',
              },
            ],
          },
        ],
      },
    });
    const enabled = [result.manifest as PluginManifest];

    expect(getPluginNodeTypes(enabled).map((item) => item.id)).toEqual([
      'plugin-task',
    ]);
    expect(getPluginTemplates(enabled).map((item) => item.id)).toEqual([
      'plugin-template',
    ]);

    const disabled = setPluginEnabled(
      enabled,
      'localmindmap.resources.example',
      false,
    );
    expect(getPluginNodeTypes(disabled)).toEqual([]);
    expect(getPluginTemplates(disabled)).toEqual([]);
  });
});

const validNativeManifest = {
  manifestVersion: 1,
  pluginId: 'my-native-plugin',
  name: 'Native 插件',
  version: '1.0.0',
  author: '作者',
  description: '桌面端 Native 插件示例',
  pluginType: 'native',
  platform: 'windows',
  arch: 'x64',
  entry: 'my-native-plugin.dll',
  capabilities: ['exportText'],
  abi: {
    version: 1,
    exports: {
      info: 'lm_plugin_info',
      execute: 'lm_plugin_execute',
      free: 'lm_plugin_free',
    },
  },
};

describe('normalizeNativeDesktopPluginManifest', () => {
  it('accepts a valid native manifest', () => {
    const manifest = normalizeNativeDesktopPluginManifest(validNativeManifest);

    expect(manifest?.pluginId).toBe('my-native-plugin');
    expect(manifest?.pluginType).toBe('native');
    expect(manifest?.entry).toBe('my-native-plugin.dll');
    expect(manifest?.capabilities).toEqual(['exportText']);
  });

  it.each(['pluginId', 'name'])('rejects manifest missing %s', (fieldName) => {
    const invalidManifest = { ...validNativeManifest };
    delete invalidManifest[fieldName as keyof typeof invalidManifest];

    expect(normalizeNativeDesktopPluginManifest(invalidManifest)).toBeNull();
  });

  it('rejects a manifest with non-native pluginType', () => {
    expect(
      normalizeNativeDesktopPluginManifest({
        ...validNativeManifest,
        pluginType: 'web',
      }),
    ).toBeNull();
  });

  it('defaults enabled to false', () => {
    const manifest = normalizeNativeDesktopPluginManifest(validNativeManifest);

    expect(manifest?.enabled).toBe(false);
  });

  it.each(['code', 'script', 'eval', 'function', 'remoteUrl'])(
    'rejects forbidden field %s',
    (fieldName) => {
      expect(
        normalizeNativeDesktopPluginManifest({
          ...validNativeManifest,
          [fieldName]: 'dangerous',
        }),
      ).toBeNull();
    },
  );

  it('rejects capabilities outside the whitelist', () => {
    expect(
      normalizeNativeDesktopPluginManifest({
        ...validNativeManifest,
        capabilities: ['exportText', 'readMindmapData'],
      }),
    ).toBeNull();
  });

  it('rejects unsafe pluginId values used for directory traversal', () => {
    expect(
      normalizeNativeDesktopPluginManifest({
        ...validNativeManifest,
        pluginId: '../native-plugin',
      }),
    ).toBeNull();
  });
});

describe('desktop plugin API web fallback', () => {
  it('detects non-Tauri test environment without throwing', () => {
    expect(isTauriDesktopRuntime()).toBe(false);
  });

  it('returns an empty plugin directory outside Tauri', async () => {
    await expect(getDesktopPluginDir()).resolves.toBe('');
  });

  it('returns an unavailable empty list outside Tauri', async () => {
    await expect(listDesktopPlugins()).resolves.toEqual({
      pluginDir: '',
      plugins: [],
      invalidPlugins: [],
      isAvailable: false,
    });
  });

  it('rejects write operations outside Tauri with a safe message', async () => {
    await expect(
      installDesktopPluginManifest(JSON.stringify(validNativeManifest), false),
    ).rejects.toThrow('桌面插件仅在桌面端可用');
    await expect(
      setDesktopPluginEnabled('my-native-plugin', true),
    ).rejects.toThrow('桌面插件仅在桌面端可用');
    await expect(uninstallDesktopPlugin('my-native-plugin')).rejects.toThrow(
      '桌面插件仅在桌面端可用',
    );
  });
});

describe('desktop config API web fallback', () => {
  it('returns unavailable config directory state outside Tauri', async () => {
    await expect(getDesktopConfigDir()).resolves.toEqual({
      configDir: '',
      isAvailable: false,
    });
  });

  it('does not create a config directory outside Tauri', async () => {
    await expect(ensureDesktopConfigDir()).resolves.toEqual({
      configDir: '',
      isAvailable: false,
    });
  });
});
