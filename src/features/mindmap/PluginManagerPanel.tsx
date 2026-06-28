import { useMemo, useState } from 'react';
import type { PluginCategory, PluginManifest } from './plugins';

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
  onCopyPluginId: (pluginId: string) => void;
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

function joinUserPath(root: string, relativePath: string) {
  if (!root || root === '浏览器本地存储') {
    return relativePath;
  }
  return `${root.replace(/[\\/]$/, '')}/${relativePath}`;
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
  onCopyPluginId,
}: PluginManagerPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'' | PluginCategory>('');

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

          <section className="plugin-manager-section">
            <div className="plugin-section-heading">
              <div>
                <h3>声明式 JSON 插件</h3>
                <p>
                  仅接受 .json / .lmplugin；不会执行 JS、命令、Shell 或远程代码。
                </p>
              </div>
              <button type="button" className="secondary-action" onClick={onInstall}>
                导入本地插件
              </button>
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
                              ? '内置插件（无独立 manifest 文件）'
                              : joinUserPath(
                                  userDataDir,
                                  `plugins/installed/${plugin.pluginId}/manifest.json`,
                                )}
                          </dd>
                        </div>
                        <div>
                          <dt>registry 路径</dt>
                          <dd>
                            {joinUserPath(
                              userDataDir,
                              'plugins/plugin-registry.json',
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
                      {plugin.contributions?.exporters?.length ? (
                        <div className="plugin-capability-list">
                          {plugin.contributions.exporters.map((exporter) => (
                            <span key={exporter.id}>
                              {exporter.label} · {exporter.handler}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {plugin.contributions?.menus?.length ? (
                        <div className="plugin-menu-details">
                          <strong>菜单贡献详情</strong>
                          {plugin.contributions.menus.map((menu) => (
                            <dl key={menu.id}>
                              <div>
                                <dt>label</dt>
                                <dd>{menu.label}</dd>
                              </div>
                              <div>
                                <dt>command</dt>
                                <dd>{menu.command || '未填写'}</dd>
                              </div>
                              <div>
                                <dt>location</dt>
                                <dd>{menu.location || '未填写'}</dd>
                              </div>
                              <div>
                                <dt>状态</dt>
                                <dd>{menu.valid ? '有效' : '无效'}</dd>
                              </div>
                              {!menu.valid ? (
                                <div>
                                  <dt>无效原因</dt>
                                  <dd>{menu.invalidReason}</dd>
                                </div>
                              ) : null}
                            </dl>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="plugin-item-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => onCopyPluginId(plugin.pluginId)}
                      >
                        复制 pluginId
                      </button>
                      {isDesktopApp ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={onOpenPluginDir}
                        >
                          打开插件目录
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => onToggle(plugin.pluginId, !plugin.enabled)}
                      >
                        {plugin.enabled ? '禁用' : '启用'}
                      </button>
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
