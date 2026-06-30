import type { MindmapNodeType } from './types';
import type { MindmapTheme } from './themes';
import type { MindmapTemplate } from './templates';
import type { NodeTypePack } from './nodeTypePacks';
import type { TemplatePack } from './templatePacks';
import { parseNodeTypePack } from './nodeTypePacks';
import { parseTemplatePack } from './templatePacks';
import { openLocalTextFile } from './localFileOperations';
import {
  isPluginCommandId,
  type PluginCommandId,
} from '../plugins/pluginCommands';
import {
  installPluginToUserDir,
  isDesktopRuntime,
  reloadPluginsFromDisk,
  savePluginRegistry as saveStoredPluginRegistry,
  uninstallPluginFromUserDir,
  USER_DATA_PATHS,
  type PluginInstallAsset,
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
  | 'tool'
  | 'script';

export type PluginCapability =
  | 'export'
  | 'nodeTypes'
  | 'templates'
  | 'themes'
  | 'icons'
  | 'tools'
  | 'script'
  | 'mindmap:read'
  | 'mindmap:write'
  | 'node:read'
  | 'node:write';

export type PluginPermission =
  | 'mindmap:read'
  | 'mindmap:write'
  | 'node:read'
  | 'node:write';

export type PluginIconContribution = {
  value: string;
  label: string;
};

export type PluginExporterContribution = {
  id: string;
  label: string;
  handler: string;
  fileName?: string;
  valid: boolean;
  invalidReason?: string;
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
  command?: string;
  handler?: string;
  valid: boolean;
  invalidReason?: string;
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
  entry?: string;
  permissions?: PluginPermission[];
  builtIn?: boolean;
  validationWarnings?: string[];
  manifestValid?: boolean;
  manifestError?: string;
  validationErrors?: PluginValidationError[];
  source?: PluginSource;
  manifestPath?: string;
  installedDirPath?: string;
  config?: Record<string, unknown>;
  contributions?: PluginContributions;
};

export type PluginSource =
  | 'built-in'
  | 'external'
  | 'orphan-manifest'
  | 'registry-missing'
  | 'manifest-missing'
  | 'manifest-damaged';

export type PluginValidationResult = {
  valid: boolean;
  manifest: PluginManifest | null;
  normalizedManifest: PluginManifest | null;
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
  | 'invalid-script-entry'
  | 'invalid-capabilities'
  | 'invalid-permissions'
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
  'script',
] as const;

export const SUPPORTED_CAPABILITIES: readonly PluginCapability[] = [
  'themes',
  'icons',
  'export',
  'nodeTypes',
  'templates',
  'tools',
  'script',
  'mindmap:read',
  'mindmap:write',
  'node:read',
  'node:write',
] as const;

export const SUPPORTED_PLUGIN_PERMISSIONS: readonly PluginPermission[] = [
  'mindmap:read',
  'mindmap:write',
  'node:read',
  'node:write',
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
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_EXPORTER_HANDLERS = new Set(['builtin.exportText']);

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
          valid: true,
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

const isPluginPermission = (value: unknown): value is PluginPermission =>
  typeof value === 'string' &&
  SUPPORTED_PLUGIN_PERMISSIONS.includes(value as PluginPermission);

const isSafePluginId = (value: string) => /^[A-Za-z0-9._-]+$/.test(value);

export function validateScriptEntryPath(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'pluginType=script 时 entry 必填。';
  }
  const entry = value.trim().replace(/\\/g, '/');
  if (/^(?:[A-Za-z]:\/|\/|\/\/)/.test(entry)) {
    return 'entry 只能是相对路径，不能是绝对路径。';
  }
  if (
    entry
      .split('/')
      .some((segment) => segment === '..' || segment === '.' || segment === '')
  ) {
    return 'entry 不允许包含 ..、. 或空路径片段。';
  }
  if (!entry.toLowerCase().endsWith('.js')) {
    return 'entry 本批只支持 .js 文件。';
  }
  return null;
}

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
    script: 'tool',
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
  warnings: string[],
  index: number,
): PluginExporterContribution {
  if (!isRecord(value)) {
    const invalidReason = '导出贡献必须是对象。';
    warnings.push(`导出贡献 ${index + 1} 无效：${invalidReason}`);
    return {
      id: `invalid-exporter-${index + 1}`,
      label: `无效导出项 ${index + 1}`,
      handler: '',
      valid: false,
      invalidReason,
    };
  }

  const id = asString(value.id ?? value.formatId).trim();
  const label = asString(value.label).trim();
  const legacyHandler = asString(value.handlerId).trim();
  const handler =
    legacyHandler === 'builtin-txt'
      ? 'builtin.exportText'
      : asString(value.handler ?? value.handlerId).trim();
  const reasons: string[] = [];
  if (!id) reasons.push('id 必填。');
  if (!label) reasons.push('label 必填。');
  if (!handler) reasons.push('handler 必填。');
  if (!handler.startsWith('builtin.')) {
    errors.push({
      code: 'invalid-contributions',
      field: 'contributions.exporters.handler',
      value: handler,
      message: `贡献点 ${id} 的 handler 必须以 builtin. 开头。`,
    });
    reasons.push('handler 不是允许的内置安全 handler。');
  } else if (!SUPPORTED_EXPORTER_HANDLERS.has(handler)) {
    reasons.push(`插件导出 handler 不存在：${handler}`);
  }

  const contribution = {
    id: id || `invalid-exporter-${index + 1}`,
    label: label || `无效导出项 ${index + 1}`,
    handler,
    fileName: asString(value.fileName).trim() || undefined,
    valid: reasons.length === 0,
    invalidReason: reasons.length > 0 ? reasons.join(' ') : undefined,
  };
  if (!contribution.valid) {
    warnings.push(
      `导出贡献 ${contribution.id} 无效：${contribution.invalidReason}`,
    );
  }
  return contribution;
}

function normalizeTool(
  value: unknown,
  index: number,
  warnings: string[],
): PluginToolContribution {
  if (!isRecord(value)) {
    const invalidReason = '工具贡献必须是对象。';
    warnings.push(`工具贡献 ${index + 1} 无效：${invalidReason}`);
    return {
      toolId: `invalid-tool-${index + 1}`,
      label: `无效工具项 ${index + 1}`,
      valid: false,
      invalidReason,
    };
  }
  const toolId = asString(value.toolId ?? value.id).trim();
  const label = asString(value.label).trim();
  const command = asString(value.command).trim() || undefined;
  const handler = asString(value.handler).trim() || undefined;
  const reasons: string[] = [];
  if (!toolId) reasons.push('id 必填。');
  if (!label) reasons.push('label 必填。');
  const action = command ?? handler;
  if (action && !isPluginCommandId(action)) {
    reasons.push(`插件命令不存在：${action}`);
  }
  const tool = {
    toolId: toolId || `invalid-tool-${index + 1}`,
    label: label || `无效工具项 ${index + 1}`,
    description: asString(value.description).trim() || undefined,
    command,
    handler,
    valid: reasons.length === 0,
    invalidReason: reasons.length > 0 ? reasons.join(' ') : undefined,
  };
  if (!tool.valid) {
    warnings.push(`工具贡献 ${tool.toolId} 无效：${tool.invalidReason}`);
  }
  return tool;
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
  for (const key of [
    'exporters',
    'exportFormats',
    'nodeTypePacks',
    'templatePacks',
    'themes',
    'icons',
    'nodeTypes',
    'tools',
    'menus',
  ]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      errors.push({
        code: 'invalid-contributions',
        field: `contributions.${key}`,
        value: value[key],
        message: `contributions.${key} 必须是数组。`,
      });
    }
  }
  const exporterValues = Array.isArray(value.exporters)
    ? value.exporters
    : Array.isArray(value.exportFormats)
      ? value.exportFormats
      : [];
  if (exporterValues.length > 0) {
    contributions.exporters = exporterValues.map((item, index) =>
      normalizeExporter(item, errors, warnings, index),
    );
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
    contributions.tools = value.tools.map((tool, index) =>
      normalizeTool(tool, index, warnings),
    );
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

function createValidationResult(
  manifest: PluginManifest | null,
  errors: PluginValidationError[],
  warnings: string[],
): PluginValidationResult {
  const uniqueWarnings = Array.from(new Set(warnings));
  return {
    valid: Boolean(manifest) && errors.length === 0,
    manifest,
    normalizedManifest: manifest,
    errors,
    warnings: uniqueWarnings,
  };
}

function warnCapabilityContributionMismatch(
  capabilities: PluginCapability[],
  contributions: PluginContributions | undefined,
  warnings: string[],
) {
  const contributionCounts: Record<PluginCapability, number> = {
    export: contributions?.exporters?.length ?? 0,
    themes: contributions?.themes?.length ?? 0,
    icons: contributions?.icons?.length ?? 0,
    nodeTypes:
      (contributions?.nodeTypes?.length ?? 0) +
      (contributions?.nodeTypePacks?.length ?? 0),
    templates: contributions?.templatePacks?.length ?? 0,
    tools: contributions?.tools?.length ?? 0,
    script: contributions?.menus?.length ?? 0,
    'mindmap:read': 0,
    'mindmap:write': 0,
    'node:read': 0,
    'node:write': 0,
  };

  for (const capability of SUPPORTED_CAPABILITIES) {
    if (
      capability === 'mindmap:read' ||
      capability === 'mindmap:write' ||
      capability === 'node:read' ||
      capability === 'node:write'
    ) {
      continue;
    }
    const declared = capabilities.includes(capability);
    const contributed = contributionCounts[capability] > 0;
    if (declared && !contributed) {
      warnings.push(
        `capabilities 声明了 ${capability}，但未提供对应 contributions。`,
      );
    } else if (!declared && contributed) {
      warnings.push(
        `contributions 提供了 ${capability}，但 capabilities 未声明。`,
      );
    }
  }
}

function validatePluginManifestInternal(
  value: unknown,
  allowLegacy: boolean,
): PluginValidationResult {
  const errors: PluginValidationError[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) {
    return createValidationResult(
      null,
      [
        {
          code: 'invalid-json-object',
          message: '插件 manifest 必须是 JSON 对象。',
          value,
        },
      ],
      warnings,
    );
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
    allowLegacy && rawManifestVersion === undefined
      ? SUPPORTED_MANIFEST_VERSION
      : Number(rawManifestVersion);
  if (rawManifestVersion === undefined && !allowLegacy) {
    errors.push({
      code: 'missing-required-field',
      field: 'manifestVersion',
      value: rawManifestVersion,
      message: 'manifest 缺少必填字段 manifestVersion。',
    });
  } else if (
    !Number.isInteger(manifestVersion) ||
    manifestVersion !== SUPPORTED_MANIFEST_VERSION
  ) {
    errors.push({
      code: 'invalid-manifest-version',
      field: 'manifestVersion',
      value: rawManifestVersion,
      message: `manifestVersion 不支持：${String(rawManifestVersion)}。当前仅支持 ${SUPPORTED_MANIFEST_VERSION}。`,
    });
  }

  const pluginId = asString(value.pluginId).trim();
  const name = asString(value.name).trim();
  const version = asString(value.version).trim();
  if (!pluginId) {
    errors.push({
      code: 'missing-required-field',
      field: 'pluginId',
      message: 'manifest 缺少必填字段 pluginId。',
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
      message: 'manifest 缺少必填字段 name。',
    });
  }
  if (!version) {
    errors.push({
      code: 'missing-required-field',
      field: 'version',
      message: 'manifest 缺少必填字段 version。',
    });
  }

  const usesLegacyExporterType = value.pluginType === 'exporter';
  const pluginType = isPluginType(value.pluginType)
    ? value.pluginType
    : allowLegacy || usesLegacyExporterType
      ? normalizeLegacyPluginType(value.pluginType) ??
        pluginTypeForLegacyCategory(value.category)
      : null;
  if (usesLegacyExporterType && pluginType) {
    warnings.push(
      'pluginType 使用旧字段 exporter，已兼容为 import-export。',
    );
  }
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
          ? `manifest 缺少必填字段 pluginType。支持的 pluginType：${supportedTypes}`
          : `pluginType 不支持：${String(value.pluginType)}。支持的 pluginType：${supportedTypes}`,
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

  let entry: string | undefined;
  if (pluginType === 'script') {
    const entryError = validateScriptEntryPath(value.entry);
    if (entryError) {
      errors.push({
        code:
          value.entry === undefined || value.entry === ''
            ? 'missing-required-field'
            : 'invalid-script-entry',
        field: 'entry',
        value: value.entry,
        message: entryError,
      });
    } else {
      entry = asString(value.entry).trim().replace(/\\/g, '/');
    }
  } else if (value.entry !== undefined) {
    warnings.push('entry 仅在 pluginType=script 时生效。');
  }

  let permissions: PluginPermission[] | undefined;
  if (value.permissions !== undefined) {
    if (!Array.isArray(value.permissions)) {
      errors.push({
        code: 'invalid-permissions',
        field: 'permissions',
        value: value.permissions,
        message: 'permissions 必须是数组。',
      });
    } else {
      const unsupportedPermissions = value.permissions.filter(
        (permission) => !isPluginPermission(permission),
      );
      if (unsupportedPermissions.length > 0) {
        errors.push({
          code: 'invalid-permissions',
          field: 'permissions',
          value: unsupportedPermissions,
          message: `permissions 包含不支持的值：${unsupportedPermissions
            .map(String)
            .join(', ')}。支持的 permissions：${SUPPORTED_PLUGIN_PERMISSIONS.join(', ')}`,
        });
      } else {
        permissions = Array.from(
          new Set(value.permissions as PluginPermission[]),
        );
      }
    }
  }

  const contributions = normalizeContributions(
    value.contributions,
    errors,
    warnings,
  );
  if (pluginType === 'script') {
    for (const menu of contributions?.menus ?? []) {
      if (menu.command !== 'plugin.runScript') {
        menu.valid = false;
        menu.invalidReason = 'script 插件菜单 command 必须是 plugin.runScript。';
        errors.push({
          code: 'invalid-contributions',
          field: 'contributions.menus.command',
          value: menu.command,
          message: `script 插件菜单 ${menu.id} 的 command 必须是 plugin.runScript。`,
        });
      }
    }
  }
  if (!asString(value.author).trim()) {
    warnings.push('manifest 缺少 author。');
  }
  if (!asString(value.description).trim()) {
    warnings.push('manifest 缺少 description。');
  }
  if (!isRecord(value.contributions) || !Array.isArray(value.contributions.menus)) {
    warnings.push('未声明 contributions.menus，已按老插件兼容。');
  }
  warnCapabilityContributionMismatch(capabilities, contributions, warnings);
  if (errors.length > 0 || !pluginType) {
    return createValidationResult(null, errors, warnings);
  }

  const normalizedManifest: PluginManifest = {
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
    entry,
    permissions,
    builtIn: Boolean(value.builtIn),
    config: isRecord(value.config) ? value.config : undefined,
    contributions,
    manifestValid: true,
    source: Boolean(value.builtIn) ? 'built-in' : 'external',
  };
  normalizedManifest.validationWarnings =
    warnings.length > 0 ? Array.from(new Set(warnings)) : undefined;
  return createValidationResult(normalizedManifest, errors, warnings);
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
  /**
   * Migration-only escape hatch. Callers must perform a strict reload before
   * exposing plugins to runtime consumers or UI.
   */
  allowRegistryFallback?: boolean;
}): Promise<PluginManifest[]> {
  const snapshot = await reloadPluginsFromDisk();
  const storedPlugins = snapshot.registry;
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
    source: 'built-in' as const,
    manifestValid: true,
    enabled:
      storedById.get(plugin.pluginId)?.enabled ??
      (plugin.pluginId === 'localmindmap.export.txt'
        ? legacyTxtPlugin?.enabled
        : undefined) ??
      plugin.enabled,
  }));
  const builtInIds = new Set(builtIns.map((plugin) => plugin.pluginId));
  const registryPlugins = normalizedPlugins.filter(
    (plugin) =>
      !builtInIds.has(plugin.pluginId) &&
      plugin.pluginId !== 'builtin-txt-export',
  );
  const scannedEntries = snapshot.installedManifests;
  const scannedById = new Map(
    scannedEntries.map((entry) => [entry.pluginIdHint, entry]),
  );
  const processedScanIds = new Set<string>();
  const createDiagnosticPlugin = (
    pluginId: string,
    source: PluginSource,
    manifestError: string,
    base?: PluginManifest,
    manifestPath?: string,
    validationErrors?: PluginValidationError[],
  ): PluginManifest => ({
    manifestVersion: base?.manifestVersion ?? 0,
    pluginId,
    name: base?.name || pluginId,
    version: base?.version || '未知',
    author: base?.author || '未知作者',
    description: base?.description || '',
    pluginType: base?.pluginType ?? 'tool',
    category: base?.category ?? 'tool',
    capabilities: base?.capabilities ?? [],
    enabled: base?.enabled ?? false,
    installedAt: base?.installedAt ?? new Date().toISOString(),
    builtIn: false,
    manifestValid: false,
    manifestError,
    validationErrors:
      validationErrors ??
      [
        {
          code: 'invalid-json-object',
          message: manifestError,
        },
      ],
    source,
    manifestPath:
      manifestPath ??
      `${USER_DATA_PATHS.installedPlugins}/${pluginId}/manifest.json`,
    installedDirPath: `${USER_DATA_PATHS.installedPlugins}/${pluginId}`,
  });
  const installedPlugins = registryPlugins.map((registryPlugin) => {
    const scanEntry = scannedById.get(registryPlugin.pluginId);
    if (scanEntry) {
      processedScanIds.add(scanEntry.pluginIdHint);
    }
    if (!scanEntry) {
      if (options?.allowRegistryFallback) {
        return registryPlugin;
      }
      return createDiagnosticPlugin(
        registryPlugin.pluginId,
        'manifest-missing',
        'manifest.json 缺失。',
        registryPlugin,
      );
    }
    if (scanEntry.error || !scanEntry.manifest) {
      const source: PluginSource = scanEntry.error?.includes('缺失')
        ? 'manifest-missing'
        : 'manifest-damaged';
      return createDiagnosticPlugin(
        registryPlugin.pluginId,
        source,
        scanEntry.error || 'manifest.json 缺失或损坏。',
        registryPlugin,
        scanEntry.manifestPath,
      );
    }

    const result = validatePluginManifestInternal(scanEntry.manifest, true);
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
        source: 'external' as const,
        manifestPath: scanEntry.manifestPath,
        installedDirPath: `${USER_DATA_PATHS.installedPlugins}/${registryPlugin.pluginId}`,
      };
    }
    return createDiagnosticPlugin(
      registryPlugin.pluginId,
      'manifest-damaged',
      result.manifest
        ? `manifest pluginId 与 registry 不一致：${result.manifest.pluginId}`
        : result.errors.map((error) => error.message).join(' ') ||
            'manifest.json 损坏。',
      registryPlugin,
      scanEntry.manifestPath,
      result.errors,
    );
  });
  const orphanPlugins = scannedEntries
    .filter((entry) => !processedScanIds.has(entry.pluginIdHint))
    .map((entry) => {
      if (entry.error || !entry.manifest) {
        return createDiagnosticPlugin(
          entry.pluginIdHint,
          'orphan-manifest',
          entry.error || 'manifest.json 缺失或损坏。',
          undefined,
          entry.manifestPath,
        );
      }
      const result = validatePluginManifestInternal(entry.manifest, true);
      if (
        result.manifest &&
        result.manifest.pluginId === entry.pluginIdHint
      ) {
        return {
          ...result.manifest,
          enabled: false,
          source: 'registry-missing' as const,
          manifestValid: true,
          manifestPath: entry.manifestPath,
          installedDirPath: `${USER_DATA_PATHS.installedPlugins}/${entry.pluginIdHint}`,
          validationWarnings: Array.from(
            new Set([
              ...(result.manifest.validationWarnings ?? []),
              'plugin-registry.json 记录缺失。',
            ]),
          ),
        };
      }
      return createDiagnosticPlugin(
        entry.pluginIdHint,
        'orphan-manifest',
        result.manifest
          ? `manifest pluginId 与目录不一致：${result.manifest.pluginId}`
          : result.errors.map((error) => error.message).join(' ') ||
              'manifest.json 损坏。',
        undefined,
        entry.manifestPath,
        result.errors,
      );
    });

  return [
    ...builtIns,
    ...installedPlugins,
    ...orphanPlugins,
  ];
}

export async function savePluginRegistry(plugins: PluginManifest[]) {
  await saveStoredPluginRegistry(getPersistablePluginRegistry(plugins));
}

export function getPersistablePluginRegistry(plugins: PluginManifest[]) {
  return plugins.filter(
    (plugin) =>
      plugin.builtIn ||
      plugin.source === undefined ||
      plugin.source === 'external' ||
      plugin.source === 'manifest-missing' ||
      plugin.source === 'manifest-damaged',
  );
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
  const existingPlugin = plugins.find(
    (plugin) => plugin.pluginId === manifest.pluginId && !plugin.builtIn,
  );
  const nextManifest: PluginManifest = {
    ...manifest,
    builtIn: false,
    enabled: existingPlugin?.enabled ?? manifest.enabled,
    installedAt: new Date().toISOString(),
    source: 'external',
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
  assets: PluginInstallAsset[] = [],
  sourceManifestPath?: string | null,
) {
  if (
    plugins.some(
      (plugin) => plugin.pluginId === manifest.pluginId && plugin.builtIn,
    )
  ) {
    throw new Error(`不能覆盖内置插件：${manifest.pluginId}`);
  }
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

  await installPluginToUserDir(
    installedManifest,
    overwrite,
    assets,
    sourceManifestPath,
  );
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
    super(`导入失败：${errors.map((error) => error.message).join(' ')}`);
    this.name = 'PluginManifestError';
    this.validationErrors = errors;
    this.warnings = warnings;
  }
}

export function parsePluginManifestText(text: string) {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const positionMatch = detail.match(/position\s+(\d+)/i);
    const position = positionMatch ? Number(positionMatch[1]) : text.length;
    const prefix = text.slice(0, position);
    const line = prefix.split('\n').length;
    const lastLineBreak = prefix.lastIndexOf('\n');
    const column = position - lastLineBreak;
    throw new PluginManifestError([
      {
        code: 'invalid-json-object',
        message: `JSON 格式错误。第 ${line} 行第 ${column} 列附近存在语法问题。`,
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
  const pluginPackage = await readLocalPluginPackage();
  return pluginPackage?.manifest ?? null;
}

export type LocalPluginPackage = {
  manifest: PluginManifest;
  manifestSourcePath: string | null;
  scriptEntry?: {
    relativePath: string;
    sourcePath: string | null;
  };
};

function resolveSiblingEntryPath(manifestPath: string | null, entry: string) {
  if (!manifestPath) {
    return null;
  }
  const normalizedPath = manifestPath.replace(/\\/g, '/');
  const lastSlash = normalizedPath.lastIndexOf('/');
  if (lastSlash < 0) {
    return entry;
  }
  return `${normalizedPath.slice(0, lastSlash + 1)}${entry}`;
}

export async function readLocalPluginPackage(): Promise<LocalPluginPackage | null> {
  const opened = await openLocalTextFile({
    accept: '.json,.lmplugin,application/json,application/octet-stream',
    filterName: 'Plugin manifest',
    extensions: ['json', 'lmplugin'],
  });
  if (!opened) {
    return null;
  }

  const manifest = parsePluginManifestText(opened.content);
  const scriptEntry =
    manifest.pluginType === 'script' && manifest.entry
      ? {
          relativePath: manifest.entry,
          sourcePath: resolveSiblingEntryPath(opened.path, manifest.entry),
        }
      : undefined;

  return {
    manifest,
    manifestSourcePath: opened.path,
    scriptEntry,
  };
}

export function getEnabledPlugins(plugins: PluginManifest[]) {
  return plugins.filter(
    (plugin) => plugin.enabled && plugin.manifestValid !== false,
  );
}

export function createPluginOverwritePrompt(
  currentPlugin: PluginManifest,
  incomingPlugin: PluginManifest,
) {
  return (
    `插件已安装：${currentPlugin.name}\n` +
    `当前版本：${currentPlugin.version}\n` +
    `导入版本：${incomingPlugin.version}\n` +
    '是否覆盖安装？'
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
    (plugin) =>
      (plugin.contributions?.exporters ?? []).filter(
        (exporter) => exporter.valid,
      ),
  );
}

export function isTxtExportPluginEnabled(plugins: PluginManifest[]) {
  return getPluginExporters(plugins).some(
    (exporter) => exporter.handler === 'builtin.exportText',
  );
}
