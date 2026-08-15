import { useEffect } from 'react';
import {
  NODE_TYPE_ICONS,
  NODE_TYPE_SHAPES,
  type NodeTypeDraft,
} from '../../features/mindmap/nodeTypes';
import type { MindmapNodeType } from '../../features/mindmap/types';

type NodeManagerDrawerProps = {
  nodeTypes: MindmapNodeType[];
  draft: NodeTypeDraft;
  editingNodeTypeId: string | null;
  onDraftChange: (updater: (draft: NodeTypeDraft) => NodeTypeDraft) => void;
  onSave: () => void;
  onEdit: (nodeType: MindmapNodeType) => void;
  onDelete: (nodeType: MindmapNodeType) => void;
  onImport: () => void;
  onExport: () => void;
  onRequestClose: () => void;
};

/** Modal management surface for node-type definitions; it never changes a selected node's type. */
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
  onRequestClose,
}: NodeManagerDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onRequestClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onRequestClose]);

  const title = editingNodeTypeId ? '编辑节点类型' : '节点管理';

  return (
    <div
      className="node-manager-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <section
        className="node-manager-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-manager-title"
      >
        <header className="node-manager-header">
          <div>
            <p className="eyebrow">Node types</p>
            <h2 id="node-manager-title">{title}</h2>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={onRequestClose}
            aria-label="关闭节点管理"
            title="关闭节点管理"
          >
            ×
          </button>
        </header>

        <div className="node-manager-body">
          <form
            className="node-manager-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <label>
              <span>类型名称</span>
              <input
                autoFocus
                value={draft.name}
                placeholder="例如：任务节点"
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label>
              <span>图标</span>
              <select
                value={draft.icon}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, icon: event.target.value }))
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
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    shape: event.target.value as NodeTypeDraft['shape'],
                  }))
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
                    aria-label={label}
                    onChange={(event) =>
                      onDraftChange((current) => ({ ...current, [key]: event.target.value }))
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
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, fontSize: Number(event.target.value) }))
                }
              />
            </label>
            <label className="node-manager-checkbox">
              <input
                type="checkbox"
                checked={draft.bold}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, bold: event.target.checked }))
                }
              />
              <span>默认加粗</span>
            </label>
            <label>
              <span>默认文本</span>
              <input
                value={draft.defaultText}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, defaultText: event.target.value }))
                }
              />
            </label>
            <label>
              <span>默认备注</span>
              <textarea
                value={draft.defaultRemark}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, defaultRemark: event.target.value }))
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
    </div>
  );
}
