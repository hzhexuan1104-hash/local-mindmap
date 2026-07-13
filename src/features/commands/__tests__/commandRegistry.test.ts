import { describe, expect, it, vi } from 'vitest';
import { createBuiltinCommands } from '../builtinCommands';
import { createCommandRegistry } from '../commandRegistry';

describe('command registry', () => {
  it('registers unique builtin commands with stable ids and categories', () => {
    const commands = createBuiltinCommands();
    const registry = createCommandRegistry(commands);
    expect(registry.list()).toHaveLength(commands.length);
    expect(commands.every((command) => command.id.startsWith('builtin.'))).toBe(true);
    expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length);
    expect(registry.get('builtin.file.save')?.category).toBe('file');
  });

  it('rejects duplicate ids without overwriting', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const command = createBuiltinCommands()[0];
    const registry = createCommandRegistry([command]);
    expect(registry.register({ ...command, title: '覆盖' })).toBe(false);
    expect(registry.get(command.id)?.title).toBe(command.title);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining(command.id));
    warning.mockRestore();
  });
});
