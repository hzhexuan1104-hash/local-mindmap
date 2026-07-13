import { existsSync, readFileSync, statSync } from 'node:fs';
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

    expect(icons).toEqual([
      'icons/32x32.png',
      'icons/128x128.png',
      'icons/128x128@2x.png',
      'icons/icon.icns',
      'icons/icon.ico',
      'icons/icon.png',
    ]);

    icons.forEach((iconPath) => {
      expect(iconPath.startsWith('icons/')).toBe(true);
      expect(isAbsolute(iconPath)).toBe(false);
      const fullPath = join('src-tauri', iconPath);
      expect(existsSync(fullPath)).toBe(true);
      expect(statSync(fullPath).size).toBeGreaterThan(0);
    });
  });

  it('keeps the PNG application icon square and decodable', () => {
    const icon = readFileSync('src-tauri/icons/icon.png');
    expect(icon.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(icon.readUInt32BE(16)).toBe(icon.readUInt32BE(20));
    expect(statSync('src-tauri/icons/icon-source.png').size).toBeGreaterThan(0);
  });
});
