import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDevPluginPackage,
  createDefaultDevPluginProjectRequest,
  createDevPluginProject,
  getDevPluginIdError,
  openDevPluginProjectDir,
  openPluginExamplesDir,
  PLUGIN_DEV_COMMANDS,
  setPluginDevWorkbenchInvokerForTests,
  suggestDevPluginId,
  validateDevPluginProject,
  type DevPluginPackageResult,
  type DevPluginProjectResult,
  type DevPluginValidationResult,
} from '../pluginDevWorkbench';

afterEach(() => {
  setPluginDevWorkbenchInvokerForTests(null);
});

describe('plugin developer workbench client', () => {
  it('suggests a safe prefixed pluginId and rejects traversal or ADS values', () => {
    expect(suggestDevPluginId('My First_Plugin!')).toBe(
      'localmindmap.user.my-first-plugin',
    );
    expect(suggestDevPluginId('中文插件')).toBe('localmindmap.user.plugin');
    expect(getDevPluginIdError('localmindmap.user.valid-plugin')).toBe('');
    expect(getDevPluginIdError('../escape')).toContain('不能包含路径');
    expect(getDevPluginIdError('main:stream')).toContain('ADS');
    expect(getDevPluginIdError('localmindmap..escape')).toContain('..');
    expect(getDevPluginIdError('CON')).toContain('Windows');
  });

  it('routes create, validate, package and local open operations to Tauri commands', async () => {
    const calls: Array<{
      command: string;
      args?: Record<string, unknown>;
    }> = [];
    const request = {
      ...createDefaultDevPluginProjectRequest(),
      name: 'Script Demo',
      pluginId: 'localmindmap.user.script-demo',
    };
    const project: DevPluginProjectResult = {
      created: true,
      overwritten: false,
      pluginId: request.pluginId,
      pluginType: 'script',
      runtime: null,
      directoryPath: `C:/data/plugins/dev/${request.pluginId}`,
      manifestPath: `C:/data/plugins/dev/${request.pluginId}/manifest.json`,
      readmePath: `C:/data/plugins/dev/${request.pluginId}/README.md`,
      entryPath: `C:/data/plugins/dev/${request.pluginId}/main.js`,
      files: ['README.md', 'main.js', 'manifest.json'],
    };
    const validation: DevPluginValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      pluginId: request.pluginId,
      pluginType: 'script',
      runtime: null,
      entry: 'main.js',
      permissions: ['node:write'],
      contributionSummary: { menus: 1 },
      canPackage: true,
      projectDir: project.directoryPath,
      manifestPath: project.manifestPath,
    };
    const packaged: DevPluginPackageResult = {
      pluginId: request.pluginId,
      packagePath: `C:/Desktop/${request.pluginId}.lmplugin`,
      fileCount: 3,
      files: ['manifest.json', 'README.md', 'main.js'],
      validation,
    };

    setPluginDevWorkbenchInvokerForTests(async <T>(
      command: string,
      args?: Record<string, unknown>,
    ) => {
      calls.push({ command, args });
      if (command === PLUGIN_DEV_COMMANDS.createProject) {
        return project as T;
      }
      if (command === PLUGIN_DEV_COMMANDS.validateProject) {
        return validation as T;
      }
      if (command === PLUGIN_DEV_COMMANDS.buildPackage) {
        return packaged as T;
      }
      return undefined as T;
    });

    await expect(createDevPluginProject(request)).resolves.toEqual(project);
    await expect(validateDevPluginProject(request.pluginId)).resolves.toEqual(
      validation,
    );
    await expect(buildDevPluginPackage(request.pluginId)).resolves.toEqual(
      packaged,
    );
    await openDevPluginProjectDir(request.pluginId);
    await openPluginExamplesDir();

    expect(calls).toEqual([
      {
        command: PLUGIN_DEV_COMMANDS.createProject,
        args: { request },
      },
      {
        command: PLUGIN_DEV_COMMANDS.validateProject,
        args: { pluginId: request.pluginId },
      },
      {
        command: PLUGIN_DEV_COMMANDS.buildPackage,
        args: { pluginId: request.pluginId },
      },
      {
        command: PLUGIN_DEV_COMMANDS.openProjectDir,
        args: { pluginId: request.pluginId },
      },
      {
        command: PLUGIN_DEV_COMMANDS.openExamplesDir,
        args: undefined,
      },
    ]);
  });
});
