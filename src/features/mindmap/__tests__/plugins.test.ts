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
import { normalizePluginManifest } from '../plugins';

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
