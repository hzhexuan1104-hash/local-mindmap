import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { describe, expect, it } from 'vitest';

type TauriConfig = {
  bundle?: {
    icon?: string[];
  };
};

describe('Tauri bundled assets', () => {
  it('keeps every configured icon as a committed local asset path', () => {
    const config = JSON.parse(
      readFileSync('src-tauri/tauri.conf.json', 'utf8'),
    ) as TauriConfig;
    const icons = config.bundle?.icon ?? [];

    expect(icons).toContain('icons/icon.png');
    expect(icons).toContain('icons/icon.ico');

    icons.forEach((iconPath) => {
      expect(iconPath.startsWith('icons/')).toBe(true);
      expect(isAbsolute(iconPath)).toBe(false);
      expect(existsSync(join('src-tauri', iconPath))).toBe(true);
    });
  });
});
