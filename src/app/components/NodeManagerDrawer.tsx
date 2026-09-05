import { useRef, useState } from 'react';
import {
  NODE_TYPE_ICONS,
  NODE_TYPE_SHAPES,
  type NodeTypeDraft,
  type NodeTypeDraftErrors,
  validateNodeTypeDraft,
} from '../../features/mindmap/nodeTypes';
import type { MindmapNodeType } from '../../features/mindmap/types';

type NodeManagerDrawerProps = {
  nodeTypes: MindmapNodeType[];
  draft: NodeTypeDraft;
  editingNodeTypeId: string | null;
  onDraftChange: (updater: (draft: NodeTypeDraft) => NodeTypeDraft) => void;
  onSave: () => void | boolean | Promise<void | boolean>;
  onEdit: (nodeType: MindmapNodeType) => void;
  onDelete: (nodeType: MindmapNodeType) => void;
  onImport: () => void;
  onExport: () => void;
};

/** Content for the shared workspace overlay that manages node-type definitions. */
export function NodeManagerDrawer({
  nodeTypes,
  draft,
  editingNodeTypeId,
  onDraftChange,
  onSave,
  onEdit,
  onDelete,
  onImport,
  onExport,
}: NodeManagerDrawerProps) {
  const [errors, setErrors] = useState<NodeTypeDraftErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const hasErrors = Object.keys(errors).length > 0;
  const updateDraft = (updater: (current: NodeTypeDraft) => NodeTypeDraft, field?: keyof NodeTypeDraftErrors) => {
    onDraftChange(updater);
    if (field && errors[field]) {
      setErrors((current) => {
        const { [field]: _removed, ...remaining } = current;
        return remaining;
      });
    }
  };

  const submit = async () => {
    const nextErrors = validateNodeTypeDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    setErrors({});
    await onSave();
  };

  return (
      <section className="node-manager-drawer" aria-label="节点类型管理">
        <div className="node-manager-body">
          <form
            className="node-manager-form"
              onSubmit={(event) => {
                event.preventDefault();
              void submit();
            }}
          >
            {hasErrors ? <p className="node-manager-error-summary" role="alert">请先修正以下必填或格式错误字段。</p> : null}
            <label>
              <span>类型名称</span>
              <input
                ref={nameInputRef}
                autoFocus
                value={draft.name}
                placeholder="例如：任务节点"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'node-type-name-error' : undefined}
                className={errors.name ? 'has-field-error' : undefined}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, name: event.target.value }), 'name')
                }
              />
              {errors.name ? <small id="node-type-name-error" className="field-error-text">{errors.name}</small> : null}
            </label>
            <label>
              <span>图标</span>
              <select
                value={draft.icon}
                aria-invalid={Boolean(errors.icon)}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, icon: event.target.value }), 'icon')
                }
              >
                {NODE_TYPE_ICONS.map((icon) => (
                  <option key={icon.value} value={icon.value}>{icon.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>形状</span>
              <select
                value={draft.shape}
                aria-invalid={Boolean(errors.shape)}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    shape: event.target.value as NodeTypeDraft['shape'],
                  }), 'shape')
                }
              >
                {NODE_TYPE_SHAPES.map((shape) => (
                  <option key={shape.value} value={shape.value}>{shape.label}</option>
                ))}
              </select>
            </label>
            <div className="node-manager-color-row">
              {([
                ['背景色', 'backgroundColor'],
                ['边框色', 'borderColor'],
                ['文字色', 'textColor'],
              ] as const).map(([label, key]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={draft[key]}
                    aria-invalid={Boolean(errors[key])}
                    className={errors[key] ? 'has-field-error' : undefined}
                    aria-label={label}
                    onChange={(event) =>
                      updateDraft((current) => ({ ...current, [key]: event.target.value }), key)
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              <span>字号</span>
              <input
                type="number"
                min={12}
                max={28}
                value={draft.fontSize}
                aria-invalid={Boolean(errors.fontSize)}
                className={errors.fontSize ? 'has-field-error' : undefined}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, fontSize: Number(event.target.value) }), 'fontSize')
                }
              />
              {errors.fontSize ? <small className="field-error-text">{errors.fontSize}</small> : null}
            </label>
            <label className="node-manager-checkbox">
              <input
                type="checkbox"
                checked={draft.bold}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, bold: event.target.checked }))
                }
              />
              <span>默认加粗</span>
            </label>
            <label>
              <span>默认文本</span>
              <input
                value={draft.defaultText}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, defaultText: event.target.value }))
                }
              />
            </label>
            <label>
              <span>默认备注</span>
              <textarea
                value={draft.defaultRemark}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, defaultRemark: event.target.value }))
                }
              />
            </label>
            <div className="node-manager-actions">
              <button type="submit" className="primary-action">
                {editingNodeTypeId ? '保存修改' : '创建节点类型'}
              </button>
              <button type="button" className="secondary-action" onClick={onImport}>导入类型包</button>
              <button type="button" className="secondary-action" onClick={onExport}>导出类型包</button>
            </div>
          </form>

          <section className="node-manager-list" aria-label="节点类型列表">
            <h3>已定义类型</h3>
            {nodeTypes.length === 0 ? <p>暂无自定义节点类型。</p> : nodeTypes.map((nodeType) => (
              <article key={nodeType.id} className="node-manager-list-item">
                <span
                  className="node-type-swatch"
                  style={{
                    background: nodeType.backgroundColor,
                    borderColor: nodeType.borderColor,
                    color: nodeType.textColor,
                  }}
                >{nodeType.icon}</span>
                <div>
                  <strong>{nodeType.name}</strong>
                  <span>{nodeType.shape} · {nodeType.fontSize}px · {nodeType.defaultText}</span>
                </div>
                <div className="node-manager-item-actions">
                  <button type="button" onClick={() => onEdit(nodeType)}>编辑</button>
                  <button type="button" className="danger-action" onClick={() => onDelete(nodeType)}>删除</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>
  );
}
