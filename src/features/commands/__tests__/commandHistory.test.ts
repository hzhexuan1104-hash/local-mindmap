import { describe, expect, it } from 'vitest';
import { MAX_RECENT_COMMANDS, normalizeCommandHistory, recordCommandUsage, toggleFavoriteCommand } from '../commandHistory';
import { normalizeCommandPaletteSettings } from '../commandPaletteSettings';
import type { CommandUsage } from '../commandTypes';

describe('command history and settings', () => {
  it('updates the same id, limits history and stores no query or user content', () => {
    let history: CommandUsage[] = [];
    for (let index = 0; index < 25; index += 1) {
      history = recordCommandUsage(history, `builtin.command.${index}`, `2026-01-${String(index + 1).padStart(2, '0')}`);
    }
    history = recordCommandUsage(history, 'builtin.command.24', '2026-02-01');
    expect(history).toHaveLength(MAX_RECENT_COMMANDS);
    expect(history[0]).toEqual({ commandId: 'builtin.command.24', lastUsedAt: '2026-02-01', useCount: 2 });
    expect(JSON.stringify(history)).not.toContain('query');
    expect(JSON.stringify(history)).not.toContain('path');
  });

  it('handles favorites and damaged settings safely', () => {
    expect(toggleFavoriteCommand([], 'builtin.file.save')).toEqual(['builtin.file.save']);
    expect(toggleFavoriteCommand(['builtin.file.save'], 'builtin.file.save')).toEqual([]);
    expect(normalizeCommandHistory([{ commandId: 'bad' }])).toEqual([]);
    expect(normalizeCommandPaletteSettings({ recentCommands: 'bad', shortcutEnabled: 'yes' })).toMatchObject({
      shortcutEnabled: true,
      recentCommands: [],
    });
  });
});
