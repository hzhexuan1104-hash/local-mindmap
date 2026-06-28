import type { MindmapNodeType } from './types';
import type { MindmapTheme } from './themes';
import type { MindmapTemplate } from './templates';
import type { NodeTypePack } from './nodeTypePacks';
import type { TemplatePack } from './templatePacks';
import { parseNodeTypePack } from './nodeTypePacks';
import { parseTemplatePack } from './templatePacks';
import { selectLocalFile } from './fileUtils';
import {
  isPluginCommandId,
  type PluginCommandId,
} from '../plugins/pluginCommands';
import {
  installPluginToUserDir,
  isDesktopRuntime,
  loadPluginRegistry as loadStoredPluginRegistry,
  readUserJson,
  savePluginRegistry as saveStoredPluginRegistry,
  uninstallPluginFromUserDir,
  USER_DATA_PATHS,
} from '../storage/userDataStorage';

export type PluginCategory =
  | 'import-export'
  | 'theme'
  | 'icon-pack'
  | 'node-type'
  | 'template'
  | 'tool';

export type PluginType =
  | 'import-export'
  | 'node-type-pack'
  | 'template-pack'
  | 'theme-pack'
  | 'icon-pack'
  | 'tool';

export type PluginCapability =
  | 'export'
  | 'nodeTypes'
  | 'templates'
  | 'themes'
  | 'icons'
  | 'tools';

export type PluginIconContribution = {
  value: string;
  label: string;
};

export type PluginExporterContribution = {
  id: string;
  label: string;
  handler: string;
  fileName?: string;
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

export type PluginMenuWhen = 'always' | 'hasMindmap' | 'hasSelectedNode';

export type PluginMenuContribution = {
  id: string;
  label: string;
  location: string;
  command: string;
  when: PluginMenuWhen;
  valid: boolean;
  invalidReason?: string;
};

export type PluginContributions = {
  exporters?: PluginExporterContribution[];
  nodeTypePacks?: NodeTypePack[];
  templatePacks?: TemplatePack[];
  themes?: MindmapTheme[];
  icons?: PluginIconContribution[];
  nodeTypes?: MindmapNodeType[];
  exportFormats?: PluginExportFormatContribution[];
  tools?: PluginToolContribution[];
  menus?: PluginMenuContribution[];
};

export type PluginManifest = {
  manifestVersion: number;
  pluginId: string;
  name: string;
  version: string;
  author: string;
  description: string;
  pluginType: PluginType;
  category: PluginCategory;
  capabilities: PluginCapability[];
  enabled: boolean;
  installedAt: string;
  builtIn?: boolean;
  validationWarnings?: string[];
  manifestValid?: boolean;
  manifestError?: string;
  config?: Record<string, unknown>;
  contributions?: PluginContributions;
};

export type PluginValidationResult = {
  manifest: PluginManifest | null;
  errors: PluginValidationError[];
  warnings: string[];
};

export type PluginValidationErrorCode =
  | 'invalid-json-object'
  | 'forbidden-field'
  | 'invalid-manifest-version'
  | 'missing-required-field'
  | 'invalid-plugin-id'
  | 'unsupported-plugin-type'
  | 'invalid-capabilities'
  | 'unsupported-capability'
  | 'invalid-contributions';

export type PluginValidationError = {
  code: PluginValidationErrorCode;
  message: string;
  field?: string;
  value?: unknown;
};

export const SUPPORTED_PLUGIN_TYPES: readonly PluginType[] = [
  'theme-pack',
  'icon-pack',
  'import-export',
  'node-type-pack',
  'template-pack',
  'tool',
] as const;

export const SUPPORTED_CAPABILITIES: readonly PluginCapability[] = [
  'themes',
  'icons',
  'export',
  'nodeTypes',
  'templates',
  'tools',
] as const;

export const FORBIDDEN_PLUGIN_FIELDS = [
  'script',
  'eval',
  'function',
  'remoteurl',
  'code',
  'shell',
  'executable',
] as const;

const FORBIDDEN_PLUGIN_FIELD_SET = new Set<string>(FORBIDDEN_PLUGIN_FIELDS);
const SUPPORTED_MENU_LOCATION = 'plugins';
const SUPPORTED_MENU_WHEN: readonly PluginMenuWhen[] = [
  'always',
  'hasMindmap',
  'hasSelectedNode',
];

const BUILT_IN_INSTALLED_AT = '2026-06-27T00:00:00.000Z';

export const BUILT_IN_PLUGINS: PluginManifest[] = [
  {
    manifestVersion: 1,
    pluginId: 'builtin-theme-pack',
    name: '示例主题包',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '提供紫色主题和海洋主题。',
    pluginType: 'theme-pack',
    category: 'theme',
    capabilities: ['themes'],
    enabled: true,
    installedAt: BUILT_IN_INSTALLED_AT,
    builtIn: true,
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
    manifestVersion: 1,
    pluginId: 'builtin-icon-pack',
    name: '示例图标包',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '提供一组本地字符图标，用于自定义节点类型。',
    pluginType: 'icon-pack',
    category: 'icon-pack',
    capabilities: ['icons'],
    enabled: true,
    installedAt: BUILT_IN_INSTALLED_AT,
    builtIn: true,
    contributions: {
      icons: [
        { value: '🚀', label: '🚀 启动' },
        { value: '🔥', label: '🔥 热点' },
        { value: '🧠', label: '🧠 思考' },
        { value: '🎯', label: '🎯 目标' },
        { value: '📎', label: '📎 附件' },
      ],
    },
  },
  {
    manifestVersion: 1,
    pluginId: 'localmindmap.export.txt',
    name: 'TXT 导出插件',
    version: '1.0.0',
    author: 'Local Mindmap',
    description: '提供 TXT 导出能力，由应用内置安全 handler 完成。',
    pluginType: 'import-export',
    category: 'import-export',
    capabilities: ['export'],
    enabled: true,
    installedAt: BUILT_IN_INSTALLED_AT,
    builtIn: true,
    contributions: {
      exporters: [
        {
          id: 'exportText',
          label: 'TXT 导出',
          fileName: 'mindmap.txt',
          handler: 'builtin.exportText',
        },
      ],
      menus: [
        {
          id: 'exportTextMenu',
          label: '导出为 TXT',
          location: 'plugins',
          command: 'builtin.exportText',
          when: 'hasMindmap',
          valid: true,
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

const isPluginType = (value: unknown): value is PluginType =>
  typeof value === 'string' &&
  SUPPORTED_PLUGIN_TYPES.includes(value as PluginType);

const isPluginCapability = (value: unknown): value is PluginCapability =>
  typeof value === 'string' &&
  SUPPORTED_CAPABILITIES.includes(value as PluginCapability);

const isSafePluginId = (value: string) => /^[A-Za-z0-9._-]+$/.test(value);

function findForbiddenField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const field = findForbiddenField(item);
      if (field) {
        return field;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PLUGIN_FIELD_SET.has(key.toLowerCase())) {
      return key;
    }
    const field = findForbiddenField(child);
    if (field) {
      return field;
    }
  }

  return null;
}

function categoryForPluginType(pluginType: PluginType): PluginCategory {
  const categories: Record<PluginType, PluginCategory> = {
    'import-export': 'import-export',
    'node-type-pack': 'node-type',
    'template-pack': 'template',
    'theme-pack': 'theme',
    'icon-pack': 'icon-pack',
    tool: 'tool',
  };
  return categories[pluginType];
}

function pluginTypeForLegacyCategory(category: unknown): PluginType | null {
  const types: Partial<Record<PluginCategory, PluginType>> = {
    'import-export': 'import-export',
    theme: 'theme-pack',
    'icon-pack': 'icon-pack',
    'node-type': 'node-type-pack',
    template: 'template-pack',
    tool: 'tool',
  };
  return typeof category === 'string'
    ? types[category as PluginCategory] ?? null
    : null;
}

function normalizeLegacyPluginType(value: unknown): PluginType | null {
  if (isPluginType(value)) {
    return value;
  }
  return value === 'exporter' ? 'import-export' : null;
}

function normalizeLegacyCapability(value: unknown): PluginCapability | null {
  if (isPluginCapability(value)) {
    return value;
  }
  const aliases: Record<string, PluginCapability> = {
    exportText: 'export',
    themePack: 'themes',
    iconPack: 'icons',
    nodeTypePack: 'nodeTypes',
    templatePack: 'templates',
    toolPanel: 'tools',
  };
  return typeof value === 'string' ? aliases[value] ?? null : null;
}

function normalizeInstalledAt(value: unknown) {
  const installedAt = asString(value).trim();
  const timestamp = Date.parse(installedAt);
  return Number.isFinite(timestamp) && new Date(timestamp).getUTCFullYear() >= 2000
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();
}

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
  const fontSize = Number(value.fontSize);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    icon: asString(value.icon),
    shape: ['rounded', 'rectangle', 'pill', 'diamond'].includes(shape)
      ? shape
      : 'rounded',
    backgroundColor: asString(value.backgroundColor, '#eef5ff'),
    borderColor: asString(value.borderColor, '#1f6feb'),
    textColor: asString(value.textColor, '#14315f'),
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18,
    bold: Boolean(value.bold),
    defaultText: asString(value.defaultText, '新节点'),
    defaultRemark: asString(value.defaultRemark),
  };
}

function normalizeExporter(
  value: unknown,
  errors: PluginValidationError[],
): PluginExporterContribution | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id ?? value.formatId).trim();
  const label = asString(value.label).trim();
  const legacyHandler = asString(value.handlerId).trim();
  const handler =
    legacyHandler === 'builtin-txt'
      ? 'builtin.exportText'
      : asString(value.handler ?? value.handlerId).trim();
  if (!id || !label || !handler) {
    return null;
  }
  if (!handler.startsWith('builtin.')) {
    errors.push({
      code: 'invalid-contributions',
      field: 'contributions.exporters.handler',
      value: handler,
      message: `贡献点 ${id} 的 handler 必须以 builtin. 开头。`,
    });
    return null;
  }

  return {
    id,
    label,
    handler,
    fileName: asString(value.fileName).trim() || undefined,
  };
}

function normalizeTool(value: unknown): PluginToolContribution | null {
  if (!isRecord(value)) {
    return null;
  }
  const toolId = asString(value.toolId).trim();
  const label = asString(value.label).trim();
  return toolId && label
    ? {
        toolId,
        label,
        description: asString(value.description).trim() || undefined,
      }
    : null;
}

function normalizeMenu(
  value: unknown,
  index: number,
): PluginMenuContribution {
  if (!isRecord(value)) {
    return {
      id: `invalid-menu-${index + 1}`,
      label: `无效菜单项 ${index + 1}`,
      location: '',
      command: '',
      when: 'always',
      valid: false,
      invalidReason: '菜单贡献必须是对象。',
    };
  }

  const id = asString(value.id).trim();
  const label = asString(value.label).trim();
  const location = asString(value.location, SUPPORTED_MENU_LOCATION).trim();
  const command = asString(value.command).trim();
  const rawWhen = asString(value.when, 'always').trim();
  const reasons: string[] = [];

  if (!id) reasons.push('id 必填。');
  if (!label) reasons.push('label 必填。');
  if (!command) {
    reasons.push('command 必填。');
  } else if (!isPluginCommandId(command)) {
    reasons.push(`插件命令不存在：${command}`);
  }
  if (location !== SUPPORTED_MENU_LOCATION) {
    reasons.push(`不支持的菜单位置：${location || '空'}`);
  }
  if (!SUPPORTED_MENU_WHEN.includes(rawWhen as PluginMenuWhen)) {
    reasons.push(`不支持的显示条件：${rawWhen}`);
  }

  return {
    id: id || `invalid-menu-${index + 1}`,
    label: label || `无效菜单项 ${index + 1}`,
    location,
    command,
    when: SUPPORTED_MENU_WHEN.includes(rawWhen as PluginMenuWhen)
      ? (rawWhen as PluginMenuWhen)
      : 'always',
    valid: reasons.length === 0,
    invalidReason: reasons.length > 0 ? reasons.join(' ') : undefined,
  };
}

function normalizeNodeTypePack(value: unknown): NodeTypePack | null {
  try {
    return parseNodeTypePack(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizeTemplatePack(value: unknown): TemplatePack | null {
  try {
    return parseTemplatePack(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizeContributions(
  value: unknown,
  errors: PluginValidationError[],
  warnings: string[],
): PluginContributions | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    errors.push({
      code: 'invalid-contributions',
      field: 'contributions',
      value,
      message: 'contributions 必须是对象。',
    });
    return undefined;
  }

  const contributions: PluginContributions = {};
  const exporterValues = Array.isArray(value.exporters)
    ? value.exporters
    : Array.isArray(value.exportFormats)
      ? value.exportFormats
      : [];
  if (exporterValues.length > 0) {
    contributions.exporters = exporterValues
      .map((item) => normalizeExporter(item, errors))
      .filter((item): item is PluginExporterContribution => Boolean(item));
    if (contributions.exporters.length !== exporterValues.length) {
      warnings.push('部分非法导出贡献已跳过。');
    }
  }

  if (Array.isArray(value.nodeTypePacks)) {
    contributions.nodeTypePacks = value.nodeTypePacks
      .map(normalizeNodeTypePack)
      .filter((pack): pack is NodeTypePack => Boolean(pack));
    if (contributions.nodeTypePacks.length !== value.nodeTypePacks.length) {
      warnings.push('部分非法节点类型包贡献已跳过。');
    }
  }

  if (Array.isArray(value.templatePacks)) {
    contributions.templatePacks = value.templatePacks
      .map(normalizeTemplatePack)
      .filter((pack): pack is TemplatePack => Boolean(pack));
    if (contributions.templatePacks.length !== value.templatePacks.length) {
      warnings.push('部分非法模板包贡献已跳过。');
    }
  }

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
  if (Array.isArray(value.tools)) {
    contributions.tools = value.tools
      .map(normalizeTool)
      .filter((tool): tool is PluginToolContribution => Boolean(tool));
  }
  if (Array.isArray(value.menus)) {
    contributions.menus = value.menus.map(normalizeMenu);
    const menuIdCounts = contributions.menus.reduce((counts, menu) => {
      counts.set(menu.id, (counts.get(menu.id) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
    contributions.menus = contributions.menus.map((menu) =>
      (menuIdCounts.get(menu.id) ?? 0) > 1
        ? {
            ...menu,
            valid: false,
            invalidReason: [menu.invalidReason, `菜单 id 重复：${menu.id}`]
              .filter(Boolean)
              .join(' '),
          }
        : menu,
    );
    const invalidMenus = contributions.menus.filter((menu) => !menu.valid);
    if (invalidMenus.length > 0) {
      warnings.push(
        ...invalidMenus.map(
          (menu) => `菜单贡献 ${menu.id} 无效：${menu.invalidReason}`,
        ),
      );
    }
  }

  return Object.values(contributions).some((items) => items && items.length > 0)
    ? contributions
    : undefined;
}

function validatePluginManifestInternal(
  value: unknown,
  allowLegacy: boolean,
): PluginValidationResult {
  const errors: PluginValidationError[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) {
    return {
      manifest: null,
      errors: [
        {
          code: 'invalid-json-object',
          message: '插件 manifest 必须是 JSON 对象。',
          value,
        },
      ],
      warnings,
    };
  }

  const forbiddenField = findForbiddenField(value);
  if (forbiddenField) {
    errors.push({
      code: 'forbidden-field',
      field: forbiddenField,
      message: `插件包含非法字段：${forbiddenField}`,
    });
  }

  const rawManifestVersion = value.manifestVersion;
  const manifestVersion =
    allowLegacy && rawManifestVersion === undefined ? 1 : Number(rawManifestVersion);
  if (!Number.isInteger(manifestVersion) || manifestVersion < 1) {
    errors.push({
      code: 'invalid-manifest-version',
      field: 'manifestVersion',
      value: rawManifestVersion,
      message: 'manifestVersion 必须是正整数。',
    });
  }

  const pluginId = asString(value.pluginId).trim();
  const name = asString(value.name).trim();
  const version = asString(value.version).trim();
  if (!pluginId) {
    errors.push({
      code: 'missing-required-field',
      field: 'pluginId',
      message: '缺少必填字段：pluginId',
    });
  } else if (!isSafePluginId(pluginId)) {
    errors.push({
      code: 'invalid-plugin-id',
      field: 'pluginId',
      value: pluginId,
      message: 'pluginId 只能包含字母、数字、点、下划线和短横线。',
    });
  }
  if (!name) {
    errors.push({
      code: 'missing-required-field',
      field: 'name',
      message: '缺少必填字段：name',
    });
  }
  if (!version) {
    errors.push({
      code: 'missing-required-field',
      field: 'version',
      message: '缺少必填字段：version',
    });
  }

  const pluginType = isPluginType(value.pluginType)
    ? value.pluginType
    : allowLegacy
      ? normalizeLegacyPluginType(value.pluginType) ??
        pluginTypeForLegacyCategory(value.category)
      : null;
  if (!pluginType) {
    const supportedTypes = SUPPORTED_PLUGIN_TYPES.join(', ');
    errors.push({
      code:
        value.pluginType === undefined
          ? 'missing-required-field'
          : 'unsupported-plugin-type',
      field: 'pluginType',
      value: value.pluginType,
      message:
        value.pluginType === undefined
          ? `缺少必填字段：pluginType。支持的类型：${supportedTypes}`
          : `pluginType 不受支持：${String(value.pluginType)}。支持的类型：${supportedTypes}`,
    });
  }

  if (!Array.isArray(value.capabilities)) {
    errors.push({
      code: 'invalid-capabilities',
      field: 'capabilities',
      value: value.capabilities,
      message: 'capabilities 必须是数组。',
    });
  }
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities
        .map((capability) =>
          allowLegacy
            ? normalizeLegacyCapability(capability)
            : isPluginCapability(capability)
              ? capability
              : null,
        )
        .filter(
          (capability): capability is PluginCapability => capability !== null,
        )
    : [];
  if (Array.isArray(value.capabilities)) {
    const unsupportedCapabilities = value.capabilities.filter((capability) =>
      allowLegacy
        ? normalizeLegacyCapability(capability) === null
        : !isPluginCapability(capability),
    );
    if (unsupportedCapabilities.length > 0) {
      errors.push({
        code: 'unsupported-capability',
        field: 'capabilities',
        value: unsupportedCapabilities,
        message: `capabilities 包含不受支持的值：${unsupportedCapabilities
          .map(String)
          .join(', ')}。支持的 capabilities：${SUPPORTED_CAPABILITIES.join(', ')}`,
      });
    }
  }

  const contributions = normalizeContributions(
    value.contributions,
    errors,
    warnings,
  );
  if (errors.length > 0 || !pluginType) {
    return { manifest: null, errors, warnings };
  }

  return {
    manifest: {
      manifestVersion,
      pluginId,
      name,
      version,
      author: asString(value.author, '未知作者').trim() || '未知作者',
      description: asString(value.description).trim(),
      pluginType,
      category: categoryForPluginType(pluginType),
      capabilities,
      enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
      installedAt: normalizeInstalledAt(value.installedAt),
      builtIn: Boolean(value.builtIn),
      validationWarnings:
        warnings.length > 0 ? Array.from(new Set(warnings)) : undefined,
      config: isRecord(value.config) ? value.config : undefined,
      contributions,
      manifestValid: true,
    },
    errors,
    warnings,
  };
}

export function validatePluginManifest(value: unknown): PluginValidationResult {
  return validatePluginManifestInternal(value, false);
}

export function normalizePluginManifest(value: unknown): PluginManifest | null {
  return validatePluginManifestInternal(value, true).manifest;
}

function clonePlugin(plugin: PluginManifest): PluginManifest {
  return JSON.parse(JSON.stringify(plugin)) as PluginManifest;
}

export async function loadPluginRegistry(options?: {
  allowRegistryFallback?: boolean;
}): Promise<PluginManifest[]> {
  const storedPlugins = await loadStoredPluginRegistry();
  const normalizedPlugins = Array.isArray(storedPlugins)
    ? storedPlugins
        .map(normalizePluginManifest)
        .filter((plugin): plugin is PluginManifest => Boolean(plugin))
    : [];
  const storedById = new Map(
    normalizedPlugins.map((plugin) => [plugin.pluginId, plugin]),
  );
  const legacyTxtPlugin = storedById.get('builtin-txt-export');
  const builtIns = BUILT_IN_PLUGINS.map((plugin) => ({
    ...clonePlugin(plugin),
    enabled:
      storedById.get(plugin.pluginId)?.enabled ??
      (plugin.pluginId === 'localmindmap.export.txt'
        ? legacyTxtPlugin?.enabled
        : undefined) ??
      plugin.enabled,
  }));
  const builtInIds = new Set(builtIns.map((plugin) => plugin.pluginId));
  const installedPlugins = await Promise.all(
    normalizedPlugins
      .filter(
        (plugin) =>
          !builtInIds.has(plugin.pluginId) &&
          plugin.pluginId !== 'builtin-txt-export',
      )
      .map(async (registryPlugin) => {
        const path = `${USER_DATA_PATHS.installedPlugins}/${registryPlugin.pluginId}/manifest.json`;
        try {
          const rawManifest = await readUserJson<unknown>(path, null);
          const result = validatePluginManifestInternal(rawManifest, true);
          if (
            result.manifest &&
            result.manifest.pluginId === registryPlugin.pluginId
          ) {
            return {
              ...result.manifest,
              enabled: registryPlugin.enabled,
              installedAt: registryPlugin.installedAt,
              builtIn: false,
              manifestValid: true,
            };
          }
          if (options?.allowRegistryFallback) {
            return registryPlugin;
          }
          return {
            ...registryPlugin,
            contributions: undefined,
            manifestValid: false,
            manifestError:
              result.manifest &&
              result.manifest.pluginId !== registryPlugin.pluginId
                ? `manifest pluginId 与 registry 不一致：${result.manifest.pluginId}`
                : result.errors.map((error) => error.message).join(' ') ||
                  'manifest.json 缺失或损坏。',
          };
        } catch (error) {
          if (options?.allowRegistryFallback) {
            return registryPlugin;
          }
          return {
            ...registryPlugin,
            contributions: undefined,
            manifestValid: false,
            manifestError:
              error instanceof Error ? error.message : String(error),
          };
        }
      }),
  );

  return [
    ...builtIns,
    ...installedPlugins,
  ];
}

export async function savePluginRegistry(plugins: PluginManifest[]) {
  await saveStoredPluginRegistry(plugins);
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
  return plugins.filter(
    (plugin) => plugin.pluginId !== pluginId || plugin.builtIn,
  );
}

export function installPluginManifest(
  plugins: PluginManifest[],
  manifest: PluginManifest,
) {
  const nextManifest: PluginManifest = {
    ...manifest,
    builtIn: false,
    enabled: true,
    installedAt: new Date().toISOString(),
  };

  return [
    ...plugins.filter((plugin) => plugin.pluginId !== manifest.pluginId),
    nextManifest,
  ];
}

function errorDetail(error: unknown) {
  return typeof error === 'string'
    ? error
    : error instanceof Error && error.message
      ? error.message
      : String(error);
}

export async function installPlugin(
  plugins: PluginManifest[],
  manifest: PluginManifest,
  overwrite = false,
) {
  const exists = plugins.some(
    (plugin) => plugin.pluginId === manifest.pluginId && !plugin.builtIn,
  );
  if (exists && !overwrite) {
    throw new Error(`插件已存在：${manifest.pluginId}`);
  }

  const nextPlugins = installPluginManifest(plugins, manifest);
  const installedManifest = nextPlugins.find(
    (plugin) => plugin.pluginId === manifest.pluginId,
  ) as PluginManifest;

  await installPluginToUserDir(installedManifest, overwrite);
  if (isDesktopRuntime()) {
    return { plugins: nextPlugins, manifest: installedManifest };
  }

  try {
    await saveStoredPluginRegistry(nextPlugins);
  } catch (error) {
    try {
      await uninstallPluginFromUserDir(manifest.pluginId);
    } catch {
      // Keep the original registry-write error; cleanup is best effort.
    }
    throw new Error(`插件注册表写入用户目录失败：${errorDetail(error)}`);
  }

  return { plugins: nextPlugins, manifest: installedManifest };
}

export class PluginManifestError extends Error {
  validationErrors: PluginValidationError[];
  warnings: string[];

  constructor(errors: PluginValidationError[], warnings: string[] = []) {
    super(errors.map((error) => error.message).join(' '));
    this.name = 'PluginManifestError';
    this.validationErrors = errors;
    this.warnings = warnings;
  }
}

export function parsePluginManifestText(text: string) {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(text);
  } catch {
    throw new PluginManifestError([
      {
        code: 'invalid-json-object',
        message: '插件 JSON 解析失败。',
      },
    ]);
  }

  const result = validatePluginManifest(parsedValue);
  if (!result.manifest) {
    throw new PluginManifestError(result.errors, result.warnings);
  }
  return result.manifest;
}

export async function readLocalPluginManifest() {
  const file = await selectLocalFile(
    '.json,.lmplugin,application/json,application/octet-stream',
  );
  if (!file) {
    return null;
  }

  return parsePluginManifestText(await file.text());
}

export function getEnabledPlugins(plugins: PluginManifest[]) {
  return plugins.filter(
    (plugin) => plugin.enabled && plugin.manifestValid !== false,
  );
}

export function getPluginMenus(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).flatMap((plugin) =>
    (plugin.contributions?.menus ?? [])
      .filter((menu) => menu.valid)
      .map((menu) => ({ plugin, menu })),
  );
}

export function getPluginMenuGroups(
  plugins: PluginManifest[],
  context: { hasMindmap: boolean; hasSelectedNode: boolean },
) {
  const groups = new Map<
    string,
    {
      pluginId: string;
      pluginName: string;
      items: PluginMenuContribution[];
    }
  >();

  for (const { plugin, menu } of getPluginMenus(plugins)) {
    const visible =
      menu.when === 'always' ||
      (menu.when === 'hasMindmap' && context.hasMindmap) ||
      (menu.when === 'hasSelectedNode' && context.hasSelectedNode);
    if (!visible) {
      continue;
    }
    const group = groups.get(plugin.pluginId) ?? {
      pluginId: plugin.pluginId,
      pluginName: plugin.name,
      items: [],
    };
    group.items.push(menu);
    groups.set(plugin.pluginId, group);
  }

  return Array.from(groups.values());
}

export function isKnownPluginCommand(command: string): command is PluginCommandId {
  return isPluginCommandId(command);
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
  return getEnabledPlugins(plugins).flatMap((plugin) => [
    ...(plugin.contributions?.nodeTypes ?? []),
    ...(plugin.contributions?.nodeTypePacks ?? []).flatMap(
      (pack) => pack.nodeTypes,
    ),
  ]);
}

export function getPluginTemplates(plugins: PluginManifest[]): MindmapTemplate[] {
  return getEnabledPlugins(plugins).flatMap((plugin) =>
    (plugin.contributions?.templatePacks ?? []).flatMap((pack) =>
      pack.templates.map((template) => ({
        ...template,
        isOfficial: true,
      })),
    ),
  );
}

export function getPluginExporters(plugins: PluginManifest[]) {
  return getEnabledPlugins(plugins).flatMap(
    (plugin) => plugin.contributions?.exporters ?? [],
  );
}

export function isTxtExportPluginEnabled(plugins: PluginManifest[]) {
  return getPluginExporters(plugins).some(
    (exporter) => exporter.handler === 'builtin.exportText',
  );
}
