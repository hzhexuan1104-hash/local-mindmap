import type { MindmapNodeType } from './types';
import type { MindmapTheme } from './themes';
import { selectLocalFile } from './fileUtils';

export type PluginCategory =
  | 'import-export'
  | 'theme'
  | 'icon-pack'
  | 'node-type'
  | 'tool';

export type PluginCapability =
  | 'exportText'
  | 'themePack'
  | 'iconPack'
  | 'nodeTypePack'
  | 'toolPanel';

export type PluginIconContribution = {
  value: string;
  label: string;
};

export type PluginExportFormatContribution = {
  formatId: string;
  label: string;
  fileName: string;
  handlerId?: string;
};

export type PluginToolContribution = {
  toolId: string;
  label: string;
  description?: string;
};

export type PluginContributions = {
  themes?: MindmapTheme[];
  icons?: PluginIconContribution[];
  nodeTypes?: MindmapNodeType[];
  exportFormats?: PluginExportFormatContribution[];
  tools?: PluginToolContribution[];
};

export type PluginManifest = {
  pluginId: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: PluginCategory;
  capabilities: PluginCapability[];
  enabled: boolean;
  installedAt: string;
  config?: Record<string, unknown>;
  contributions?: PluginContributions;
};

const PLUGIN_STORAGE_KEY = 'local-mindmap.plugins.v1';

const PLUGIN_CATEGORIES: PluginCategory[] = [
  'import-export',
  'theme',
  'icon-pack',
  'node-type',
  'tool',
];

const PLUGIN_CAPABILITIES: PluginCapability[] = [
  'exportText',
  'themePack',
  'iconPack',
  'nodeTypePack',
  'toolPanel',
];

export const BUILT_IN_PLUGINS: PluginManifest[] = [
  {
    pluginId: 'builtin-theme-pack',
    name: '示例主题包',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '提供紫色主题和海洋主题，用于演示数据驱动主题扩展。',
    category: 'theme',
    capabilities: ['themePack'],
    enabled: true,
    installedAt: new Date(0).toISOString(),
    contributions: {
      themes: [
        {
          id: 'plugin-purple',
          name: '紫色主题',
          canvasBackground: '#fbf7ff',
          gridColor: '#eadcff',
          nodeBackground: '#f3e8ff',
          nodeBorder: '#8b5cf6',
          nodeText: '#3b0764',
          lineColor: '#b794f4',
        },
        {
          id: 'plugin-ocean',
          name: '海洋主题',
          canvasBackground: '#f2fbff',
          gridColor: '#d5eef8',
          nodeBackground: '#e0f7ff',
          nodeBorder: '#0284c7',
          nodeText: '#083344',
          lineColor: '#67b7dc',
        },
      ],
    },
  },
  {
    pluginId: 'builtin-icon-pack',
    name: '示例图标包',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '提供一组额外内置字符图标，用于自定义节点类型。',
    category: 'icon-pack',
    capabilities: ['iconPack'],
    enabled: true,
    installedAt: new Date(0).toISOString(),
    contributions: {
      icons: [
        { value: '🚀', label: '🚀 启动' },
        { value: '🔥', label: '🔥 热点' },
        { value: '🧠', label: '🧠 思考' },
        { value: '🏁', label: '🏁 目标' },
        { value: '📎', label: '📎 附件' },
      ],
    },
  },
  {
    pluginId: 'builtin-txt-export',
    name: 'TXT 导出插件',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '声明 TXT 导出能力，实际导出由应用内置安全 handler 完成。',
    category: 'import-export',
    capabilities: ['exportText'],
    enabled: true,
    installedAt: new Date(0).toISOString(),
    contributions: {
      exportFormats: [
        {
          formatId: 'txt',
          label: '导出 TXT',
          fileName: 'mindmap.txt',
          handlerId: 'builtin-txt',
        },
      ],
    },
  },
];

export const DESKTOP_PLUGIN_COMMANDS = {
  getDesktopPluginDir: 'get_desktop_plugin_dir',
  listDesktopPlugins: 'list_desktop_plugins',
  installDesktopPluginManifest: 'install_desktop_plugin_manifest',
  setDesktopPluginEnabled: 'set_desktop_plugin_enabled',
  uninstallDesktopPlugin: 'uninstall_desktop_plugin',
} as const;

export async function invokeTauriDesktopCommand<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  const { invoke } = await import('@tauri-apps/api/core');

  return invoke(command, args) as Promise<T>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const isPluginCategory = (value: unknown): value is PluginCategory =>
  typeof value === 'string' &&
  PLUGIN_CATEGORIES.includes(value as PluginCategory);

const isPluginCapability = (value: unknown): value is PluginCapability =>
  typeof value === 'string' &&
  PLUGIN_CAPABILITIES.includes(value as PluginCapability);

function normalizeTheme(value: unknown): MindmapTheme | null {
  if (!isRecord(value)) {
    return null;
  }

  const theme: MindmapTheme = {
    id: asString(value.id).trim(),
    name: asString(value.name).trim(),
    canvasBackground: asString(value.canvasBackground, '#ffffff'),
    gridColor: asString(value.gridColor, '#edf2f8'),
    nodeBackground: asString(value.nodeBackground, '#eef5ff'),
    nodeBorder: asString(value.nodeBorder, '#1f6feb'),
    nodeText: asString(value.nodeText, '#14315f'),
    lineColor: asString(value.lineColor, '#b7c5d8'),
  };

  return theme.id && theme.name ? theme : null;
}

function normalizeIcon(value: unknown): PluginIconContribution | null {
  if (typeof value === 'string') {
    const icon = value.trim();
    return icon ? { value: icon, label: icon } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const iconValue = asString(value.value).trim();
  const label = asString(value.label, iconValue).trim();

  return iconValue ? { value: iconValue, label: label || iconValue } : null;
}

function normalizeNodeType(value: unknown): MindmapNodeType | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  const shape = asString(value.shape, 'rounded') as MindmapNodeType['shape'];
  const safeShape: MindmapNodeType['shape'] = [
    'rounded',
    'rectangle',
    'pill',
    'diamond',
  ].includes(shape)
    ? shape
    : 'rounded';
  const fontSize = Number(value.fontSize);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    icon: asString(value.icon),
    shape: safeShape,
    backgroundColor: asString(value.backgroundColor, '#eef5ff'),
    borderColor: asString(value.borderColor, '#1f6feb'),
    textColor: asString(value.textColor, '#14315f'),
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18,
    bold: Boolean(value.bold),
    defaultText: asString(value.defaultText, '新节点'),
    defaultRemark: asString(value.defaultRemark),
  };
}

function normalizeExportFormat(
  value: unknown,
): PluginExportFormatContribution | null {
  if (!isRecord(value)) {
    return null;
  }

  const formatId = asString(value.formatId).trim();
  const label = asString(value.label).trim();
  const fileName = asString(value.fileName).trim();

  if (!formatId || !label || !fileName) {
    return null;
  }

  return {
    formatId,
    label,
    fileName,
    handlerId: asString(value.handlerId).trim() || undefined,
  };
}

function normalizeTool(value: unknown): PluginToolContribution | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolId = asString(value.toolId).trim();
  const label = asString(value.label).trim();

  if (!toolId || !label) {
    return null;
  }

  return {
    toolId,
    label,
    description: asString(value.description).trim() || undefined,
  };
}

function normalizeContributions(value: unknown): PluginContributions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const contributions: PluginContributions = {};

  if (Array.isArray(value.themes)) {
    contributions.themes = value.themes
      .map(normalizeTheme)
      .filter((theme): theme is MindmapTheme => Boolean(theme));
  }

  if (Array.isArray(value.icons)) {
    contributions.icons = value.icons
      .map(normalizeIcon)
      .filter((icon): icon is PluginIconContribution => Boolean(icon));
  }

  if (Array.isArray(value.nodeTypes)) {
    contributions.nodeTypes = value.nodeTypes
      .map(normalizeNodeType)
      .filter((nodeType): nodeType is MindmapNodeType => Boolean(nodeType));
  }

  if (Array.isArray(value.exportFormats)) {
    contributions.exportFormats = value.exportFormats
      .map(normalizeExportFormat)
      .filter((format): format is PluginExportFormatContribution =>
        Boolean(format),
      );
  }

  if (Array.isArray(value.tools)) {
    contributions.tools = value.tools
      .map(normalizeTool)
      .filter((tool): tool is PluginToolContribution => Boolean(tool));
  }

  return Object.keys(contributions).length > 0 ? contributions : undefined;
}

export function normalizePluginManifest(value: unknown): PluginManifest | null {
  if (!isRecord(value)) {
    return null;
  }

  const pluginId = asString(value.pluginId).trim();
  const name = asString(value.name).trim();
  const version = asString(value.version).trim();

  if (!pluginId || !name || !version || !isPluginCategory(value.category)) {
    return null;
  }

  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter(isPluginCapability)
    : [];

  return {
    pluginId,
    name,
    version,
    author: asString(value.author, '未知作者').trim() || '未知作者',
    description: asString(value.description).trim(),
    category: value.category,
    capabilities,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    installedAt: asString(value.installedAt).trim() || new Date().toISOString(),
    config: isRecord(value.config) ? value.config : undefined,
    contributions: normalizeContributions(value.contributions),
  };
}

export function loadPluginRegistry(): PluginManifest[] {
  const rawValue = window.localStorage.getItem(PLUGIN_STORAGE_KEY);

  if (!rawValue) {
    const initialPlugins = BUILT_IN_PLUGINS.map((plugin) => ({ ...plugin }));
    savePluginRegistry(initialPlugins);
    return initialPlugins;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      throw new Error('Plugin registry must be an array.');
    }

    return parsedValue
      .map(normalizePluginManifest)
      .filter((plugin): plugin is PluginManifest => Boolean(plugin));
  } catch {
    const initialPlugins = BUILT_IN_PLUGINS.map((plugin) => ({ ...plugin }));
    savePluginRegistry(initialPlugins);
    return initialPlugins;
  }
}

export function savePluginRegistry(plugins: PluginManifest[]) {
  window.localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(plugins));
}

export function setPluginEnabled(
  plugins: PluginManifest[],
  pluginId: string,
  enabled: boolean,
) {
  return plugins.map((plugin) =>
    plugin.pluginId === pluginId ? { ...plugin, enabled } : plugin,
  );
}

export function uninstallPlugin(plugins: PluginManifest[], pluginId: string) {
  return plugins.filter((plugin) => plugin.pluginId !== pluginId);
}

export function installPluginManifest(
  plugins: PluginManifest[],
  manifest: PluginManifest,
) {
  const nextManifest: PluginManifest = {
    ...manifest,
    enabled: true,
    installedAt: manifest.installedAt || new Date().toISOString(),
  };

  return [
    ...plugins.filter((plugin) => plugin.pluginId !== manifest.pluginId),
    nextManifest,
  ];
}

export async function readLocalPluginManifest() {
  const file = await selectLocalFile('.json,application/json');

  if (!file) {
    return null;
  }

  const rawText = await file.text();
  const parsedValue = JSON.parse(rawText);
  const manifest = normalizePluginManifest(parsedValue);

  if (!manifest) {
    throw new Error('Invalid plugin manifest.');
  }

  return manifest;
}

export function getEnabledPlugins(plugins: PluginManifest[]) {
  return plugins.filter((plugin) => plugin.enabled);
}

export function getPluginThemes(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).flatMap(
    (plugin) => plugin.contributions?.themes ?? [],
  );
}

export function getPluginIcons(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).flatMap(
    (plugin) => plugin.contributions?.icons ?? [],
  );
}

export function getPluginNodeTypes(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).flatMap(
    (plugin) => plugin.contributions?.nodeTypes ?? [],
  );
}

export function isTxtExportPluginEnabled(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).some(
    (plugin) =>
      plugin.capabilities.includes('exportText') &&
      plugin.contributions?.exportFormats?.some(
        (format) => format.handlerId === 'builtin-txt',
      ),
  );
}
