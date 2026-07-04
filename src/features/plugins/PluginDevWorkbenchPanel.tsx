import { useEffect, useState } from 'react';
import {
  createDefaultDevPluginProjectRequest,
  DEV_PLUGIN_TEMPLATE_OPTIONS,
  getDevPluginIdError,
  suggestDevPluginId,
  type DevPluginPackageResult,
  type DevPluginProjectRequest,
  type DevPluginProjectResult,
  type DevPluginValidationResult,
} from './pluginDevWorkbench';

type PluginDevWorkbenchProps = {
  isDesktopApp: boolean;
  devRootPath: string;
  recentProject: DevPluginProjectResult | null;
  recentValidation: DevPluginValidationResult | null;
  recentPackage: DevPluginPackageResult | null;
  onCreateProject: (
    request: DevPluginProjectRequest,
  ) => Promise<DevPluginProjectResult | null>;
  onValidateProject: (
    pluginId: string,
  ) => Promise<DevPluginValidationResult | null>;
  onBuildPackage: (
    pluginId: string,
  ) => Promise<DevPluginPackageResult | null>;
  onImportPackage: () => void;
  onOpenDevDir: () => void;
  onOpenProjectDir: (pluginId: string) => void;
  onOpenExamplesDir: () => void;
  onOpenDocs: () => void;
  onCopyPath: (path: string, label: string) => void;
  onOpenPackageLocation: (path: string) => void;
};

const getErrorMessage = (error: unknown) =>
  typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : '操作失败。';

export function PluginDevWorkbench({
  isDesktopApp,
  devRootPath,
  recentProject,
  recentValidation,
  recentPackage,
  onCreateProject,
  onValidateProject,
  onBuildPackage,
  onImportPackage,
  onOpenDevDir,
  onOpenProjectDir,
  onOpenExamplesDir,
  onOpenDocs,
  onCopyPath,
  onOpenPackageLocation,
}: PluginDevWorkbenchProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [draft, setDraft] = useState(createDefaultDevPluginProjectRequest);
  const [pluginIdTouched, setPluginIdTouched] = useState(false);
  const [selectedPluginId, setSelectedPluginId] = useState(
    recentProject?.pluginId ?? '',
  );
  const [busyAction, setBusyAction] = useState<
    'create' | 'validate' | 'package' | null
  >(null);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (recentProject?.pluginId) {
      setSelectedPluginId(recentProject.pluginId);
    }
  }, [recentProject?.pluginId]);

  const pluginIdError = getDevPluginIdError(draft.pluginId);
  const selectedPluginIdError = getDevPluginIdError(selectedPluginId);
  const updateDraft = <Key extends keyof DevPluginProjectRequest>(
    key: Key,
    value: DevPluginProjectRequest[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      setLocalError('请输入插件名称。');
      return;
    }
    if (pluginIdError) {
      setLocalError(pluginIdError);
      return;
    }
    setBusyAction('create');
    setLocalError('');
    try {
      const created = await onCreateProject({
        ...draft,
        name: draft.name.trim(),
        pluginId: draft.pluginId.trim(),
        version: draft.version.trim(),
        author: draft.author.trim(),
        description: draft.description.trim(),
      });
      if (created) {
        setSelectedPluginId(created.pluginId);
        setShowWizard(false);
      }
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleValidate = async () => {
    if (selectedPluginIdError) {
      setLocalError(selectedPluginIdError);
      return;
    }
    setBusyAction('validate');
    setLocalError('');
    try {
      await onValidateProject(selectedPluginId.trim());
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handlePackage = async () => {
    if (selectedPluginIdError) {
      setLocalError(selectedPluginIdError);
      return;
    }
    setBusyAction('package');
    setLocalError('');
    try {
      await onBuildPackage(selectedPluginId.trim());
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="plugin-dev-workbench" aria-labelledby="plugin-dev-title">
      <div className="plugin-section-heading">
        <div>
          <h3 id="plugin-dev-title">插件开发者工作台</h3>
          <p>创建模板、校验、打包和本地导入验证；不会联网，也不会执行未安装插件代码。</p>
        </div>
        <span className="plugin-dev-badge">v1.11 MVP</span>
      </div>

      <dl className="plugin-dev-summary">
        <div>
          <dt>dev 根目录</dt>
          <dd title={devRootPath}>{devRootPath}</dd>
        </div>
        <div>
          <dt>最近创建项目</dt>
          <dd>{recentProject?.directoryPath ?? '暂无'}</dd>
        </div>
        <div>
          <dt>最近打包路径</dt>
          <dd>{recentPackage?.packagePath ?? '暂无'}</dd>
        </div>
      </dl>

      <div className="plugin-manager-actions plugin-developer-actions">
        <button
          type="button"
          className="primary-action"
          disabled={!isDesktopApp}
          onClick={() => setShowWizard((visible) => !visible)}
        >
          新建插件项目
        </button>
        <button type="button" className="secondary-action" onClick={onOpenDevDir}>
          打开插件开发目录
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={Boolean(selectedPluginIdError) || busyAction !== null}
          onClick={() => void handleValidate()}
        >
          校验插件项目
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={Boolean(selectedPluginIdError) || busyAction !== null}
          onClick={() => void handlePackage()}
        >
          打包为 .lmplugin
        </button>
        <button type="button" className="secondary-action" onClick={onImportPackage}>
          导入本地打包插件
        </button>
        <button type="button" className="secondary-action" onClick={onOpenDocs}>
          查看插件开发文档
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={onOpenExamplesDir}
        >
          查看示例插件目录
        </button>
      </div>

      {!isDesktopApp ? (
        <p className="plugin-web-warning">插件开发者工作台仅在桌面端可用。</p>
      ) : null}

      <label className="stacked-control plugin-dev-project-picker">
        <span>当前开发项目 pluginId</span>
        <input
          type="text"
          value={selectedPluginId}
          placeholder="localmindmap.user.my-plugin"
          onChange={(event) => setSelectedPluginId(event.target.value)}
        />
      </label>
      {selectedPluginId && selectedPluginIdError ? (
        <p className="field-error">{selectedPluginIdError}</p>
      ) : null}
      {recentProject?.pluginId === selectedPluginId ? (
        <div className="plugin-manager-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => onOpenProjectDir(selectedPluginId)}
          >
            打开项目目录
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              onCopyPath(recentProject.directoryPath, '插件项目路径')
            }
          >
            复制项目路径
          </button>
        </div>
      ) : null}

      {showWizard ? (
        <div className="plugin-dev-wizard">
          <div className="plugin-section-heading">
            <div>
              <strong>新建插件项目向导</strong>
              <p>基础字段会写入 manifest；已有目录必须再次确认才会覆盖。</p>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowWizard(false)}
            >
              取消
            </button>
          </div>
          <div className="plugin-dev-form-grid">
            <label className="stacked-control">
              <span>插件名称</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  updateDraft('name', name);
                  if (!pluginIdTouched) {
                    updateDraft('pluginId', suggestDevPluginId(name));
                  }
                }}
              />
            </label>
            <label className="stacked-control">
              <span>pluginId</span>
              <input
                type="text"
                value={draft.pluginId}
                onChange={(event) => {
                  setPluginIdTouched(true);
                  updateDraft('pluginId', event.target.value);
                }}
              />
            </label>
            <label className="stacked-control">
              <span>version</span>
              <input
                type="text"
                value={draft.version}
                onChange={(event) => updateDraft('version', event.target.value)}
              />
            </label>
            <label className="stacked-control">
              <span>author</span>
              <input
                type="text"
                value={draft.author}
                onChange={(event) => updateDraft('author', event.target.value)}
              />
            </label>
            <label className="stacked-control plugin-dev-wide-field">
              <span>description</span>
              <textarea
                value={draft.description}
                rows={3}
                onChange={(event) =>
                  updateDraft('description', event.target.value)
                }
              />
            </label>
            <label className="stacked-control">
              <span>插件类型模板</span>
              <select
                value={draft.templateType}
                onChange={(event) =>
                  updateDraft(
                    'templateType',
                    event.target.value as DevPluginProjectRequest['templateType'],
                  )
                }
              >
                {DEV_PLUGIN_TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stacked-control">
              <span>菜单位置</span>
              <select
                value={draft.menuLocation}
                onChange={(event) =>
                  updateDraft(
                    'menuLocation',
                    event.target.value as DevPluginProjectRequest['menuLocation'],
                  )
                }
              >
                <option value="plugins">plugins</option>
                <option value="node-context">node-context</option>
              </select>
            </label>
          </div>
          <p className="plugin-safety-note">
            {
              DEV_PLUGIN_TEMPLATE_OPTIONS.find(
                (option) => option.value === draft.templateType,
              )?.description
            }
          </p>
          <div className="plugin-dev-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={draft.generateReadme}
                onChange={(event) =>
                  updateDraft('generateReadme', event.target.checked)
                }
              />
              生成 README
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.generateEntry}
                disabled={draft.templateType === 'external-command-executable'}
                onChange={(event) =>
                  updateDraft('generateEntry', event.target.checked)
                }
              />
              生成示例 entry 文件
            </label>
          </div>
          {pluginIdError ? <p className="field-error">{pluginIdError}</p> : null}
          <button
            type="button"
            className="primary-action"
            disabled={busyAction !== null || Boolean(pluginIdError)}
            onClick={() => void handleCreate()}
          >
            {busyAction === 'create' ? '正在创建…' : '创建插件项目'}
          </button>
        </div>
      ) : null}

      {localError ? (
        <div className="plugin-validation-report is-error" role="alert">
          <strong>工作台操作失败</strong>
          <p>{localError}</p>
        </div>
      ) : null}

      {recentValidation ? (
        <div
          className={`plugin-validation-report ${
            recentValidation.valid ? '' : 'is-error'
          }`}
        >
          <strong>
            最近校验结果：{recentValidation.valid ? 'Valid' : 'Invalid'}
          </strong>
          <p>
            pluginId: {recentValidation.pluginId ?? '未知'}；pluginType:{' '}
            {recentValidation.pluginType ?? '未知'}；runtime:{' '}
            {recentValidation.runtime ?? '无'}；entry:{' '}
            {recentValidation.entry ?? '无'}
          </p>
          <p>
            permissions: {recentValidation.permissions.join(', ') || '无'}
          </p>
          <p>
            contributions:{' '}
            {Object.entries(recentValidation.contributionSummary)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => `${key}=${count}`)
              .join(', ') || '无'}
          </p>
          <p>是否可打包：{recentValidation.canPackage ? '是' : '否'}</p>
          {recentValidation.errors.length > 0 ? (
            <>
              <strong>Schema errors</strong>
              <ul>
                {recentValidation.errors.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    {issue.field ? `${issue.field}: ` : ''}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {recentValidation.warnings.length > 0 ? (
            <>
              <strong>Warnings</strong>
              <ul>
                {recentValidation.warnings.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {recentPackage ? (
        <div className="plugin-validation-report">
          <strong>最近打包结果</strong>
          <p>{recentPackage.packagePath}</p>
          <p>
            包含 {recentPackage.fileCount} 个文件：
            {recentPackage.files.join(', ')}
          </p>
          <div className="plugin-manager-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                onCopyPath(recentPackage.packagePath, '插件包完整路径')
              }
            >
              复制路径
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => onOpenPackageLocation(recentPackage.packagePath)}
            >
              打开所在目录
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
