import type { CommandDefinition } from './commandTypes';

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition) {
    if (this.commands.has(command.id)) {
      console.warn(`[command-registry] duplicate command rejected: ${command.id}`);
      return false;
    }
    this.commands.set(command.id, command);
    return true;
  }

  registerAll(commands: CommandDefinition[]) {
    return commands.map((command) => this.register(command));
  }

  get(commandId: string) {
    return this.commands.get(commandId);
  }

  list() {
    return Array.from(this.commands.values());
  }

  clear() {
    this.commands.clear();
  }
}

export function createCommandRegistry(commands: CommandDefinition[] = []) {
  const registry = new CommandRegistry();
  registry.registerAll(commands);
  return registry;
}
