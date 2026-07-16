import { useEffect, useMemo, useState } from 'react';
import type { PluginCategory, PluginManifest } from './plugins';
import { resolveUserDataPath } from '../storage/userDataStorage';
import {
  exportPluginDiagnosticsReport,
  fixPluginDiagnostics,
  openPluginQuarantineDir,
  openPluginRegistryDir,
  scanPluginDiagnostics,
  type PluginDiagnosticCategory,
  type PluginDiagnosticItem,
  type PluginDiagnosticFixResult,
  type PluginDiagnosticReport,
  type PluginDiagnosticSeverity,
} from '../storage/userDataStorage';
import type { PluginLogEntry } from '../plugins/pluginLogs';
import {
  filterPluginGalleryItems,
  getPluginGalleryInstallLabel,
  getPluginGallerySafetyText,
  getPluginGalleryState,
  getPluginGalleryStateLabel,
  loadPluginGalleryCatalog,
  PLUGIN_GALLERY_CATEGORIES,
  PLUGIN_GALLERY_TYPES,
  type PluginGalleryCatalog,
  type PluginGalleryItem,
} from '../plugins/pluginGallery';
import {
  getWorkflowActionTypes,
  workflowHasWriteActions,
} from '../plugins/pluginWorkflow';
import { PluginDevWorkbench } from '../plugins/PluginDevWorkbenchPanel';
import type {
  DevPluginPackageResult,
  DevPluginProjectRequest,
  DevPluginProjectResult,
  DevPluginValidationResult,
} from '../plugins/pluginDevWorkbench';

type PluginRunInfo = {
  status:
    | 'success'
    | 'failed'
    | 'validation_failed'
    | 'timeout'
    | 'runner_disabled';
  message: string;
  lastRunAt: string;
  actionCount?: number;
  appliedActionCount?: number;
  durationMs?: number;
  error?: string;
  exitCode?: number | null;
  stdoutSize?: number;
  stderrPreview?: string;
};

type PluginManagerPanelProps = {
  plugins: PluginManifest[];
  lastInstallError: string;
  userDataDir: string;
  isDesktopApp: boolean;
  onClose: () => void;
  onInstall: () => void;
  initialGalleryCatalog?: PluginGalleryCatalog | null;
  onInstallGallery?: (item: PluginGalleryItem) => void;
  onOpenGalleryPluginDir?: (catalogId: string) => void;
  onOpenPluginDevelopmentDocs?: () => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
  onCopyUserDataDir: () => void;
  onOpenUserDataDir: () => void;
  onOpenPluginDir: () => void;
  onOpenPluginDevDir: () => void;
  onCreateDevProject?: (
    request: DevPluginProjectRequest,
  ) => Promise<DevPluginProjectResult | null>;
  onValidateDevProject?: (
    pluginId: string,
  ) => Promise<DevPluginValidationResult | null>;
  onBuildDevPackage?: (
    pluginId: string,
  ) => Promise<DevPluginPackageResult | null>;
  onOpenDevProjectDir?: (pluginId: string) => void;
  onOpenPluginExamplesDir?: () => void;
  onImportDevPackage?: () => void;
  recentDevProject?: DevPluginProjectResult | null;
  recentDevValidation?: DevPluginValidationResult | null;
  recentDevPackage?: DevPluginPackageResult | null;
  onCreateSamplePlugin: () => void;
  onCreateSampleScriptPlugin?: () => void;
  onCreateSampleBatchScriptPlugin?: () => void;
  onCreateSampleWorkflowPlugin?: () => void;
  onCreateSamplePythonPlugin?: () => void;
  onOpenSampleScriptPluginDir?: () => void;
  isScriptRunnerEnabled?: boolean;
  onScriptRunnerEnabledChange?: (enabled: boolean) => void;
  scriptRunResults?: Record<string, PluginRunInfo>;
  workflowRunResults?: Record<string, PluginRunInfo>;
  isExternalRunnerEnabled?: boolean;
  onExternalRunnerEnabledChange?: (enabled: boolean) => void;
  pythonPath?: string;
  pythonRuntimeLabel?: string;
  onSavePythonPath?: (pythonPath: string) => void;
  onTestPython?: (pythonPath: string) => void;
  externalRunResults?: Record<string, PluginRunInfo>;
  onSetPluginTrusted?: (pluginId: string, trusted: boolean) => void;
  onCopyPluginId: (pluginId: string) => void;
  onExportPackage?: (pluginId: string) => void;
  lastPluginExport?: { pluginId: string; path: string } | null;
  onCopyExportPath?: (path: string) => void;
  onOpenExportLocation?: (path: string) => void;
  onCopyPath: (relativePath: string, label: string) => void;
  onOpenManifestDir: (pluginId: string) => void;
  onReload: () => void;
  onRepairRegistry: (pluginId: string) => void;
  onCleanRecord: (pluginId: string) => void;
  onDiagnosticFixResults?: (results: PluginDiagnosticFixResult[]) => void;
  logs: PluginLogEntry[];
  onClearLogs: () => void;
};

const CATEGORY_OPTIONS: Array<{ value: '' | PluginCategory; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'import-export', label: '文件导入 / 导出' },
  { value: 'theme', label: '主题包' },
  { value: 'icon-pack', label: '图标包' },
  { value: 'node-type', label: '节点类型包' },
  { value: 'template', label: '模板包' },
  { value: 'tool', label: '工具' },
];

const DIAGNOSTIC_SEVERITY_OPTIONS: Array<{
  value: '' | PluginDiagnosticSeverity;
  label: string;
}> = [
  { value: '', label: '全部 severity' },
  { value: 'critical', label: 'critical' },
  { value: 'error', label: 'error' },
  { value: 'warning', label: 'warning' },
  { value: 'info', label: 'info' },
];

const DIAGNOSTIC_CATEGORY_OPTIONS: Array<{
  value: '' | PluginDiagnosticCategory;
  label: string;
}> = [
  { value: '', label: '全部 category' },
  { value: 'registry', label: 'registry' },
  { value: 'installed', label: 'installed' },
  { value: 'manifest', label: 'manifest' },
  { value: 'entry', label: 'entry' },
  { value: 'security', label: 'security' },
  { value: 'dev', label: 'dev' },
  { value: 'gallery', label: 'gallery' },
  { value: 'package', label: 'package' },
  { value: 'runtime', label: 'runtime' },
];

function filterDiagnosticItems(
  items: PluginDiagnosticItem[],
  severity: '' | PluginDiagnosticSeverity,
  category: '' | PluginDiagnosticCategory,
  keyword: string,
) {
  const query = keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (severity && item.severity !== severity) return false;
    if (category && item.category !== category) return false;
    if (!query) return true;
    return [
      item.pluginId ?? '',
      item.title,
      item.message,
      item.path ?? '',
      item.fixAction ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function diagnosticFixActions(report: PluginDiagnosticReport | null) {
  return Array.from(
    new Set(
      (report?.items ?? [])
        .filter((item) => item.fixable && item.fixAction)
        .map((item) => item.fixAction as string),
    ),
  );
}

const PLUGIN_TYPE_LABELS: Record<string, string> = {
  'import-export': '导入导出',
  'node-type-pack': '节点类型',
  'template-pack': '模板',
  'theme-pack': '主题',
  'icon-pack': '图标',
  tool: '工具',
  script: '脚本',
  'action-workflow': '工作流',
  'external-command': '外部命令',
  native: '原生',
};

function pluginTypeLabel(pluginType: string) {
  return PLUGIN_TYPE_LABELS[pluginType] ?? pluginType;
}

function getRiskPillClassName(riskLevel: string) {
  return [
    'risk-pill',
    riskLevel === 'critical'
      ? 'risk-critical'
      : riskLevel === 'high'
        ? 'risk-high'
        : riskLevel === 'medium'
          ? 'risk-medium'
          : 'risk-low',
  ].join(' ');
}

function getPluginRiskLevel(plugin: PluginManifest) {
  if (plugin.manifestValid === false) return 'high';
  if (plugin.pluginType === 'external-command') return 'critical';
  if (plugin.pluginType === 'script') return 'high';
  if (plugin.pluginType === 'action-workflow') return 'medium';
  return 'low';
}

function getPluginUserStatus(plugin: PluginManifest) {
  if (plugin.source === 'manifest-missing') {
    return '安装异常：manifest 缺失';
  }
  if (plugin.source === 'manifest-damaged') {
    return '安装异常：插件损坏';
  }
  if (
    plugin.source === 'registry-missing' ||
    plugin.source === 'orphan-manifest'
  ) {
    return '安装异常：注册记录异常';
  }
  if (plugin.manifestValid === false) {
    return '安装异常：manifest 无效';
  }
  return plugin.enabled ? '已启用' : '已禁用';
}

function getGalleryUserStatus(state: ReturnType<typeof getPluginGalleryState>) {
  if (state.installed?.source === 'manifest-missing') {
    return '安装异常：manifest 缺失';
  }
  if (state.installed?.source === 'manifest-damaged') {
    return '安装异常：插件损坏';
  }
  if (
    state.installed?.source === 'registry-missing' ||
    state.installed?.source === 'orphan-manifest'
  ) {
    return '安装异常：注册记录异常';
  }
  if (state.state === 'manifest-missing') {
    return '安装异常：manifest 缺失';
  }
  if (state.state === 'manifest-damaged') {
    return '安装异常：插件损坏';
  }
  return getPluginGalleryStateLabel(state);
}

function isPluginAbnormal(plugin: PluginManifest) {
  return (
    plugin.manifestValid === false ||
    plugin.source === 'manifest-missing' ||
    plugin.source === 'manifest-damaged' ||
    plugin.source === 'registry-missing' ||
    plugin.source === 'orphan-manifest'
  );
}

function isGalleryStateAbnormal(state: ReturnType<typeof getPluginGalleryState>) {
  return (
    Boolean(state.installed) &&
    (state.state === 'manifest-missing' ||
      state.state === 'manifest-damaged' ||
      state.installed?.source === 'registry-missing' ||
      state.installed?.source === 'orphan-manifest')
  );
}

function countContributions(plugin: PluginManifest) {
  if (!plugin.contributions) {
    return 0;
  }

  return Object.values(plugin.contributions).reduce(
    (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
    0,
  );
}

function contributionSummary(plugin: PluginManifest) {
  const contributions = plugin.contributions;
  return {
    themes: contributions?.themes?.length ?? 0,
    icons: contributions?.icons?.length ?? 0,
    exporters: contributions?.exporters?.length ?? 0,
    nodeTypes:
      (contributions?.nodeTypes?.length ?? 0) +
      (contributions?.nodeTypePacks?.reduce(
        (sum, pack) => sum + pack.nodeTypes.length,
        0,
      ) ?? 0),
    templates:
      contributions?.templatePacks?.reduce(
        (sum, pack) => sum + pack.templates.length,
        0,
      ) ?? 0,
    menus: contributions?.menus?.length ?? 0,
    tools: contributions?.tools?.length ?? 0,
  };
}

const SOURCE_LABELS: Record<
  NonNullable<PluginManifest['source']>,
  string
> = {
  'built-in': '内置',
  external: '外部安装',
  'orphan-manifest': '安装异常：注册记录异常',
  'registry-missing': '安装异常：注册记录异常',
  'manifest-missing': '安装异常：manifest 缺失',
  'manifest-damaged': '安装异常：插件损坏',
};

function countTemplateNodes(node: {
  children?: Array<{ children?: unknown[] }>;
}): number {
  return (
    1 +
    (node.children ?? []).reduce(
      (sum, child) =>
        sum +
        countTemplateNodes(
          child as { children?: Array<{ children?: unknown[] }> },
        ),
      0,
    )
  );
}

function ContributionDetails({ plugin }: { plugin: PluginManifest }) {
  const contributions = plugin.contributions;
  const nodeTypes = [
    ...(contributions?.nodeTypes ?? []),
    ...(contributions?.nodeTypePacks ?? []).flatMap((pack) => pack.nodeTypes),
  ];
  const templates = (contributions?.templatePacks ?? []).flatMap(
    (pack) => pack.templates,
  );
  const hasContributions = Object.values(contributionSummary(plugin)).some(
    (count) => count > 0,
  );

  if (!hasContributions) {
    return <p className="empty-note">暂无贡献点</p>;
  }

  return (
    <div className="plugin-contribution-details">
      {(contributions?.menus ?? []).map((menu) => (
        <dl
          className={menu.valid ? undefined : 'is-invalid'}
          key={`menu-${menu.id}`}
        >
          <strong>menu · {menu.id}</strong>
          <div><dt>label</dt><dd>{menu.label}</dd></div>
          <div><dt>location</dt><dd>{menu.location}</dd></div>
          <div><dt>command</dt><dd>{menu.command}</dd></div>
          <div><dt>when</dt><dd>{menu.when}</dd></div>
          <div><dt>valid</dt><dd>{String(menu.valid)}</dd></div>
          {!menu.valid ? <div><dt>invalidReason</dt><dd>{menu.invalidReason}</dd></div> : null}
        </dl>
      ))}
      {(contributions?.exporters ?? []).map((exporter) => (
        <dl
          className={exporter.valid ? undefined : 'is-invalid'}
          key={`exporter-${exporter.id}`}
        >
          <strong>exporter · {exporter.id}</strong>
          <div><dt>label</dt><dd>{exporter.label}</dd></div>
          <div><dt>handler</dt><dd>{exporter.handler}</dd></div>
          <div><dt>fileName</dt><dd>{exporter.fileName ?? '未声明'}</dd></div>
          <div><dt>valid</dt><dd>{String(exporter.valid)}</dd></div>
          {!exporter.valid ? <div><dt>invalidReason</dt><dd>{exporter.invalidReason}</dd></div> : null}
        </dl>
      ))}
      {(contributions?.themes ?? []).map((theme) => (
        <dl key={`theme-${theme.id}`}>
          <strong>theme · {theme.id}</strong>
          <div><dt>name</dt><dd>{theme.name}</dd></div>
          <div><dt>nodeBackground</dt><dd>{theme.nodeBackground}</dd></div>
          <div><dt>nodeBorder</dt><dd>{theme.nodeBorder}</dd></div>
          <div><dt>nodeText</dt><dd>{theme.nodeText}</dd></div>
          <div><dt>lineColor</dt><dd>{theme.lineColor}</dd></div>
          <div><dt>canvasBackground</dt><dd>{theme.canvasBackground}</dd></div>
        </dl>
      ))}
      {(contributions?.icons ?? []).map((icon, index) => (
        <dl key={`icon-${icon.value}-${index}`}>
          <strong>icon · {icon.label}</strong>
          <div><dt>label</dt><dd>{icon.label}</dd></div>
          <div><dt>value</dt><dd>{icon.value}</dd></div>
        </dl>
      ))}
      {nodeTypes.map((nodeType) => (
        <dl key={`node-type-${nodeType.id}`}>
          <strong>nodeType · {nodeType.id}</strong>
          <div><dt>name</dt><dd>{nodeType.name}</dd></div>
          <div><dt>icon</dt><dd>{nodeType.icon}</dd></div>
          <div><dt>shape</dt><dd>{nodeType.shape}</dd></div>
          <div><dt>defaultText</dt><dd>{nodeType.defaultText}</dd></div>
        </dl>
      ))}
      {templates.map((template) => (
        <dl key={`template-${template.id}`}>
          <strong>template · {template.id}</strong>
          <div><dt>name</dt><dd>{template.name}</dd></div>
          <div><dt>category</dt><dd>{template.category}</dd></div>
          <div><dt>node count</dt><dd>{countTemplateNodes(template.rootNode)}</dd></div>
        </dl>
      ))}
      {(contributions?.tools ?? []).map((tool) => (
        <dl
          className={tool.valid ? undefined : 'is-invalid'}
          key={`tool-${tool.toolId}`}
        >
          <strong>tool · {tool.toolId}</strong>
          <div><dt>label</dt><dd>{tool.label}</dd></div>
          <div><dt>command / handler</dt><dd>{tool.command ?? tool.handler ?? '未声明'}</dd></div>
          <div><dt>valid</dt><dd>{String(tool.valid)}</dd></div>
          {!tool.valid ? <div><dt>invalidReason</dt><dd>{tool.invalidReason}</dd></div> : null}
        </dl>
      ))}
    </div>
  );
}

export function PluginManagerPanel({
  plugins,
  lastInstallError,
  userDataDir,
  isDesktopApp,
  onClose,
  onInstall,
  initialGalleryCatalog,
  onInstallGallery,
  onOpenGalleryPluginDir,
  onOpenPluginDevelopmentDocs,
  onToggle,
  onUninstall,
  onCopyUserDataDir,
  onOpenUserDataDir,
  onOpenPluginDir,
  onOpenPluginDevDir,
  onCreateDevProject,
  onValidateDevProject,
  onBuildDevPackage,
  onOpenDevProjectDir,
  onOpenPluginExamplesDir,
  onImportDevPackage,
  recentDevProject = null,
  recentDevValidation = null,
  recentDevPackage = null,
  onCreateSamplePlugin,
  onCreateSampleScriptPlugin,
  onCreateSampleBatchScriptPlugin,
  onCreateSampleWorkflowPlugin,
  onCreateSamplePythonPlugin,
  onOpenSampleScriptPluginDir,
  isScriptRunnerEnabled = false,
  onScriptRunnerEnabledChange,
  scriptRunResults = {},
  workflowRunResults = {},
  isExternalRunnerEnabled = false,
  onExternalRunnerEnabledChange,
  pythonPath = 'auto',
  pythonRuntimeLabel,
  onSavePythonPath,
  onTestPython,
  externalRunResults = {},
  onSetPluginTrusted,
  onCopyPluginId,
  onExportPackage,
  lastPluginExport,
  onCopyExportPath,
  onOpenExportLocation,
  onCopyPath,
  onOpenManifestDir,
  onReload,
  onRepairRegistry,
  onCleanRecord,
  onDiagnosticFixResults,
  logs,
  onClearLogs,
}: PluginManagerPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'' | PluginCategory>('');
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [showPluginLogs, setShowPluginLogs] = useState(false);
  const [pythonPathDraft, setPythonPathDraft] = useState(pythonPath);
  const [galleryCatalog, setGalleryCatalog] =
    useState<PluginGalleryCatalog | null>(initialGalleryCatalog ?? null);
  const [galleryLoading, setGalleryLoading] = useState(
    initialGalleryCatalog === undefined,
  );
  const [galleryKeyword, setGalleryKeyword] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('');
  const [galleryType, setGalleryType] = useState('');
  const [diagnosticReport, setDiagnosticReport] =
    useState<PluginDiagnosticReport | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState('');
  const [diagnosticSeverity, setDiagnosticSeverity] =
    useState<'' | PluginDiagnosticSeverity>('');
  const [diagnosticCategory, setDiagnosticCategory] =
    useState<'' | PluginDiagnosticCategory>('');
  const [diagnosticKeyword, setDiagnosticKeyword] = useState('');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (showPluginLogs) {
        setShowPluginLogs(false);
        return;
      }
      if (showApiDocs) {
        setShowApiDocs(false);
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onClose, showApiDocs, showPluginLogs]);

  const refreshGallery = async () => {
    setGalleryLoading(true);
    try {
      setGalleryCatalog(await loadPluginGalleryCatalog());
    } finally {
      setGalleryLoading(false);
    }
  };

  const runDiagnostics = async (scope = 'all') => {
    if (!isDesktopApp) {
      setDiagnosticError('插件诊断中心仅在桌面端可用。');
      return;
    }
    setDiagnosticLoading(true);
    setDiagnosticError('');
    try {
      setDiagnosticReport(await scanPluginDiagnostics(scope));
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const runDiagnosticFix = async (actions: string[]) => {
    if (!isDesktopApp || actions.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      `将修复 ${actions.length} 个可修复诊断项。修复前会创建备份，critical 危险项不会自动修复。是否继续？`,
    );
    if (!confirmed) {
      return;
    }
    setDiagnosticLoading(true);
    setDiagnosticError('');
    try {
      const report = await fixPluginDiagnostics(actions);
      setDiagnosticReport(report);
      onDiagnosticFixResults?.(report.fixResults);
      onReload();
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const exportDiagnostics = async (format: 'json' | 'markdown') => {
    if (!diagnosticReport) {
      setDiagnosticError('请先扫描再导出诊断报告。');
      return;
    }
    setDiagnosticLoading(true);
    setDiagnosticError('');
    try {
      const path = await exportPluginDiagnosticsReport(diagnosticReport, format);
      setDiagnosticError(`诊断报告已导出：${path}`);
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosticLoading(false);
    }
  };

  useEffect(() => {
    if (initialGalleryCatalog !== undefined) {
      setGalleryCatalog(initialGalleryCatalog);
      setGalleryLoading(false);
      return;
    }
    void refreshGallery();
  }, [initialGalleryCatalog]);

  const visiblePlugins = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return plugins.filter((plugin) => {
      const matchesCategory = category ? plugin.category === category : true;
      const searchableText = [
        plugin.name,
        plugin.version,
        plugin.author,
        plugin.pluginType,
        plugin.description,
      ]
        .join(' ')
        .toLowerCase();
      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [category, keyword, plugins]);
  const visibleGalleryItems = useMemo(
    () =>
      filterPluginGalleryItems(
        galleryCatalog?.items ?? [],
        galleryKeyword,
        galleryCategory,
        galleryType,
      ),
    [galleryCatalog, galleryCategory, galleryKeyword, galleryType],
  );
  const visibleDiagnosticItems = useMemo(
    () =>
      filterDiagnosticItems(
        diagnosticReport?.items ?? [],
        diagnosticSeverity,
        diagnosticCategory,
        diagnosticKeyword,
      ),
    [
      diagnosticReport?.items,
      diagnosticCategory,
      diagnosticKeyword,
      diagnosticSeverity,
    ],
  );
  const allDiagnosticFixActions = useMemo(
    () => diagnosticFixActions(diagnosticReport),
    [diagnosticReport],
  );

  return (
    <div className="plugin-manager-backdrop" role="presentation">
      <section
        className="plugin-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plugin-manager-title"
      >
        <header className="plugin-manager-header">
          <div>
            <p className="eyebrow">Plugins</p>
            <h2 id="plugin-manager-title">插件管理</h2>
          </div>
          <div className="plugin-manager-actions">
            <button type="button" className="secondary-action" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <div className="plugin-manager-content">
          <section className="plugin-manager-section">
            <div className="plugin-section-heading">
              <div>
                <h3>用户数据目录</h3>
                <p>
                  {isDesktopApp
                    ? '插件、模板和节点类型存放在桌面端用户目录。'
                    : 'Web 端使用浏览器 localStorage fallback。'}
                </p>
              </div>
              <div className="plugin-manager-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCopyUserDataDir}
                >
                  复制路径
                </button>
                {isDesktopApp ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={onOpenUserDataDir}
                  >
                    打开目录
                  </button>
                ) : null}
              </div>
            </div>
            <p className="plugin-dir-note" title={userDataDir}>
              {userDataDir}
            </p>
          </section>

          <details className="plugin-manager-section plugin-developer-section">
            <summary>
              <span>
                <strong>开发者模式</strong>
                <small>插件开发者工作台与本地运行器设置</small>
              </span>
            </summary>
            <div className="plugin-developer-content">
              <p>
                当前版本支持声明式、JSON Action Workflow、受控 script 和
                external-command 插件；工作台覆盖模板创建、校验、打包与本地导入验证。
              </p>
              <p className="plugin-safety-note">
                仅在显式启用后通过 Web Worker 执行本地脚本插件。脚本只接收
                JSON context snapshot，只能返回由宿主校验的 actions。
              </p>
              <PluginDevWorkbench
                isDesktopApp={isDesktopApp}
                devRootPath={resolveUserDataPath(userDataDir, 'plugins/dev')}
                recentProject={recentDevProject}
                recentValidation={recentDevValidation}
                recentPackage={recentDevPackage}
                onCreateProject={
                  onCreateDevProject ?? (async () => null)
                }
                onValidateProject={
                  onValidateDevProject ?? (async () => null)
                }
                onBuildPackage={
                  onBuildDevPackage ?? (async () => null)
                }
                onImportPackage={onImportDevPackage ?? onInstall}
                onOpenDevDir={onOpenPluginDevDir}
                onOpenProjectDir={onOpenDevProjectDir ?? (() => undefined)}
                onOpenExamplesDir={
                  onOpenPluginExamplesDir ?? (() => undefined)
                }
                onOpenDocs={
                  onOpenPluginDevelopmentDocs ?? (() => undefined)
                }
                onCopyPath={onCopyPath}
                onOpenPackageLocation={
                  onOpenExportLocation ?? (() => undefined)
                }
              />
              <section className="plugin-diagnostics-center">
                <div className="plugin-section-heading">
                  <div>
                    <h3>插件诊断中心</h3>
                    <p>本地扫描 registry、installed、dev、gallery 和 .lmplugin 能力；不联网、不上传报告、不执行插件代码。</p>
                  </div>
                  <div className="plugin-manager-actions">
                    <button type="button" onClick={() => void runDiagnostics('all')} disabled={diagnosticLoading || !isDesktopApp}>
                      一键扫描插件
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => void runDiagnosticFix(allDiagnosticFixActions)}
                      disabled={diagnosticLoading || allDiagnosticFixActions.length === 0 || !isDesktopApp}
                    >
                      一键修复可修复问题
                    </button>
                  </div>
                </div>
                <div className="plugin-manager-actions plugin-diagnostics-actions">
                  <button type="button" className="secondary-action" onClick={() => void runDiagnostics('installed')} disabled={diagnosticLoading || !isDesktopApp}>扫描已安装插件</button>
                  <button type="button" className="secondary-action" onClick={() => void runDiagnostics('registry')} disabled={diagnosticLoading || !isDesktopApp}>扫描 registry</button>
                  <button type="button" className="secondary-action" onClick={() => void runDiagnostics('dev')} disabled={diagnosticLoading || !isDesktopApp}>扫描开发项目</button>
                  <button type="button" className="secondary-action" onClick={() => void runDiagnostics('gallery')} disabled={diagnosticLoading || !isDesktopApp}>扫描本地插件中心</button>
                  <button type="button" className="secondary-action" onClick={() => void runDiagnostics('all')} disabled={diagnosticLoading || !isDesktopApp}>查看诊断报告</button>
                  <button type="button" className="secondary-action" onClick={() => void exportDiagnostics('json')} disabled={!diagnosticReport || diagnosticLoading}>导出 JSON 报告</button>
                  <button type="button" className="secondary-action" onClick={() => void exportDiagnostics('markdown')} disabled={!diagnosticReport || diagnosticLoading}>导出 Markdown 报告</button>
                  <button type="button" className="secondary-action" onClick={() => void runDiagnosticFix(allDiagnosticFixActions)} disabled={diagnosticLoading || allDiagnosticFixActions.length === 0 || !isDesktopApp}>清理异常记录</button>
                  <button type="button" className="secondary-action" onClick={onOpenPluginDir} disabled={!isDesktopApp}>打开插件目录</button>
                  <button type="button" className="secondary-action" onClick={() => void openPluginRegistryDir()} disabled={!isDesktopApp}>打开 registry 文件所在目录</button>
                  <button type="button" className="secondary-action" onClick={() => void openPluginQuarantineDir()} disabled={!isDesktopApp}>打开隔离目录</button>
                </div>
                {diagnosticError ? (
                  <div className="plugin-install-error" role="alert">
                    <strong>诊断中心消息</strong>
                    <p>{diagnosticError}</p>
                  </div>
                ) : null}
                {diagnosticReport ? (
                  <>
                    <div className="plugin-diagnostics-summary">
                      <span>scanId: {diagnosticReport.scanId}</span>
                      <span>最近扫描时间: {new Date(diagnosticReport.scannedAt).toLocaleString()}</span>
                      <span>总插件数: {diagnosticReport.counts.totalPlugins}</span>
                      <span>installed 插件数: {diagnosticReport.counts.installedPlugins}</span>
                      <span>registry 记录数: {diagnosticReport.counts.registryRecords}</span>
                      <span>dev 项目数: {diagnosticReport.counts.devProjects}</span>
                      <span>gallery 示例数: {diagnosticReport.counts.galleryExamples}</span>
                      <span>critical: {diagnosticReport.summary.critical}</span>
                      <span>error: {diagnosticReport.summary.error}</span>
                      <span>warning: {diagnosticReport.summary.warning}</span>
                      <span>info: {diagnosticReport.summary.info}</span>
                      <span>passed: {diagnosticReport.summary.passed}</span>
                      <span>fixable: {diagnosticReport.summary.fixable}</span>
                    </div>
                    <div className="plugin-manager-filters plugin-diagnostics-filters">
                      <select
                        value={diagnosticSeverity}
                        onChange={(event) => setDiagnosticSeverity(event.target.value as '' | PluginDiagnosticSeverity)}
                      >
                        {DIAGNOSTIC_SEVERITY_OPTIONS.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={diagnosticCategory}
                        onChange={(event) => setDiagnosticCategory(event.target.value as '' | PluginDiagnosticCategory)}
                      >
                        {DIAGNOSTIC_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        type="search"
                        value={diagnosticKeyword}
                        placeholder="搜索 pluginId / title / message"
                        onChange={(event) => setDiagnosticKeyword(event.target.value)}
                      />
                    </div>
                    {visibleDiagnosticItems.length === 0 ? (
                      <p className="empty-note">插件生态健康</p>
                    ) : (
                      <div className="plugin-diagnostics-list">
                        {visibleDiagnosticItems.map((item) => (
                          <article className={`plugin-diagnostic-item diagnostic-${item.severity}`} key={item.id}>
                            <div className="plugin-item-title">
                              <strong>{item.title}</strong>
                              <span>{item.severity}</span>
                              <span>{item.category}</span>
                              <span>{item.status}</span>
                              {item.fixable ? <span>fixable</span> : null}
                            </div>
                            <p>{item.message}</p>
                            <dl className="plugin-meta">
                              <div><dt>pluginId</dt><dd>{item.pluginId ?? '-'}</dd></div>
                              <div><dt>path</dt><dd>{item.path ?? '-'}</dd></div>
                              <div><dt>fixAction</dt><dd>{item.fixAction ?? '-'}</dd></div>
                            </dl>
                            {item.fixable && item.fixAction ? (
                              <div className="plugin-item-actions">
                                <button type="button" className="secondary-action" onClick={() => void runDiagnosticFix([item.fixAction as string])} disabled={diagnosticLoading}>
                                  修复
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                    {diagnosticReport.fixResults.length > 0 ? (
                      <div className="plugin-log-panel">
                        <strong>修复结果</strong>
                        <ol className="plugin-log-list">
                          {diagnosticReport.fixResults.map((result) => (
                            <li className={result.status === 'fixed' ? 'is-info' : 'is-error'} key={`${result.action}-${result.message}`}>
                              <code>{result.action}</code>
                              {result.pluginId ? <code>{result.pluginId}</code> : null}
                              <p>{result.status}: {result.message}</p>
                              {result.backupPath ? <p>backup: {result.backupPath}</p> : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="empty-note">尚未生成诊断报告。点击“一键扫描插件”开始。</p>
                )}
              </section>
              <label className="stacked-control">
                <span>启用实验性脚本插件运行器</span>
                <input
                  type="checkbox"
                  checked={isScriptRunnerEnabled}
                  onChange={(event) =>
                    onScriptRunnerEnabledChange?.(event.target.checked)
                  }
                />
              </label>
              <p className="plugin-safety-note">
                脚本插件是实验能力，默认关闭。脚本只能返回 actions，由宿主校验后执行；本批不支持 Shell、DLL、文件系统或网络访问。
              </p>
              <label className="stacked-control">
                <span>启用外部命令插件运行器</span>
                <input
                  type="checkbox"
                  checked={isExternalRunnerEnabled}
                  onChange={(event) =>
                    onExternalRunnerEnabledChange?.(event.target.checked)
                  }
                />
              </label>
              <p className="plugin-safety-note">
                外部命令插件是高风险实验功能，默认关闭。宿主不使用 Shell，
                仅以固定参数启动 Python 或直接启动本地可执行文件；外部进程在
                操作系统层面仍可能访问本机资源，请只运行可信插件。
              </p>
              <label className="stacked-control">
                <span>Python 运行时路径</span>
                <input
                  type="text"
                  value={pythonPathDraft}
                  placeholder="auto（自动检测）或受控 Python 路径"
                  onChange={(event) => setPythonPathDraft(event.target.value)}
                />
              </label>
              <div className="plugin-manager-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => onSavePythonPath?.(pythonPathDraft)}
                >
                  保存 Python 路径
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => onTestPython?.(pythonPathDraft)}
                >
                  测试 Python
                </button>
              </div>
              {pythonRuntimeLabel ? (
                <p className="plugin-safety-note">已检测解释器：{pythonRuntimeLabel}</p>
              ) : null}
              {!isDesktopApp ? (
                <p className="plugin-web-warning">
                  不支持在 Web 端打开本地目录。
                </p>
              ) : null}
              <div className="plugin-manager-actions plugin-developer-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onOpenPluginDir}
                >
                  打开插件目录
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onOpenPluginDevDir}
                >
                  打开插件开发目录
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCreateSamplePlugin}
                >
                  创建示例插件
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCreateSampleScriptPlugin}
                  disabled={!onCreateSampleScriptPlugin}
                >
                  创建脚本插件示例
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCreateSampleBatchScriptPlugin}
                >
                  创建批量脚本插件示例
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCreateSampleWorkflowPlugin}
                  disabled={!onCreateSampleWorkflowPlugin}
                >
                  创建 JSON Action 工作流示例
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCreateSamplePythonPlugin}
                  disabled={!onCreateSamplePythonPlugin}
                >
                  创建 Python 插件示例
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onOpenSampleScriptPluginDir}
                  disabled={!onOpenSampleScriptPluginDir}
                >
                  打开脚本插件示例目录
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onReload}
                >
                  重新加载插件
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowApiDocs((visible) => !visible)}
                >
                  查看插件 API 文档
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowPluginLogs((visible) => !visible)}
                >
                  查看插件日志
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onCopyUserDataDir}
                >
                  复制用户数据目录路径
                </button>
              </div>

              {showApiDocs ? (
                <div className="plugin-api-summary">
                  <strong>插件 API 文档</strong>
                  <p>
                    完整文档：<code>docs/plugin-development.md</code>
                  </p>
                  <p>
                    Script 与 JSON Action workflow 共用受控 Action Protocol；
                    workflow 只解析占位符并执行宿主校验后的 actions，不执行代码。
                  </p>
                </div>
              ) : null}

              {showPluginLogs ? (
                <div className="plugin-log-panel">
                  <div className="plugin-log-heading">
                    <strong>最近插件日志</strong>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={onClearLogs}
                    >
                      清空日志
                    </button>
                  </div>
                  {logs.length === 0 ? (
                    <p className="empty-note">暂无插件日志</p>
                  ) : (
                    <ol className="plugin-log-list">
                      {logs.map((log) => (
                        <li className={`is-${log.level}`} key={log.id}>
                          <time>{new Date(log.timestamp).toLocaleString()}</time>
                          <span>{log.level}</span>
                          {log.pluginId ? <code>{log.pluginId}</code> : null}
                          <code>{log.event}</code>
                          {log.menuId ? <code>menuId={log.menuId}</code> : null}
                          {log.actionCount !== undefined ? (
                            <code>actionCount={log.actionCount}</code>
                          ) : null}
                          {log.durationMs !== undefined ? (
                            <code>durationMs={log.durationMs}</code>
                          ) : null}
                          <p>{log.message}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}
            </div>
          </details>

          <section className="plugin-manager-section plugin-gallery-section">
            <div className="plugin-section-heading">
              <div>
                <h3>本地插件中心</h3>
                <p>
                  官方示例均随应用内置；此区域不联网、不下载远程插件，也不会在安装时执行插件代码。
                </p>
              </div>
              <div className="plugin-manager-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void refreshGallery()}
                >
                  刷新示例库
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onOpenPluginDevelopmentDocs}
                  disabled={!onOpenPluginDevelopmentDocs}
                >
                  打开插件开发文档
                </button>
              </div>
            </div>

            <div className="plugin-manager-filters plugin-gallery-filters">
              <input
                type="search"
                aria-label="搜索本地插件中心"
                value={galleryKeyword}
                placeholder="搜索标题、描述、标签、pluginId"
                onChange={(event) => setGalleryKeyword(event.target.value)}
              />
              <select
                aria-label="本地插件中心分类"
                value={galleryCategory}
                onChange={(event) => setGalleryCategory(event.target.value)}
              >
                <option value="">全部</option>
                {PLUGIN_GALLERY_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                aria-label="本地插件中心类型"
                value={galleryType}
                onChange={(event) => setGalleryType(event.target.value)}
              >
                <option value="">全部类型</option>
                {PLUGIN_GALLERY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {galleryLoading ? (
              <p className="empty-note">正在读取本地示例库…</p>
            ) : null}
            {galleryCatalog?.error ? (
              <div className="plugin-install-error" role="alert">
                <strong>本地插件中心不可用</strong>
                <p>{galleryCatalog.error}</p>
                <p>已安装插件列表不受影响。</p>
              </div>
            ) : null}
            {!galleryLoading &&
            !galleryCatalog?.error &&
            visibleGalleryItems.length === 0 ? (
              <p className="empty-note">没有匹配的官方示例插件</p>
            ) : null}

            <div className="plugin-gallery-grid">
              {visibleGalleryItems.map((item) => {
                const state = getPluginGalleryState(item, plugins);
                const manifest = item.manifest;
                const summary = manifest
                  ? contributionSummary(manifest)
                  : null;
                const statusText = getGalleryUserStatus(state);
                const abnormalState = isGalleryStateAbnormal(state);
                const installedPlugin = state.installed;
                return (
                  <article
                    className={`plugin-gallery-card gallery-risk-${item.riskLevel}`}
                    key={item.id}
                  >
                    <div className="plugin-item-title">
                      <strong>{item.title}</strong>
                      {item.recommended ? <span>推荐</span> : null}
                      <span className="plugin-type-pill">
                        {pluginTypeLabel(item.pluginType)}
                      </span>
                      <span className={getRiskPillClassName(item.riskLevel)}>
                        风险：{item.riskLevel}
                      </span>
                      <span
                        className={
                          abnormalState
                            ? 'status-invalid'
                            : state.state === 'installed'
                            ? 'status-on'
                            : state.state === 'not-installed'
                              ? 'status-off'
                              : 'status-invalid'
                        }
                      >
                        {statusText}
                      </span>
                      {state.installed && !state.enabled ? (
                        <span className="status-off">已禁用</span>
                      ) : null}
                      {state.trusted ? (
                        <span className="status-on">已信任</span>
                      ) : null}
                    </div>
                    <p>{item.description}</p>
                    <p className="plugin-gallery-safety">
                      {getPluginGallerySafetyText(item.pluginType)}
                    </p>
                    {abnormalState ? (
                      <div className="plugin-next-steps" role="group" aria-label="异常插件下一步操作">
                        <span>{statusText}</span>
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => onInstallGallery?.(item)}
                          disabled={!item.installable || !onInstallGallery}
                        >
                          重新安装
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void runDiagnostics('all')}
                          disabled={!isDesktopApp}
                        >
                          打开诊断中心
                        </button>
                        {installedPlugin && isDesktopApp ? (
                          <button
                            type="button"
                            className="text-action"
                            onClick={() =>
                              onOpenManifestDir(installedPlugin.pluginId)
                            }
                          >
                            打开插件目录
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {!item.installable ? (
                      <div className="plugin-install-error" role="alert">
                        <strong>不可安装</strong>
                        <p>{item.error ?? '内置资源不可用。'}</p>
                      </div>
                    ) : null}
                    <div className="plugin-item-actions">
                      <button
                        type="button"
                        className="primary-action"
                        onClick={() => onInstallGallery?.(item)}
                        disabled={!item.installable || !onInstallGallery}
                      >
                        {getPluginGalleryInstallLabel(state)}
                      </button>
                      {installedPlugin ? (
                        <button
                          type="button"
                          className="secondary-action"
                          disabled={installedPlugin.manifestValid === false}
                          title={
                            installedPlugin.manifestValid === false
                              ? '异常插件需先重新安装或清理'
                              : undefined
                          }
                          onClick={() =>
                            onToggle(item.id, !installedPlugin.enabled)
                          }
                        >
                          {installedPlugin.enabled ? '禁用' : '启用'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-action"
                        onClick={() => onOpenGalleryPluginDir?.(item.id)}
                        disabled={!item.installable || !onOpenGalleryPluginDir}
                      >
                        打开示例目录
                      </button>
                      {abnormalState && installedPlugin ? (
                        <button
                          type="button"
                          className="secondary-action danger-action"
                          onClick={() => onCleanRecord(installedPlugin.pluginId)}
                        >
                          清理异常
                        </button>
                      ) : null}
                    </div>
                    <details className="plugin-gallery-details">
                      <summary>查看详情</summary>
                      <dl className="plugin-paths">
                        <div><dt>pluginId</dt><dd>{item.id}</dd></div>
                        <div><dt>pluginType 原始值</dt><dd>{item.pluginType}</dd></div>
                        <div><dt>runtime</dt><dd>{item.runtime ?? '无'}</dd></div>
                        <div><dt>version</dt><dd>{manifest?.version ?? '不可用'}</dd></div>
                        <div><dt>author</dt><dd>{manifest?.author ?? '未知'}</dd></div>
                        <div><dt>tags</dt><dd>{item.tags.join(', ') || '无'}</dd></div>
                        <div><dt>manifest 状态</dt><dd>{manifest ? '可用' : '不可用'}</dd></div>
                        <div><dt>registry 状态</dt><dd>{statusText}</dd></div>
                        <div><dt>描述</dt><dd>{manifest?.description ?? item.description}</dd></div>
                        <div><dt>permissions</dt><dd>{manifest?.permissions?.join(', ') || '无'}</dd></div>
                        <div><dt>capabilities</dt><dd>{manifest?.capabilities.join(', ') || '无'}</dd></div>
                        <div><dt>风险等级</dt><dd>{item.riskLevel}</dd></div>
                        <div><dt>需要脚本运行器</dt><dd>{item.pluginType === 'script' ? '是' : '否'}</dd></div>
                        <div><dt>需要外部命令运行器</dt><dd>{item.pluginType === 'external-command' ? '是' : '否'}</dd></div>
                        <div><dt>安装状态</dt><dd>{getPluginGalleryStateLabel(state)}</dd></div>
                        {state.installed ? (
                          <div>
                            <dt>安装目录</dt>
                            <dd>{state.installed.installedDirPath ?? `plugins/installed/${item.id}`}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {summary ? (
                        <div className="plugin-contribution-summary">
                          {Object.entries(summary).map(([key, count]) => (
                            <span key={key}>{key}: {count}</span>
                          ))}
                        </div>
                      ) : null}
                    </details>
                    <details className="plugin-gallery-details">
                      <summary>查看 README</summary>
                      <pre>{item.readme ?? 'README.md 不可用。'}</pre>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="plugin-manager-section">
            <div className="plugin-section-heading">
              <div>
                <h3>声明式 JSON 插件</h3>
                <p>
                  仅接受 .json / .lmplugin；JSON workflow 不执行 JS、命令、
                  Shell 或远程代码，script 插件仍受实验 runner 控制。
                </p>
              </div>
              <div className="plugin-manager-actions">
                <button type="button" className="secondary-action" onClick={onReload}>
                  重新加载插件
                </button>
                <button type="button" className="secondary-action" onClick={onInstall}>
                  导入本地插件
                </button>
              </div>
            </div>

            {lastInstallError ? (
              <div className="plugin-install-error" role="alert">
                <strong>最近一次安装错误</strong>
                <p>{lastInstallError}</p>
              </div>
            ) : null}

            <div className="plugin-manager-filters">
              <input
                type="search"
                value={keyword}
                placeholder="搜索插件名称、作者、描述"
                onChange={(event) => setKeyword(event.target.value)}
              />
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as PluginCategory)
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="plugin-list">
              {visiblePlugins.length === 0 ? (
                <p className="empty-note">没有匹配的插件</p>
              ) : (
                visiblePlugins.map((plugin) => {
                  const riskLevel = getPluginRiskLevel(plugin);
                  const statusText = getPluginUserStatus(plugin);
                  const abnormalPlugin = isPluginAbnormal(plugin);

                  return (
                  <article className="plugin-item" key={plugin.pluginId}>
                    <div className="plugin-item-main">
                      <div className="plugin-item-title">
                        <strong>{plugin.name}</strong>
                        {plugin.builtIn ? <span>内置</span> : null}
                        <span className="plugin-type-pill">
                          {pluginTypeLabel(plugin.pluginType)}
                        </span>
                        <span className={getRiskPillClassName(riskLevel)}>
                          风险：{riskLevel}
                        </span>
                        <span
                          className={
                            abnormalPlugin
                              ? 'status-invalid'
                              : plugin.enabled
                                ? 'status-on'
                                : 'status-off'
                          }
                        >
                          {statusText}
                        </span>
                      </div>
                      <p>{plugin.description || '暂无描述'}</p>
                      {abnormalPlugin ? (
                        <div className="plugin-next-steps" role="group" aria-label="异常插件下一步操作">
                          <span>{statusText}</span>
                          <button
                            type="button"
                            className="primary-action"
                            onClick={onInstall}
                          >
                            重新安装
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void runDiagnostics('all')}
                            disabled={!isDesktopApp}
                          >
                            打开诊断中心
                          </button>
                          {isDesktopApp ? (
                            <button
                              type="button"
                              className="text-action"
                              onClick={() => onOpenManifestDir(plugin.pluginId)}
                            >
                              打开插件目录
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <details className="plugin-gallery-details plugin-detail-panel">
                        <summary>查看详情</summary>
                      <dl className="plugin-meta">
                        <div>
                          <dt>pluginId</dt>
                          <dd>{plugin.pluginId}</dd>
                        </div>
                        <div>
                          <dt>版本</dt>
                          <dd>{plugin.version}</dd>
                        </div>
                        <div>
                          <dt>作者</dt>
                          <dd>{plugin.author}</dd>
                        </div>
                        <div>
                          <dt>类型</dt>
                          <dd>{plugin.pluginType}</dd>
                        </div>
                        {plugin.pluginType === 'script' ||
                        plugin.pluginType === 'action-workflow' ||
                        plugin.pluginType === 'external-command' ? (
                          <>
                            {plugin.pluginType === 'script' ||
                            plugin.pluginType === 'external-command' ? (
                              <div>
                                <dt>entry</dt>
                                <dd>{plugin.entry ?? '未声明'}</dd>
                              </div>
                            ) : null}
                            {plugin.pluginType === 'external-command' ? (
                              <div>
                                <dt>runtime</dt>
                                <dd>{plugin.runtime ?? '未声明'}</dd>
                              </div>
                            ) : null}
                            <div>
                              <dt>permissions</dt>
                              <dd>
                                {(plugin.permissions ?? []).length > 0
                                  ? plugin.permissions?.join(', ')
                                  : '未声明'}
                              </dd>
                            </div>
                            <div>
                              <dt>trusted</dt>
                              <dd>{String(Boolean(plugin.trusted))}</dd>
                            </div>
                            {plugin.pluginType === 'script' ? (
                              <div>
                                <dt>script runner</dt>
                                <dd>
                                  {isScriptRunnerEnabled ? 'enabled' : 'disabled'}
                                </dd>
                              </div>
                            ) : null}
                            {plugin.pluginType === 'external-command' ? (
                              <>
                                <div>
                                  <dt>external runner</dt>
                                  <dd>
                                    {isExternalRunnerEnabled
                                      ? 'enabled'
                                      : 'disabled'}
                                  </dd>
                                </div>
                                {plugin.runtime === 'python' ? (
                                  <div>
                                    <dt>Python path</dt>
                                    <dd>{pythonPath}</dd>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        ) : null}
                        <div>
                          <dt>manifestVersion</dt>
                          <dd>{plugin.manifestVersion}</dd>
                        </div>
                        <div>
                          <dt>builtIn</dt>
                          <dd>{String(Boolean(plugin.builtIn))}</dd>
                        </div>
                        <div>
                          <dt>enabled</dt>
                          <dd>{String(plugin.enabled)}</dd>
                        </div>
                        <div>
                          <dt>manifestValid</dt>
                          <dd>{String(plugin.manifestValid !== false)}</dd>
                        </div>
                        <div>
                          <dt>来源</dt>
                          <dd>
                            {SOURCE_LABELS[
                              plugin.source ??
                                (plugin.builtIn ? 'built-in' : 'external')
                            ]}
                          </dd>
                        </div>
                        <div>
                          <dt>安装时间</dt>
                          <dd>
                            {plugin.builtIn
                              ? '随应用安装'
                              : new Date(plugin.installedAt).toLocaleString()}
                          </dd>
                        </div>
                      </dl>
                      <p className="plugin-dir-note">
                        ID：{plugin.pluginId} · 贡献点：
                        {countContributions(plugin)}
                      </p>
                      {plugin.manifestValid === false ? (
                        <div className="plugin-install-error" role="alert">
                          <strong>manifest 无效</strong>
                          <p>{plugin.manifestError}</p>
                        </div>
                      ) : null}
                      {plugin.validationErrors?.length ? (
                        <div className="plugin-validation-report is-error">
                          <strong>Schema errors</strong>
                          {plugin.validationErrors.map((error, index) => (
                            <p key={`${error.code}-${index}`}>
                              {error.field ? `${error.field}：` : ''}
                              {error.message}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {plugin.validationWarnings?.length ? (
                        <div className="plugin-validation-report is-warning">
                          <strong>Schema warnings</strong>
                          {plugin.validationWarnings.map((warning, index) => (
                            <p key={`${warning}-${index}`}>{warning}</p>
                          ))}
                        </div>
                      ) : null}
                      <div className="plugin-contribution-summary">
                        {Object.entries(contributionSummary(plugin)).map(
                          ([name, count]) => (
                            <span key={name}>
                              {name}: {count}
                            </span>
                          ),
                        )}
                      </div>
                      <dl className="plugin-paths">
                        <div>
                          <dt>manifest 路径</dt>
                          <dd>
                            {plugin.builtIn
                              ? '内置插件，无独立 manifest 文件'
                              : resolveUserDataPath(
                                  userDataDir,
                                  plugin.manifestPath ??
                                    `plugins/installed/${plugin.pluginId}/manifest.json`,
                                )}
                          </dd>
                        </div>
                        <div>
                          <dt>registry 路径</dt>
                          <dd>
                            {resolveUserDataPath(
                              userDataDir,
                              'plugins/plugin-registry.json',
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>installed 目录</dt>
                          <dd>
                            {plugin.builtIn
                              ? '内置插件'
                              : resolveUserDataPath(
                                  userDataDir,
                                  plugin.installedDirPath ??
                                    `plugins/installed/${plugin.pluginId}`,
                                )}
                          </dd>
                        </div>
                      </dl>
                      {!plugin.builtIn ? (
                        <div className="plugin-validation-report">
                          <strong>插件包信息</strong>
                          <p>格式：.lmplugin（ZIP）</p>
                          <p>manifest：包根目录 manifest.json</p>
                          <p>
                            导出内容：manifest.json
                            {plugin.entry ? `、${plugin.entry}` : ''}
                            、README.md（如存在）
                          </p>
                          <p>安全状态：trusted 与 registry 元数据不写入插件包</p>
                          {lastPluginExport?.pluginId === plugin.pluginId ? (
                            <p>最近导出路径：{lastPluginExport.path}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="plugin-validation-report is-warning">
                          <strong>插件包信息</strong>
                          <p>内置插件随应用发布，没有独立安装目录，因此不可导出。</p>
                        </div>
                      )}
                      {plugin.capabilities.length > 0 ? (
                        <div className="plugin-capability-list">
                          {plugin.capabilities.map((capability) => (
                            <span key={capability}>{capability}</span>
                          ))}
                        </div>
                      ) : null}
                      {plugin.pluginType === 'script' ||
                      plugin.pluginType === 'action-workflow' ||
                      plugin.pluginType === 'external-command' ? (
                        <div className="plugin-validation-report">
                          <strong>权限分组</strong>
                          <p>
                            读取权限：
                            {(plugin.permissions ?? [])
                              .filter((permission) =>
                                ['mindmap:read', 'node:read'].includes(permission),
                              )
                              .join(', ') || '无'}
                          </p>
                          <p>
                            写入权限：
                            {(plugin.permissions ?? [])
                              .filter((permission) =>
                                ['mindmap:write', 'node:write'].includes(permission),
                              )
                              .join(', ') || '无'}
                          </p>
                          <p>
                            实验权限：
                            {(plugin.permissions ?? [])
                              .filter((permission) =>
                                ['script', 'external-command'].includes(
                                  permission,
                                ),
                              )
                              .join(', ') || '无'}
                          </p>
                          <p>
                            未知权限：
                            {(plugin.permissions ?? [])
                              .filter(
                                (permission) =>
                                  ![
                                    'mindmap:read',
                                    'node:read',
                                    'mindmap:write',
                                    'node:write',
                                    'script',
                                    'external-command',
                                  ].includes(permission),
                              )
                              .join(', ') || '无'}
                          </p>
                        </div>
                      ) : null}
                      {plugin.pluginType === 'action-workflow' &&
                      plugin.workflow ? (
                        <div className="plugin-validation-report">
                          <strong>JSON Action Workflow</strong>
                          <p>workflow.name: {plugin.workflow.name || '未声明'}</p>
                          <p>
                            workflow.description:{' '}
                            {plugin.workflow.description || '未声明'}
                          </p>
                          <p>actionCount: {plugin.workflow.actions.length}</p>
                          <p>
                            actionTypes:{' '}
                            {getWorkflowActionTypes(plugin.workflow.actions).join(
                              ', ',
                            )}
                          </p>
                          <p>
                            hasWriteActions:{' '}
                            {String(
                              workflowHasWriteActions(plugin.workflow.actions),
                            )}
                          </p>
                          {plugin.workflow.actions.map((action, index) => (
                            <pre key={`workflow-action-${index}`}>
                              {JSON.stringify(action, null, 2)}
                            </pre>
                          ))}
                        </div>
                      ) : null}
                      {plugin.pluginType === 'external-command' &&
                      externalRunResults[plugin.pluginId] ? (
                        <div
                          className={
                            externalRunResults[plugin.pluginId].status ===
                            'success'
                              ? 'plugin-validation-report'
                              : 'plugin-validation-report is-error'
                          }
                        >
                          <strong>最近一次外部命令运行</strong>
                          <p>
                            lastRunAt:{' '}
                            {new Date(
                              externalRunResults[plugin.pluginId].lastRunAt,
                            ).toLocaleString()}
                          </p>
                          <p>
                            status: {externalRunResults[plugin.pluginId].status}
                          </p>
                          <p>
                            durationMs:{' '}
                            {externalRunResults[plugin.pluginId].durationMs ?? 0}
                          </p>
                          <p>
                            exitCode:{' '}
                            {String(
                              externalRunResults[plugin.pluginId].exitCode ??
                                'null',
                            )}
                          </p>
                          <p>
                            stdoutSize:{' '}
                            {externalRunResults[plugin.pluginId].stdoutSize ?? 0}
                          </p>
                          <p>
                            actionCount:{' '}
                            {externalRunResults[plugin.pluginId].actionCount ?? 0}
                          </p>
                          <p>
                            appliedActionCount:{' '}
                            {externalRunResults[plugin.pluginId]
                              .appliedActionCount ?? 0}
                          </p>
                          {externalRunResults[plugin.pluginId].stderrPreview ? (
                            <p>
                              stderr preview:{' '}
                              {externalRunResults[plugin.pluginId].stderrPreview}
                            </p>
                          ) : null}
                          {externalRunResults[plugin.pluginId].error ? (
                            <p>
                              error: {externalRunResults[plugin.pluginId].error}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {plugin.pluginType === 'script' &&
                      scriptRunResults[plugin.pluginId] ? (
                        <div
                          className={
                            scriptRunResults[plugin.pluginId].status === 'success'
                              ? 'plugin-validation-report'
                              : 'plugin-validation-report is-error'
                          }
                        >
                          <strong>最近一次脚本运行</strong>
                          <p>
                            lastRunAt:{' '}
                            {new Date(
                              scriptRunResults[plugin.pluginId].lastRunAt,
                            ).toLocaleString()}
                          </p>
                          <p>
                            lastRunStatus:{' '}
                            {scriptRunResults[plugin.pluginId].status}
                          </p>
                          <p>{scriptRunResults[plugin.pluginId].message}</p>
                          {scriptRunResults[plugin.pluginId].actionCount !==
                          undefined ? (
                            <p>
                              actionCount: {scriptRunResults[plugin.pluginId].actionCount}
                            </p>
                          ) : null}
                          {scriptRunResults[plugin.pluginId].durationMs !==
                          undefined ? (
                            <p>
                              durationMs: {scriptRunResults[plugin.pluginId].durationMs}
                            </p>
                          ) : null}
                          {scriptRunResults[plugin.pluginId].appliedActionCount !==
                          undefined ? (
                            <p>
                              appliedActionCount:{' '}
                              {scriptRunResults[plugin.pluginId].appliedActionCount}
                            </p>
                          ) : null}
                          {scriptRunResults[plugin.pluginId].error ? (
                            <p>
                              error: {scriptRunResults[plugin.pluginId].error}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {plugin.pluginType === 'action-workflow' &&
                      workflowRunResults[plugin.pluginId] ? (
                        <div
                          className={
                            workflowRunResults[plugin.pluginId].status ===
                            'success'
                              ? 'plugin-validation-report'
                              : 'plugin-validation-report is-error'
                          }
                        >
                          <strong>最近一次工作流运行</strong>
                          <p>
                            lastRunAt:{' '}
                            {new Date(
                              workflowRunResults[plugin.pluginId].lastRunAt,
                            ).toLocaleString()}
                          </p>
                          <p>
                            lastRunStatus:{' '}
                            {workflowRunResults[plugin.pluginId].status}
                          </p>
                          <p>{workflowRunResults[plugin.pluginId].message}</p>
                          <p>
                            actionCount:{' '}
                            {workflowRunResults[plugin.pluginId].actionCount ?? 0}
                          </p>
                          <p>
                            appliedActionCount:{' '}
                            {workflowRunResults[plugin.pluginId]
                              .appliedActionCount ?? 0}
                          </p>
                          <p>
                            durationMs:{' '}
                            {workflowRunResults[plugin.pluginId].durationMs ?? 0}
                          </p>
                          {workflowRunResults[plugin.pluginId].error ? (
                            <p>
                              error:{' '}
                              {workflowRunResults[plugin.pluginId].error}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <ContributionDetails plugin={plugin} />
                      </details>
                    </div>
                    <div className="plugin-item-actions">
                      {plugin.pluginType === 'script' ||
                      plugin.pluginType === 'action-workflow' ||
                      plugin.pluginType === 'external-command' ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() =>
                            onSetPluginTrusted?.(
                              plugin.pluginId,
                              !plugin.trusted,
                            )
                          }
                        >
                          {plugin.trusted ? '取消信任' : '信任此插件'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-action"
                        onClick={() => onCopyPluginId(plugin.pluginId)}
                      >
                        复制 pluginId
                      </button>
                      {!plugin.builtIn && isDesktopApp ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => onExportPackage?.(plugin.pluginId)}
                        >
                          导出插件包
                        </button>
                      ) : null}
                      {plugin.builtIn ? (
                        <button
                          type="button"
                          className="secondary-action"
                          disabled
                          title="内置插件随应用发布，没有独立安装目录"
                        >
                          不可导出插件包
                        </button>
                      ) : null}
                      {lastPluginExport?.pluginId === plugin.pluginId ? (
                        <>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() =>
                              onCopyExportPath?.(lastPluginExport.path)
                            }
                          >
                            复制导出路径
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() =>
                              onOpenExportLocation?.(lastPluginExport.path)
                            }
                          >
                            打开所在目录
                          </button>
                        </>
                      ) : null}
                      {!plugin.builtIn ? (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() =>
                            onCopyPath(
                              plugin.manifestPath ??
                                `plugins/installed/${plugin.pluginId}/manifest.json`,
                              'manifest 路径',
                            )
                          }
                        >
                          复制 manifest 路径
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-action"
                        onClick={() =>
                          onCopyPath(
                            'plugins/plugin-registry.json',
                            'registry 路径',
                          )
                        }
                      >
                        复制 registry 路径
                      </button>
                      {!plugin.builtIn ? (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() =>
                            onCopyPath(
                              plugin.installedDirPath ??
                                `plugins/installed/${plugin.pluginId}`,
                              'installed 目录路径',
                            )
                          }
                        >
                          复制 installed 目录
                        </button>
                      ) : null}
                      {isDesktopApp ? (
                        <button
                        type="button"
                        className="text-action"
                        onClick={onOpenPluginDir}
                      >
                          打开插件目录
                        </button>
                      ) : null}
                      {isDesktopApp && !plugin.builtIn ? (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() => onOpenManifestDir(plugin.pluginId)}
                        >
                          打开 manifest 所在目录
                        </button>
                      ) : null}
                      {plugin.source === 'registry-missing' ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => onRepairRegistry(plugin.pluginId)}
                        >
                          修复 registry
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-action"
                        disabled={
                          plugin.manifestValid === false ||
                          plugin.source === 'registry-missing'
                        }
                        title={
                          plugin.manifestValid === false
                            ? '异常插件不能启用或禁用，请先清理或重新安装'
                            : plugin.source === 'registry-missing'
                              ? '请先修复 registry 记录'
                              : undefined
                        }
                        onClick={() => onToggle(plugin.pluginId, !plugin.enabled)}
                      >
                        {plugin.enabled ? '禁用' : '启用'}
                      </button>
                      {plugin.manifestValid === false ||
                      plugin.source === 'registry-missing' ||
                      plugin.source === 'orphan-manifest' ? (
                        <button
                          type="button"
                          className="secondary-action danger-action"
                          onClick={() => onCleanRecord(plugin.pluginId)}
                        >
                          清理异常记录
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-action danger-action"
                        disabled={plugin.builtIn}
                        title={plugin.builtIn ? '内置插件可禁用但不能卸载' : undefined}
                        onClick={() => onUninstall(plugin.pluginId)}
                      >
                        卸载
                      </button>
                    </div>
                  </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
