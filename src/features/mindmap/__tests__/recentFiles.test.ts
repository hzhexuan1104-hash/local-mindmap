import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeRecentFiles,
  updateRecentFile,
} from '../recentFiles';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('recent files', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: new MemoryStorage(),
    } as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates legacy string entries to structured records', () => {
    expect(normalizeRecentFiles(['C:\\maps\\legacy.lmind'])).toEqual([
      { path: 'C:\\maps\\legacy.lmind', name: 'legacy.lmind' },
    ]);
  });

  it('records save and open timestamps while keeping the newest file first', async () => {
    const path = 'C:\\maps\\竞赛方案.lmind';
    const saved = await updateRecentFile([], path, 'save', '2026-06-28T01:00:00Z');
    const opened = await updateRecentFile(
      saved,
      path,
      'open',
      '2026-06-28T02:00:00Z',
    );

    expect(opened[0]).toEqual({
      path,
      name: '竞赛方案.lmind',
      lastSavedAt: '2026-06-28T01:00:00Z',
      lastOpenedAt: '2026-06-28T02:00:00Z',
    });
  });
});
