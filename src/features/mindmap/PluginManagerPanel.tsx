import { useMemo, useState } from 'react';
import type { PluginCategory, PluginManifest } from './plugins';

type PluginManagerPanelProps = {
  plugins: PluginManifest[];
  onClose: () => void;
  onInstall: () => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
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
  onClose,
  onInstall,
  onToggle,
  onUninstall,
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
            <button type="button" className="secondary-action" onClick={onInstall}>
              安装本地插件
            </button>
            <button type="button" className="secondary-action" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <div className="plugin-manager-filters">
          <input
            type="search"
            value={keyword}
            placeholder="搜索插件名称、作者、描述"
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as PluginCategory)}
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
                    <span className={plugin.enabled ? 'status-on' : 'status-off'}>
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
    </div>
  );
}

