import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PLUGIN_SETTINGS,
  loadPluginSettings,
  normalizePluginSettings,
  savePluginSettings,
} from '../pluginSettings';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('plugin runner settings', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('defaults to disabled for missing or damaged shapes', () => {
    expect(normalizePluginSettings(null)).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(normalizePluginSettings({ scriptRunnerEnabled: 'yes' })).toEqual(
      DEFAULT_PLUGIN_SETTINGS,
    );
  });

  it('keeps the runner setting after a reload', async () => {
    await expect(loadPluginSettings()).resolves.toEqual({
      scriptRunnerEnabled: false,
    });
    await savePluginSettings({ scriptRunnerEnabled: true });
    await expect(loadPluginSettings()).resolves.toEqual({
      scriptRunnerEnabled: true,
    });
  });
});
