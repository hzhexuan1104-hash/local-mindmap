import { useMemo, useState } from 'react';
import type { PluginCategory, PluginManifest } from './plugins';
import { resolveUserDataPath } from '../storage/userDataStorage';
import type { PluginLogEntry } from '../plugins/pluginLogs';

type PluginManagerPanelProps = {
  plugins: PluginManifest[];
  lastInstallError: string;
  userDataDir: string;
  isDesktopApp: boolean;
  onClose: () => void;
  onInstall: () => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
  onCopyUserDataDir: () => void;
  onOpenUserDataDir: () => void;
  onOpenPluginDir: () => void;
  onOpenPluginDevDir: () => void;
  onCreateSamplePlugin: () => void;
  onCopyPluginId: (pluginId: string) => void;
  onCopyPath: (relativePath: string, label: string) => void;
  onOpenManifestDir: (pluginId: string) => void;
  onReload: () => void;
  onRepairRegistry: (pluginId: string) => void;
  onCleanRecord: (pluginId: string) => void;
  logs: PluginLogEntry[];
  onClearLogs: () => void;
};

const CATEGORY_OPTIONS: Array<{ value: '' | PluginCategory; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'import-export', label: '导入导出' },
  { value: 'theme', label: '主题包' },
  { value: 'icon-pack', label: '图标包' },
  { value: 'node-type', label: '节点类型包' },
  { value: 'template', label: '模板包' },
  { value: 'tool', label: '工具' },
];

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
  'orphan-manifest': '孤儿 manifest',
  'registry-missing': 'registry 记录缺失',
  'manifest-missing': '插件文件缺失',
  'manifest-damaged': 'manifest 损坏',
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
  onToggle,
  onUninstall,
  onCopyUserDataDir,
  onOpenUserDataDir,
  onOpenPluginDir,
  onOpenPluginDevDir,
  onCreateSamplePlugin,
  onCopyPluginId,
  onCopyPath,
  onOpenManifestDir,
  onReload,
  onRepairRegistry,
  onCleanRecord,
  logs,
  onClearLogs,
}: PluginManagerPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'' | PluginCategory>('');
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [showPluginLogs, setShowPluginLogs] = useState(false);

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
                <small>声明式插件工具与 API 草案</small>
              </span>
            </summary>
            <div className="plugin-developer-content">
              <p>
                当前版本支持声明式 JSON 插件。插件可以贡献菜单、导出项、主题、
                图标、节点类型和模板等声明式能力。
              </p>
              <p className="plugin-safety-note">
                当前版本不会执行插件内的 JS、命令、Shell、DLL 或远程代码。
                后续版本将提供受控插件 API。
              </p>
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
                    Action Protocol 当前仅定义和校验 addNode、addChildNode、
                    updateNode、deleteNode、setNodeRemark、showMessage、
                    exportData 与 applyTemplate；本版本不执行 action。
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
                          <p>{log.message}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}
            </div>
          </details>

          <section className="plugin-manager-section">
            <div className="plugin-section-heading">
              <div>
                <h3>声明式 JSON 插件</h3>
                <p>
                  仅接受 .json / .lmplugin；不会执行 JS、命令、Shell 或远程代码。
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
                visiblePlugins.map((plugin) => (
                  <article className="plugin-item" key={plugin.pluginId}>
                    <div className="plugin-item-main">
                      <div className="plugin-item-title">
                        <strong>{plugin.name}</strong>
                        {plugin.builtIn ? <span>内置</span> : null}
                        <span
                          className={plugin.enabled ? 'status-on' : 'status-off'}
                        >
                          {plugin.enabled ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <p>{plugin.description || '暂无描述'}</p>
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
                      {plugin.capabilities.length > 0 ? (
                        <div className="plugin-capability-list">
                          {plugin.capabilities.map((capability) => (
                            <span key={capability}>{capability}</span>
                          ))}
                        </div>
                      ) : null}
                      <ContributionDetails plugin={plugin} />
                    </div>
                    <div className="plugin-item-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => onCopyPluginId(plugin.pluginId)}
                      >
                        复制 pluginId
                      </button>
                      {!plugin.builtIn ? (
                        <button
                          type="button"
                          className="secondary-action"
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
                        className="secondary-action"
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
                          className="secondary-action"
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
                          className="secondary-action"
                          onClick={onOpenPluginDir}
                        >
                          打开插件目录
                        </button>
                      ) : null}
                      {isDesktopApp && !plugin.builtIn ? (
                        <button
                          type="button"
                          className="secondary-action"
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
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
