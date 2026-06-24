import { describe, expect, it } from 'vitest';
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

