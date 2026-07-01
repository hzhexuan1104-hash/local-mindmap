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
import samplePluginManifest from '../../../../docs/examples/sample-json-plugin/manifest.json';
import sampleWorkflowManifest from '../../../../docs/examples/sample-json-workflow-plugin/manifest.json';
import {
  FORBIDDEN_PLUGIN_FIELDS,
  createPluginOverwritePrompt,
  SUPPORTED_CAPABILITIES,
  SUPPORTED_PLUGIN_TYPES,
  getPluginNodeTypes,
  getPluginMenuGroups,
  getScriptWritePermissions,
  getPluginTemplates,
  installPlugin,
  installPluginManifest,
  normalizePluginManifest,
  parsePluginManifestText,
  setPluginEnabled,
  setPluginTrusted,
  shouldConfirmScriptPluginRun,
  shouldConfirmWorkflowPluginRun,
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

describe('bundled developer sample plugin', () => {
  it('is a valid and importable v1.7 declarative manifest', () => {
    const validation = validatePluginManifest(samplePluginManifest);
    expect(validation.valid).toBe(true);
    expect(validation.manifest).toMatchObject({
      pluginId: 'localmindmap.dev.sample-json-plugin',
      manifestVersion: 1,
      manifestValid: true,
    });
    expect(
      parsePluginManifestText(JSON.stringify(samplePluginManifest)),
    ).toMatchObject({
      pluginId: 'localmindmap.dev.sample-json-plugin',
      contributions: {
        menus: [
          expect.objectContaining({
            command: 'builtin.exportText',
            valid: true,
          }),
        ],
      },
    });
  });
});

describe('action-workflow manifest validation', () => {
  const validWorkflowManifest = {
    ...sampleWorkflowManifest,
    installedAt: '2026-07-01T00:00:00.000Z',
  };

  it('accepts the bundled JSON Action workflow sample', () => {
    const result = validatePluginManifest(validWorkflowManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest).toMatchObject({
      pluginType: 'action-workflow',
      trusted: false,
      workflow: {
        name: '会议纪要结构',
        actions: expect.any(Array),
      },
    });
  });

  it('requires workflow and a non-empty actions array with at most 20 items', () => {
    expect(
      validatePluginManifest({
        ...validWorkflowManifest,
        workflow: undefined,
      }).errors,
    ).toContainEqual(
      expect.objectContaining({
        field: 'workflow',
        message: 'pluginType=action-workflow 时 workflow 必填。',
      }),
    );
    expect(
      validatePluginManifest({
        ...validWorkflowManifest,
        workflow: { name: 'bad', actions: {} },
      }).errors,
    ).toContainEqual(
      expect.objectContaining({
        field: 'workflow.actions',
        message: 'workflow.actions 必须是数组。',
      }),
    );
    expect(
      validatePluginManifest({
        ...validWorkflowManifest,
        workflow: { name: 'empty', actions: [] },
      }).errors,
    ).toContainEqual(
      expect.objectContaining({
        message: 'workflow.actions 不能为空。',
      }),
    );
    expect(
      validatePluginManifest({
        ...validWorkflowManifest,
        workflow: {
          name: 'too-many',
          actions: Array.from({ length: 21 }, () => ({
            type: 'showMessage',
            message: 'hello',
          })),
        },
      }).errors,
    ).toContainEqual(
      expect.objectContaining({
        message: 'workflow.actions 最多 20 个 action。',
      }),
    );
  });

  it('enforces script/workflow command ownership', () => {
    const workflowWithScriptCommand = validatePluginManifest({
      ...validWorkflowManifest,
      contributions: {
        menus: [{
          id: 'bad',
          label: 'Bad',
          location: 'plugins',
          command: 'plugin.runScript',
        }],
      },
    });
    expect(workflowWithScriptCommand.valid).toBe(false);
    expect(workflowWithScriptCommand.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('必须是 plugin.runWorkflow'),
      }),
    );

    const scriptWithWorkflowCommand = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.bad-workflow-command',
      name: 'Bad script',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      permissions: ['script'],
      contributions: {
        menus: [{
          id: 'bad',
          label: 'Bad',
          location: 'plugins',
          command: 'plugin.runWorkflow',
        }],
      },
    });
    expect(scriptWithWorkflowCommand.valid).toBe(false);
    expect(scriptWithWorkflowCommand.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('必须是 plugin.runScript'),
      }),
    );
  });

  it.each(['entry', 'runtime', 'commandLine', 'code', 'script'])(
    'rejects executable workflow field %s',
    (field) => {
      const input =
        field === 'entry'
          ? { ...validWorkflowManifest, entry: 'main.js' }
          : {
              ...validWorkflowManifest,
              workflow: {
                ...validWorkflowManifest.workflow,
                [field]: 'unsafe',
              },
            };
      expect(validatePluginManifest(input).valid).toBe(false);
    },
  );

  it('warns for missing permissions, undeclared writes, and rejected actions', () => {
    const result = validatePluginManifest({
      ...validWorkflowManifest,
      permissions: undefined,
      workflow: {
        name: 'unsafe action sample',
        description: '',
        actions: [{ type: 'deleteNode', nodeId: '$selectedNode.id' }],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'action-workflow 插件未声明 permissions。',
        'workflow 包含写入 action，但未声明 mindmap:write 或 node:write。',
        expect.stringContaining('deleteNode'),
      ]),
    );
  });

  it('routes workflow top and node-context menus and removes them when disabled', () => {
    const manifest = validatePluginManifest(
      validWorkflowManifest,
    ).manifest as PluginManifest;
    expect(
      getPluginMenuGroups([manifest], {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'plugins',
      })[0].items.map((menu) => menu.id),
    ).toEqual(['createMeetingOutline']);
    expect(
      getPluginMenuGroups([manifest], {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'node-context',
      })[0].items.map((menu) => menu.id),
    ).toEqual(['createMeetingOutlineFromContext']);
    expect(
      getPluginMenuGroups(setPluginEnabled([manifest], manifest.pluginId, false), {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'node-context',
      }),
    ).toEqual([]);
  });

  it('preserves workflow trusted state during overwrite', () => {
    const original = validatePluginManifest(
      validWorkflowManifest,
    ).manifest as PluginManifest;
    const trusted = setPluginTrusted([original], original.pluginId, true);
    expect(shouldConfirmWorkflowPluginRun(original)).toBe(true);
    expect(shouldConfirmWorkflowPluginRun(trusted[0])).toBe(false);
    const overwritten = installPluginManifest(trusted, {
      ...original,
      version: '1.1.0',
    });
    expect(overwritten[0]).toMatchObject({
      version: '1.1.0',
      trusted: true,
    });
  });
});

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
    expect(() => parsePluginManifestText('{\n  "pluginId":')).toThrow(
      /导入失败：JSON 格式错误。第 2 行第 \d+ 列附近存在语法问题。/,
    );
  });

  it('publishes one canonical schema vocabulary', () => {
    expect(SUPPORTED_PLUGIN_TYPES).toEqual([
      'theme-pack',
      'icon-pack',
      'import-export',
      'node-type-pack',
      'template-pack',
      'tool',
      'script',
      'action-workflow',
    ]);
    expect(SUPPORTED_CAPABILITIES).toEqual([
      'themes',
      'icons',
      'export',
      'nodeTypes',
      'templates',
      'tools',
      'script',
      'workflow',
      'mindmap:read',
      'mindmap:write',
      'node:read',
      'node:write',
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

  it('accepts a valid script plugin manifest', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.append-check',
      name: 'Script plugin',
      version: '1.0.0',
      author: 'Tester',
      description: 'Script test.',
      pluginType: 'script',
      capabilities: ['script', 'mindmap:read', 'mindmap:write'],
      enabled: true,
      entry: 'main.js',
      permissions: ['mindmap:read', 'mindmap:write', 'node:read', 'node:write'],
      contributions: {
        menus: [
          {
            id: 'appendCheck',
            label: 'Append check',
            location: 'plugins',
            command: 'plugin.runScript',
            when: 'hasSelectedNode',
          },
        ],
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.manifest).toMatchObject({
      pluginType: 'script',
      entry: 'main.js',
      permissions: ['mindmap:read', 'mindmap:write', 'node:read', 'node:write'],
      contributions: {
        menus: [expect.objectContaining({ command: 'plugin.runScript', valid: true })],
      },
    });
  });

  it('keeps unknown permissions as warnings and defaults scripts to untrusted', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.unknown-permission',
      name: 'Script plugin',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      permissions: ['script', 'node:read', 'future:permission'],
    });

    expect(result.valid).toBe(true);
    expect(result.manifest).toMatchObject({
      trusted: false,
      permissions: ['script', 'node:read', 'future:permission'],
    });
    expect(result.warnings).toContain(
      '未知 permissions：future:permission。',
    );
  });

  it('warns when a script plugin does not declare permissions', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.no-permissions',
      name: 'Script plugin',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('script 插件未声明 permissions。');
  });

  it.each([
    [undefined, 'pluginType=script 时 entry 必填。'],
    ['/tmp/main.js', 'entry 只能是相对路径，不能是绝对路径。'],
    ['../main.js', 'entry 不允许包含 ..、. 或空路径片段。'],
    ['main.ts', 'entry 本批只支持 .js 文件。'],
  ])('rejects invalid script entry %s', (entry, message) => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.invalid-entry',
      name: 'Script plugin',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry,
      contributions: {
        menus: [
          {
            id: 'run',
            label: 'Run',
            location: 'plugins',
            command: 'plugin.runScript',
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'entry',
        message,
      }),
    );
  });

  it('rejects script plugin menus that do not use plugin.runScript', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.bad-command',
      name: 'Script plugin',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      contributions: {
        menus: [
          {
            id: 'run',
            label: 'Run',
            location: 'plugins',
            command: 'builtin.exportText',
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'contributions.menus.command',
      }),
    );
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

  it('routes node-context contributions separately from top plugin menus', () => {
    const result = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.context-menu',
      name: 'Context menu script',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      permissions: ['script', 'node:read'],
      contributions: {
        menus: [
          {
            id: 'top',
            label: 'Top',
            location: 'plugins',
            command: 'plugin.runScript',
            when: 'hasSelectedNode',
          },
          {
            id: 'context',
            label: 'Context',
            location: 'node-context',
            command: 'plugin.runScript',
            when: 'hasSelectedNode',
          },
        ],
      },
    });
    const manifest = result.manifest as PluginManifest;
    expect(
      getPluginMenuGroups([manifest], {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'plugins',
      })[0].items.map((menu) => menu.id),
    ).toEqual(['top']);
    expect(
      getPluginMenuGroups([manifest], {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'node-context',
      })[0].items.map((menu) => menu.id),
    ).toEqual(['context']);
    expect(
      getPluginMenuGroups(setPluginEnabled([manifest], manifest.pluginId, false), {
        hasMindmap: true,
        hasSelectedNode: true,
        location: 'node-context',
      }),
    ).toEqual([]);
  });

  it('rejects plugin.runScript on non-script plugin manifests', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      contributions: {
        menus: [{
          id: 'bad-script-command',
          label: 'Bad',
          location: 'plugins',
          command: 'plugin.runScript',
        }],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('非 script 插件'),
      }),
    );
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

  it('keeps an unknown builtin exporter handler as an invalid warning', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      contributions: {
        exporters: [
          {
            id: 'unknown-exporter',
            label: '未知导出',
            handler: 'builtin.unknownExporter',
          },
        ],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.manifest?.contributions?.exporters?.[0]).toMatchObject({
      valid: false,
      invalidReason: '插件导出 handler 不存在：builtin.unknownExporter',
    });
    expect(result.warnings).toContain(
      '导出贡献 unknown-exporter 无效：插件导出 handler 不存在：builtin.unknownExporter',
    );
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
        message: `manifest 缺少必填字段 ${fieldName}。`,
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
    expect(result.errors[0]?.message).toContain(
      'manifest 缺少必填字段 pluginType。',
    );
    expect(result.errors[0]?.message).toContain(
      SUPPORTED_PLUGIN_TYPES.join(', '),
    );
  });

  it('compatibly normalizes the legacy exporter pluginType with a warning', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      pluginType: 'exporter',
    });

    expect(result.valid).toBe(true);
    expect(result.manifest?.pluginType).toBe('import-export');
    expect(result.warnings).toContain(
      'pluginType 使用旧字段 exporter，已兼容为 import-export。',
    );
  });

  it('rejects a contribution collection with a severe structural error', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      contributions: {
        menus: { id: 'not-an-array' },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'invalid-contributions',
        field: 'contributions.menus',
        message: 'contributions.menus 必须是数组。',
      }),
    );
  });

  it('reports an unsupported pluginType and the supported type list', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      pluginType: 'remote-plugin',
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({
      code: 'unsupported-plugin-type',
      field: 'pluginType',
      value: 'remote-plugin',
    });
    expect(result.errors[0]?.message).toContain(
      SUPPORTED_PLUGIN_TYPES.join(', '),
    );
  });

  it('rejects unsupported manifestVersion with the current version', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      manifestVersion: 2,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'invalid-manifest-version',
        message: 'manifestVersion 不支持：2。当前仅支持 1。',
      }),
    );
  });

  it('rejects a newly imported manifest missing manifestVersion', () => {
    const value: Partial<typeof validDeclarativeManifest> = {
      ...validDeclarativeManifest,
    };
    delete value.manifestVersion;
    const result = validatePluginManifest(value);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'missing-required-field',
        field: 'manifestVersion',
        message: 'manifest 缺少必填字段 manifestVersion。',
      }),
    );
  });

  it('returns valid, errors, warnings, and normalizedManifest', () => {
    const result = validatePluginManifest(validDeclarativeManifest);

    expect(result).toMatchObject({
      valid: true,
      errors: [],
      normalizedManifest: {
        pluginId: validDeclarativeManifest.pluginId,
      },
    });
    expect(result.warnings).toContain(
      '未声明 contributions.menus，已按老插件兼容。',
    );
  });

  it('warns when capabilities and contributions do not match', () => {
    const result = validatePluginManifest({
      ...validDeclarativeManifest,
      capabilities: ['themes'],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'contributions 提供了 export，但 capabilities 未声明。',
    );
    expect(result.warnings).toContain(
      'capabilities 声明了 themes，但未提供对应 contributions。',
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

  it('preserves enabled state while replacing manifest data during overwrite', () => {
    const original = {
      ...(validatePluginManifest(validDeclarativeManifest)
        .manifest as PluginManifest),
      enabled: false,
      version: '1.0.0',
      name: '旧名称',
    };
    const update = {
      ...original,
      enabled: true,
      version: '1.0.1',
      name: '新名称',
      contributions: {
        ...original.contributions,
        menus: [
          {
            id: 'updated-menu',
            label: '更新后的菜单',
            location: 'plugins',
            command: 'builtin.exportText',
            when: 'always' as const,
            valid: true,
          },
        ],
      },
    };

    const overwritten = installPluginManifest([original], update);

    expect(overwritten).toHaveLength(1);
    expect(overwritten[0]).toMatchObject({
      name: '新名称',
      version: '1.0.1',
      enabled: false,
      source: 'external',
    });
    expect(
      getPluginMenuGroups(
        setPluginEnabled(overwritten, original.pluginId, true),
        {
        hasMindmap: true,
        hasSelectedNode: false,
        },
      )[0]?.items[0]?.label,
    ).toBe('更新后的菜单');
  });

  it('persists trust changes and preserves trust during script overwrite', () => {
    const original = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.script.trusted',
      name: 'Trusted script',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      permissions: ['script', 'node:write'],
    }).manifest as PluginManifest;
    const trusted = setPluginTrusted([original], original.pluginId, true);
    expect(trusted[0].trusted).toBe(true);
    expect(getScriptWritePermissions(original)).toEqual(['node:write']);
    expect(shouldConfirmScriptPluginRun(original)).toBe(true);
    expect(shouldConfirmScriptPluginRun(trusted[0])).toBe(false);
    const overwritten = installPluginManifest(trusted, {
      ...original,
      version: '1.1.0',
    });
    expect(overwritten[0]).toMatchObject({
      version: '1.1.0',
      trusted: true,
    });
  });

  it('reports duplicate install conflicts in Chinese when overwrite is not confirmed', async () => {
    const manifest = validatePluginManifest(validDeclarativeManifest)
      .manifest as PluginManifest;

    await expect(
      installPlugin([manifest], manifest, false),
    ).rejects.toThrow(`插件已存在：${manifest.pluginId}`);
  });

  it('builds a clear overwrite prompt with plugin name and versions', () => {
    const current = {
      ...(validatePluginManifest(validDeclarativeManifest)
        .manifest as PluginManifest),
      name: '覆盖安装测试插件',
      version: '1.0.0',
    };
    const incoming = {
      ...current,
      name: '覆盖安装测试插件新版',
      version: '1.0.1',
    };

    expect(createPluginOverwritePrompt(current, incoming)).toBe(
      '插件已安装：覆盖安装测试插件\n' +
        '当前版本：1.0.0\n' +
        '导入版本：1.0.1\n' +
        '是否覆盖安装？',
    );
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
