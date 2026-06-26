import { useMemo, useState } from 'react';
import type {
  DesktopPluginManifestError,
  NativeDesktopPluginManifest,
} from './desktopPlugins';
import type { PluginCategory, PluginManifest } from './plugins';

type PluginManagerPanelProps = {
  plugins: PluginManifest[];
  desktopPluginDir: string;
  desktopPlugins: NativeDesktopPluginManifest[];
  invalidDesktopPlugins: DesktopPluginManifestError[];
  isDesktopPluginAvailable: boolean;
  isDesktopPluginLoading: boolean;
  onClose: () => void;
  onInstall: () => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
  onRefreshDesktopPlugins: () => void;
  onInstallDesktopPlugin: () => void;
  onToggleDesktopPlugin: (pluginId: string, enabled: boolean) => void;
  onUninstallDesktopPlugin: (pluginId: string) => void;
};

const CATEGORY_OPTIONS: Array<{ value: '' | PluginCategory; label: string }> = [
  { value: '', label: '全部分类' },
  { value: 'import-export', label: '导入导出' },
  { value: 'theme', label: '主题' },
  { value: 'icon-pack', label: '图标包' },
  { value: 'node-type', label: '节点类型' },
  { value: 'tool', label: '工具' },
];

export function PluginManagerPanel({
  plugins,
  desktopPluginDir,
  desktopPlugins,
  invalidDesktopPlugins,
  isDesktopPluginAvailable,
  isDesktopPluginLoading,
  onClose,
  onInstall,
  onToggle,
  onUninstall,
  onRefreshDesktopPlugins,
  onInstallDesktopPlugin,
  onToggleDesktopPlugin,
  onUninstallDesktopPlugin,
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
        plugin.category,
        plugin.description,
      ]
        .join(' ')
        .toLowerCase();
      const matchesKeyword = query ? searchableText.includes(query) : true;

      return matchesCategory && matchesKeyword;
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
                <h3>Web JSON 插件</h3>
                <p>保留当前 localStorage 插件机制。</p>
              </div>
              <button type="button" className="secondary-action" onClick={onInstall}>
                安装本地 JSON 插件
              </button>
            </div>

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
                          <dt>分类</dt>
                          <dd>{plugin.category}</dd>
                        </div>
                        <div>
                          <dt>安装时间</dt>
                          <dd>{new Date(plugin.installedAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                      {plugin.capabilities.length > 0 ? (
                        <div className="plugin-capability-list">
                          {plugin.capabilities.map((capability) => (
                            <span key={capability}>{capability}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="plugin-item-actions">
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

          <section className="plugin-manager-section native-plugin-section">
            <div className="plugin-section-heading">
              <div>
                <h3>桌面 Native 插件</h3>
                <p>
                  Native 插件属于本机扩展能力。未来版本可能加载本地二进制文件。请只安装可信来源插件。
                </p>
              </div>
              {isDesktopPluginAvailable ? (
                <div className="plugin-manager-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={onRefreshDesktopPlugins}
                    disabled={isDesktopPluginLoading}
                  >
                    扫描
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={onInstallDesktopPlugin}
                    disabled={isDesktopPluginLoading}
                  >
                    安装 manifest
                  </button>
                </div>
              ) : null}
            </div>

            {isDesktopPluginAvailable ? (
              <>
                <p className="plugin-dir-note">
                  插件目录：{desktopPluginDir || '正在获取...'}
                </p>

                <div className="plugin-list">
                  {desktopPlugins.length === 0 ? (
                    <p className="empty-note">尚未扫描到合法 Native 插件</p>
                  ) : (
                    desktopPlugins.map((plugin) => (
                      <article className="plugin-item" key={plugin.pluginId}>
                        <div className="plugin-item-main">
                          <div className="plugin-item-title">
                            <strong>{plugin.name}</strong>
                            <span
                              className={
                                plugin.enabled ? 'status-on' : 'status-off'
                              }
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
                              <dt>平台</dt>
                              <dd>{plugin.platform || '未声明'}</dd>
                            </div>
                            <div>
                              <dt>架构</dt>
                              <dd>{plugin.arch || '未声明'}</dd>
                            </div>
                            <div>
                              <dt>入口 DLL</dt>
                              <dd>{plugin.entry}</dd>
                            </div>
                          </dl>
                          {plugin.capabilities.length > 0 ? (
                            <div className="plugin-capability-list">
                              {plugin.capabilities.map((capability) => (
                                <span key={capability}>{capability}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="plugin-item-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() =>
                              onToggleDesktopPlugin(
                                plugin.pluginId,
                                !plugin.enabled,
                              )
                            }
                          >
                            {plugin.enabled ? '禁用' : '启用'}
                          </button>
                          <button
                            type="button"
                            className="secondary-action danger-action"
                            onClick={() => onUninstallDesktopPlugin(plugin.pluginId)}
                          >
                            卸载
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                {invalidDesktopPlugins.length > 0 ? (
                  <div className="invalid-plugin-list">
                    <h4>manifest 无效</h4>
                    {invalidDesktopPlugins.map((plugin) => (
                      <article
                        className="plugin-item invalid-plugin-item"
                        key={`${plugin.manifestPath}-${plugin.message}`}
                      >
                        <div className="plugin-item-main">
                          <div className="plugin-item-title">
                            <strong>{plugin.pluginId || '未知插件'}</strong>
                            <span className="status-invalid">manifest 无效</span>
                          </div>
                          <p>{plugin.message}</p>
                          <p>{plugin.manifestPath}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty-note">桌面插件仅在 Tauri 桌面端可用。</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
