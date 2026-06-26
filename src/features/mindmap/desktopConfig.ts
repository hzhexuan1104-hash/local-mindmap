import { invokeTauriDesktopCommand } from './plugins';
import { isTauriDesktopRuntime } from './desktopPlugins';

export type DesktopConfigDirResult = {
  configDir: string;
  isAvailable: boolean;
};

export const DESKTOP_CONFIG_COMMANDS = {
  getDesktopConfigDir: 'get_desktop_config_dir',
  ensureDesktopConfigDir: 'ensure_desktop_config_dir',
} as const;

export async function getDesktopConfigDir(): Promise<DesktopConfigDirResult> {
  if (!isTauriDesktopRuntime()) {
    return {
      configDir: '',
      isAvailable: false,
    };
  }

  return {
    configDir: await invokeTauriDesktopCommand<string>(
      DESKTOP_CONFIG_COMMANDS.getDesktopConfigDir,
    ),
    isAvailable: true,
  };
}

export async function ensureDesktopConfigDir(): Promise<DesktopConfigDirResult> {
  if (!isTauriDesktopRuntime()) {
    return {
      configDir: '',
      isAvailable: false,
    };
  }

  return {
    configDir: await invokeTauriDesktopCommand<string>(
      DESKTOP_CONFIG_COMMANDS.ensureDesktopConfigDir,
    ),
    isAvailable: true,
  };
}
