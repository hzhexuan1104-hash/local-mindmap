import {
  isDesktopRuntime,
  resolveUserDataPath,
  USER_DATA_PATHS,
} from '../storage/userDataStorage';

export const PLUGIN_DEV_COMMANDS = {
  createProject: 'create_dev_plugin_project',
  validateProject: 'validate_dev_plugin_project',
  buildPackage: 'build_dev_plugin_package',
  openProjectDir: 'open_dev_plugin_project_dir',
  openExamplesDir: 'open_plugin_examples_dir',
} as const;

export type DevPluginTemplateType =
  | 'import-export'
  | 'action-workflow'
  | 'script'
  | 'external-command-python'
  | 'external-command-executable'
  | 'theme-pack';

export type DevPluginMenuLocation = 'plugins' | 'node-context';

export type DevPluginProjectRequest = {
  name: string;
  pluginId: string;
  version: string;
  author: string;
  description: string;
  templateType: DevPluginTemplateType;
  menuLocation: DevPluginMenuLocation;
  generateReadme: boolean;
  generateEntry: boolean;
  overwrite?: boolean;
};

export type DevPluginProjectResult = {
  created: boolean;
  overwritten: boolean;
  pluginId: string;
  pluginType: string;
  runtime: string | null;
  directoryPath: string;
  manifestPath: string;
  readmePath: string | null;
  entryPath: string | null;
  files: string[];
};

export type DevPluginValidationIssue = {
  code: string;
  field: string | null;
  message: string;
};

export type DevPluginValidationResult = {
  valid: boolean;
  errors: DevPluginValidationIssue[];
  warnings: DevPluginValidationIssue[];
  pluginId: string | null;
  pluginType: string | null;
  runtime: string | null;
  entry: string | null;
  permissions: string[];
  contributionSummary: Record<string, number>;
  canPackage: boolean;
  projectDir: string;
  manifestPath: string;
};

export type DevPluginPackageResult = {
  pluginId: string;
  packagePath: string;
  fileCount: number;
  files: string[];
  validation: DevPluginValidationResult;
};

export const DEV_PLUGIN_TEMPLATE_OPTIONS: ReadonlyArray<{
  value: DevPluginTemplateType;
  label: string;
  description: string;
}> = [
  {
    value: 'import-export',
    label: 'import-export',
    description: '声明式 TXT 导出，不生成可执行代码。',
  },
  {
    value: 'action-workflow',
    label: 'action-workflow',
    description: '受控 JSON actions 与变量占位符示例。',
  },
  {
    value: 'script',
    label: 'script',
    description: 'Web Worker main.js，返回三个子节点 actions。',
  },
  {
    value: 'external-command-python',
    label: 'external-command / python',
    description: 'UTF-8 stdin/stdout main.py 示例。',
  },
  {
    value: 'external-command-executable',
    label: 'external-command / executable',
    description: '生成 manifest；plugin.exe 需自行编译补充。',
  },
  {
    value: 'theme-pack',
    label: 'theme-pack',
    description: '纯声明式主题贡献，不执行代码。',
  },
];

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

export function suggestDevPluginId(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 100);
  return `localmindmap.user.${slug || 'plugin'}`;
}

export function getDevPluginIdError(pluginId: string) {
  const value = pluginId.trim();
  if (!value) return 'pluginId 不能为空。';
  if (value.length > 128) return 'pluginId 不能超过 128 个字符。';
  if (
    !/^[A-Za-z0-9._-]+$/.test(value) ||
    value.includes('..') ||
    value.startsWith('.') ||
    value.endsWith('.')
  ) {
    return 'pluginId 只能包含字母、数字、点、下划线和短横线，且不能包含路径、..、ADS 或首尾点号。';
  }
  if (WINDOWS_RESERVED_NAMES.has(value.split('.')[0].toLowerCase())) {
    return 'pluginId 不能使用 Windows 保留设备名。';
  }
  return '';
}

export function createDefaultDevPluginProjectRequest(): DevPluginProjectRequest {
  return {
    name: '',
    pluginId: 'localmindmap.user.plugin',
    version: '1.0.0',
    author: 'Local Mindmap User',
    description: '',
    templateType: 'script',
    menuLocation: 'plugins',
    generateReadme: true,
    generateEntry: true,
  };
}

export function getDevPluginRootPath(userDataDir: string) {
  return resolveUserDataPath(userDataDir, USER_DATA_PATHS.pluginDev);
}

type DevPluginInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let invokerOverride: DevPluginInvoker | null = null;

export function setPluginDevWorkbenchInvokerForTests(
  invoker: DevPluginInvoker | null,
) {
  invokerOverride = invoker;
}

async function invokeDevPlugin<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  if (invokerOverride) {
    return invokerOverride<T>(command, args);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

function requireDesktop() {
  if (!isDesktopRuntime() && !invokerOverride) {
    throw new Error('插件开发者工作台仅在桌面端可用。');
  }
}

export async function createDevPluginProject(
  request: DevPluginProjectRequest,
) {
  requireDesktop();
  return invokeDevPlugin<DevPluginProjectResult>(
    PLUGIN_DEV_COMMANDS.createProject,
    { request },
  );
}

export async function validateDevPluginProject(pluginId: string) {
  requireDesktop();
  return invokeDevPlugin<DevPluginValidationResult>(
    PLUGIN_DEV_COMMANDS.validateProject,
    { pluginId },
  );
}

export async function buildDevPluginPackage(pluginId: string) {
  requireDesktop();
  return invokeDevPlugin<DevPluginPackageResult | null>(
    PLUGIN_DEV_COMMANDS.buildPackage,
    { pluginId },
  );
}

export async function openDevPluginProjectDir(pluginId: string) {
  requireDesktop();
  await invokeDevPlugin<void>(PLUGIN_DEV_COMMANDS.openProjectDir, { pluginId });
}

export async function openPluginExamplesDir() {
  requireDesktop();
  await invokeDevPlugin<void>(PLUGIN_DEV_COMMANDS.openExamplesDir);
}
