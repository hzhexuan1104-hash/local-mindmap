import {
  parsePluginManifestValue,
  type PluginManifest,
  type PluginType,
} from '../mindmap/plugins';
import {
  getPluginGalleryCatalog,
  type PluginGalleryCatalogData,
  type PluginGalleryCatalogItemData,
} from '../storage/userDataStorage';

export type PluginGalleryRiskLevel = 'low' | 'medium' | 'high';

export type PluginGalleryItem = Omit<
  PluginGalleryCatalogItemData,
  'pluginType' | 'riskLevel' | 'manifest'
> & {
  pluginType: PluginType;
  riskLevel: PluginGalleryRiskLevel;
  manifest: PluginManifest | null;
};

export type PluginGalleryCatalog = Omit<PluginGalleryCatalogData, 'items'> & {
  items: PluginGalleryItem[];
};

export type PluginGalleryInstallState =
  | 'not-installed'
  | 'installed'
  | 'outdated'
  | 'version-different'
  | 'manifest-missing'
  | 'manifest-damaged';

export type PluginGalleryState = {
  state: PluginGalleryInstallState;
  installed: PluginManifest | null;
  enabled: boolean;
  trusted: boolean;
};

export const PLUGIN_GALLERY_CATEGORIES = [
  '导入导出',
  '工作流',
  '脚本',
  '外部命令',
  '主题',
  '节点类型',
  '模板',
] as const;

export const PLUGIN_GALLERY_TYPES: PluginType[] = [
  'import-export',
  'action-workflow',
  'script',
  'external-command',
  'theme-pack',
];

const VALID_PLUGIN_TYPES = new Set<PluginType>([
  'import-export',
  'node-type-pack',
  'template-pack',
  'theme-pack',
  'icon-pack',
  'tool',
  'script',
  'action-workflow',
  'external-command',
]);

function normalizeGalleryItem(
  item: PluginGalleryCatalogItemData,
): PluginGalleryItem {
  const pluginType = VALID_PLUGIN_TYPES.has(item.pluginType as PluginType)
    ? (item.pluginType as PluginType)
    : 'tool';
  const riskLevel = ['low', 'medium', 'high'].includes(item.riskLevel)
    ? (item.riskLevel as PluginGalleryRiskLevel)
    : 'high';
  let manifest: PluginManifest | null = null;
  let error = item.error ?? null;
  let installable = item.installable;

  if (item.manifest) {
    try {
      manifest = parsePluginManifestValue(item.manifest);
    } catch (manifestError) {
      installable = false;
      error =
        manifestError instanceof Error
          ? manifestError.message
          : String(manifestError);
    }
  } else {
    installable = false;
  }

  return {
    ...item,
    pluginType,
    riskLevel,
    manifest,
    installable,
    error,
  };
}

export function normalizePluginGalleryCatalog(
  catalog: PluginGalleryCatalogData,
): PluginGalleryCatalog {
  return {
    version: catalog.version,
    error: catalog.error,
    items: Array.isArray(catalog.items)
      ? catalog.items.map(normalizeGalleryItem)
      : [],
  };
}

export async function loadPluginGalleryCatalog() {
  return normalizePluginGalleryCatalog(await getPluginGalleryCatalog());
}

function parseSemver(version: string) {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
}

export function comparePluginVersions(left: string, right: string) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) {
    return left === right ? 0 : null;
  }
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) {
      return difference < 0 ? -1 : 1;
    }
  }
  return 0;
}

export function getPluginGalleryState(
  item: PluginGalleryItem,
  plugins: PluginManifest[],
): PluginGalleryState {
  const installed =
    plugins.find(
      (plugin) => plugin.pluginId === item.id && plugin.builtIn !== true,
    ) ?? null;
  if (!installed) {
    return {
      state: 'not-installed',
      installed: null,
      enabled: false,
      trusted: false,
    };
  }
  const shared = {
    installed,
    enabled: installed.enabled,
    trusted: Boolean(installed.trusted),
  };
  if (installed.source === 'manifest-missing') {
    return { state: 'manifest-missing', ...shared };
  }
  if (
    installed.source === 'manifest-damaged' ||
    installed.source === 'orphan-manifest'
  ) {
    return { state: 'manifest-damaged', ...shared };
  }
  const comparison = comparePluginVersions(
    installed.version,
    item.manifest?.version ?? '',
  );
  if (comparison === 0) {
    return { state: 'installed', ...shared };
  }
  if (comparison === -1) {
    return { state: 'outdated', ...shared };
  }
  return { state: 'version-different', ...shared };
}

export function getPluginGalleryStateLabel(state: PluginGalleryState) {
  switch (state.state) {
    case 'not-installed':
      return '未安装';
    case 'installed':
      return '已安装';
    case 'outdated':
      return '已安装但版本较旧';
    case 'version-different':
      return '已安装但版本不同';
    case 'manifest-missing':
      return '已安装但 manifest 缺失';
    case 'manifest-damaged':
      return '已安装但 manifest 损坏';
  }
}

export function getPluginGalleryInstallLabel(state: PluginGalleryState) {
  switch (state.state) {
    case 'not-installed':
      return '安装';
    case 'outdated':
    case 'version-different':
      return '更新';
    default:
      return '重新安装';
  }
}

export function filterPluginGalleryItems(
  items: PluginGalleryItem[],
  keyword: string,
  category: string,
  pluginType: string,
) {
  const query = keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (category && item.category !== category) {
      return false;
    }
    if (pluginType && item.pluginType !== pluginType) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      item.title,
      item.description,
      item.id,
      item.pluginType,
      item.runtime ?? '',
      ...item.tags,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

export function getPluginGallerySafetyText(pluginType: PluginType) {
  switch (pluginType) {
    case 'external-command':
      return '高风险实验能力，需要启用外部命令运行器。外部程序会作为本地进程启动，请仅安装可信来源的插件。';
    case 'script':
      return '实验性脚本插件，需要启用脚本运行器。脚本只能返回宿主校验过的 actions。';
    case 'action-workflow':
      return '声明式工作流，不执行代码，只执行宿主校验过的 actions。';
    case 'import-export':
      return '声明式插件，不执行代码。';
    default:
      return '本地内置插件资源，安装前仍会经过 manifest 安全校验。';
  }
}

export function getPluginGalleryInstallWarning(pluginType: PluginType) {
  if (pluginType === 'script') {
    return '这是实验性脚本插件。插件代码将在受控运行器中执行，并只能返回宿主校验过的 actions。请仅安装可信来源的插件。';
  }
  if (pluginType === 'external-command') {
    return '这是外部命令插件。外部程序会作为本地进程启动，虽然导图修改仍需经过宿主 actions 校验，但外部程序在系统层面具有更高风险。请仅安装可信来源的插件。';
  }
  return null;
}
