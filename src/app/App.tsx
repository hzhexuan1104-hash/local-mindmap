import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { exportMindmapExcel } from '../features/mindmap/exportExcel';
import { exportMindmapJson } from '../features/mindmap/exportJson';
import { exportMindmapMarkdown } from '../features/mindmap/exportMarkdown';
import {
  ExcelImportError,
  importMindmapExcel,
} from '../features/mindmap/importExcel';
import { importMindmapJson } from '../features/mindmap/importJson';
import { importMindmapMarkdown } from '../features/mindmap/importMarkdown';
import { createMindmapLayoutStyle } from '../features/mindmap/layout';
import {
  createEmptyNodeTypeDraft,
  createMindmapNodeType,
  createNodeFromType,
  findNodeTypeById,
  type NodeTypeDraft,
} from '../features/mindmap/nodeTypes';
import { openMindmapFromLocalFile } from '../features/mindmap/openMindmap';
import { RemarkPanel } from '../features/mindmap/RemarkPanel';
import { saveMindmapAsLmind } from '../features/mindmap/saveMindmap';
import {
  findMindmapMatches,
  replaceAllInMindmap,
  replaceMatchInMindmap,
  type SearchScope,
} from '../features/mindmap/searchReplace';
import {
  addMindmapTemplate,
  cloneTemplateProject,
  createTemplateFromMindmap,
  deleteMindmapTemplate,
  loadMindmapTemplates,
  type MindmapTemplate,
} from '../features/mindmap/templates';
import type {
  MindmapNode,
  MindmapNodeType,
  MindmapProject,
} from '../features/mindmap/types';

const createCenterNode = (): MindmapNode => ({
  id: 'root',
  text: '中心主题',
  remark: '',
  children: [],
});

const updateNodeById = (
  node: MindmapNode,
  nodeId: string,
  updater: (node: MindmapNode) => MindmapNode,
): MindmapNode => {
  if (node.id === nodeId) {
    return updater(node);
  }

  return {
    ...node,
    children: node.children.map((child) =>
      updateNodeById(child, nodeId, updater),
    ),
  };
};

const addSiblingById = (
  node: MindmapNode,
  nodeId: string,
  sibling: MindmapNode,
): MindmapNode => ({
  ...node,
  children: node.children.flatMap((child) => {
    if (child.id === nodeId) {
      return [child, sibling];
    }

    return [addSiblingById(child, nodeId, sibling)];
  }),
});

const deleteNodeById = (node: MindmapNode, nodeId: string): MindmapNode => ({
  ...node,
  children: node.children
    .filter((child) => child.id !== nodeId)
    .map((child) => deleteNodeById(child, nodeId)),
});

const findNodeById = (
  node: MindmapNode,
  nodeId: string,
): MindmapNode | null => {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children) {
    const matchedNode = findNodeById(child, nodeId);

    if (matchedNode) {
      return matchedNode;
    }
  }

  return null;
};

type MindmapTreeProps = {
  node: MindmapNode;
  nodeTypes: MindmapNodeType[];
  selectedNodeId: string;
  editingNodeId: string | null;
  editingText: string;
  searchMatchNodeIds: Set<string>;
  onSelectNode: (nodeId: string) => void;
  onStartEdit: (node: MindmapNode) => void;
  onEditingTextChange: (text: string) => void;
  onCommitEdit: () => void;
};

function MindmapTree({
  node,
  nodeTypes,
  selectedNodeId,
  editingNodeId,
  editingText,
  searchMatchNodeIds,
  onSelectNode,
  onStartEdit,
  onEditingTextChange,
  onCommitEdit,
}: MindmapTreeProps) {
  const isSelected = node.id === selectedNodeId;
  const isEditing = node.id === editingNodeId;
  const isSearchMatch = searchMatchNodeIds.has(node.id);
  const nodeType = findNodeTypeById(nodeTypes, node.nodeTypeId);
  const nodeStyle = nodeType
    ? ({
        '--node-type-bg': nodeType.backgroundColor,
        '--node-type-border': nodeType.borderColor,
      } as CSSProperties)
    : undefined;

  return (
    <div className="mindmap-branch">
      <div
        role="button"
        tabIndex={0}
        className={[
          'mindmap-node',
          isSelected ? 'is-selected' : '',
          isSearchMatch ? 'is-search-match' : '',
          nodeType ? 'has-node-type' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={nodeStyle}
        aria-pressed={isSelected}
        onClick={() => onSelectNode(node.id)}
        onDoubleClick={() => onStartEdit(node)}
        onKeyDown={(event) => {
          if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelectNode(node.id);
          }
        }}
      >
        {isEditing ? (
          <textarea
            className="node-editor"
            value={editingText}
            rows={1}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onChange={(event) => onEditingTextChange(event.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCommitEdit();
              }
            }}
          />
        ) : (
          node.text
        )}
      </div>

      {node.children.length > 0 ? (
        <div className="child-branches">
          {node.children.map((child) => (
            <MindmapTree
              key={child.id}
              node={child}
              nodeTypes={nodeTypes}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editingText={editingText}
              searchMatchNodeIds={searchMatchNodeIds}
              onSelectNode={onSelectNode}
              onStartEdit={onStartEdit}
              onEditingTextChange={onEditingTextChange}
              onCommitEdit={onCommitEdit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function App() {
  const [mindmap, setMindmap] = useState<MindmapNode>(createCenterNode);
  const [nodeTypes, setNodeTypes] = useState<MindmapNodeType[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [remarkMode, setRemarkMode] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [templates, setTemplates] = useState<MindmapTemplate[]>([]);
  const [isTemplateListVisible, setIsTemplateListVisible] = useState(false);
  const [isNodeTypePanelVisible, setIsNodeTypePanelVisible] = useState(false);
  const [childNodeTypeId, setChildNodeTypeId] = useState('');
  const [nodeTypeDraft, setNodeTypeDraft] = useState<NodeTypeDraft>(
    createEmptyNodeTypeDraft,
  );
  const messageTimerRef = useRef<number | undefined>(undefined);
  const selectedNode = findNodeById(mindmap, selectedNodeId) ?? mindmap;
  const mindmapLayoutStyle = createMindmapLayoutStyle();
  const searchMatches = useMemo(
    () => findMindmapMatches(mindmap, searchQuery, searchScope),
    [mindmap, searchQuery, searchScope],
  );
  const searchMatchNodeIds = useMemo(
    () => new Set(searchMatches.map((match) => match.nodeId)),
    [searchMatches],
  );
  const activeMatch = searchMatches[activeMatchIndex] ?? null;

  useEffect(() => {
    setTemplates(loadMindmapTemplates());

    return () => {
      window.clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery, searchScope]);

  useEffect(() => {
    if (searchMatches.length > 0 && activeMatchIndex >= searchMatches.length) {
      setActiveMatchIndex(searchMatches.length - 1);
    }
  }, [activeMatchIndex, searchMatches.length]);

  const showMessage = (text: string) => {
    window.clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 2400);
  };

  const applyProject = (project: MindmapProject) => {
    setMindmap(project.rootNode);
    setNodeTypes(project.nodeTypes);
    setSelectedNodeId(project.rootNode.id);
    setEditingNodeId(null);
    setEditingText('');
  };

  const handleCreateMindmap = () => {
    setMindmap(createCenterNode());
    setNodeTypes([]);
    setSelectedNodeId('root');
    setEditingNodeId(null);
    setEditingText('');
    showMessage('已新建空白思维导图');
  };

  const handleSaveMindmap = () => {
    saveMindmapAsLmind(mindmap, 'mindmap.lmind', nodeTypes);
    showMessage('已生成 mindmap.lmind 文件');
  };

  const handleOpenMindmap = async () => {
    try {
      const openedProject = await openMindmapFromLocalFile();

      if (!openedProject) {
        return;
      }

      applyProject(openedProject);
      showMessage('已打开 .lmind 文件');
    } catch {
      showMessage('文件格式不正确，无法打开');
    }
  };

  const handleExportMarkdown = () => {
    exportMindmapMarkdown(mindmap);
    showMessage('已导出 mindmap.md');
  };

  const handleExportExcel = () => {
    exportMindmapExcel(mindmap);
    showMessage('已导出 mindmap.xlsx');
  };

  const handleExportJson = () => {
    exportMindmapJson(mindmap, nodeTypes);
    showMessage('已导出 mindmap.json');
  };

  const handleImportJson = async () => {
    try {
      const importedProject = await importMindmapJson();

      if (!importedProject) {
        return;
      }

      applyProject(importedProject);
      showMessage('已导入 JSON');
    } catch {
      showMessage('JSON 格式不正确，无法导入');
    }
  };

  const handleImportMarkdown = async () => {
    try {
      const importedMindmap = await importMindmapMarkdown();

      if (!importedMindmap) {
        return;
      }

      applyProject({ rootNode: importedMindmap, nodeTypes: [] });
      showMessage('已导入 Markdown');
    } catch {
      showMessage('Markdown 格式不正确，无法导入');
    }
  };

  const handleImportExcel = async () => {
    try {
      const importedMindmap = await importMindmapExcel();

      if (!importedMindmap) {
        return;
      }

      applyProject({ rootNode: importedMindmap, nodeTypes: [] });
      showMessage('已导入 Excel');
    } catch (error) {
      if (error instanceof ExcelImportError) {
        showMessage(error.message);
        return;
      }

      showMessage('Excel 格式不正确，无法导入');
    }
  };

  const createTypedNode = () =>
    createNodeFromType(findNodeTypeById(nodeTypes, childNodeTypeId));

  const handleAddChild = () => {
    const newNode = createTypedNode();

    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNodeId, (node) => ({
        ...node,
        children: [...node.children, newNode],
      })),
    );
    setSelectedNodeId(newNode.id);
    setEditingNodeId(null);
  };

  const handleAddSibling = () => {
    if (selectedNodeId === mindmap.id) {
      showMessage('中心主题不能新增同级节点');
      return;
    }

    const newNode = createTypedNode();

    setMindmap((currentMindmap) =>
      addSiblingById(currentMindmap, selectedNodeId, newNode),
    );
    setSelectedNodeId(newNode.id);
    setEditingNodeId(null);
  };

  const handleDeleteNode = () => {
    if (selectedNodeId === mindmap.id) {
      showMessage('中心主题不能删除');
      return;
    }

    setMindmap((currentMindmap) => deleteNodeById(currentMindmap, selectedNodeId));
    setSelectedNodeId(mindmap.id);
    setEditingNodeId(null);
  };

  const handleRemarkChange = (remark: string) => {
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNode.id, (node) => ({
        ...node,
        remark,
      })),
    );
  };

  const handleStartEdit = (node: MindmapNode) => {
    setSelectedNodeId(node.id);
    setEditingNodeId(node.id);
    setEditingText(node.text);
  };

  const handleCommitEdit = () => {
    if (!editingNodeId) {
      return;
    }

    const nextText = editingText.trim() || '未命名节点';

    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, editingNodeId, (node) => ({
        ...node,
        text: nextText,
      })),
    );
    setEditingNodeId(null);
    setEditingText('');
  };

  const jumpToMatch = (nextIndex: number) => {
    if (searchMatches.length === 0) {
      showMessage('没有匹配结果');
      return;
    }

    const normalizedIndex =
      (nextIndex + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(normalizedIndex);
    setSelectedNodeId(searchMatches[normalizedIndex].nodeId);
  };

  const handleReplaceCurrent = () => {
    if (!searchQuery.trim() || !activeMatch) {
      showMessage('没有可替换的匹配项');
      return;
    }

    setMindmap((currentMindmap) =>
      replaceMatchInMindmap(
        currentMindmap,
        activeMatch,
        searchQuery.trim(),
        replacementText,
      ),
    );
    showMessage('已替换当前匹配项');
  };

  const handleReplaceAll = () => {
    const query = searchQuery.trim();

    if (!query || searchMatches.length === 0) {
      showMessage('没有可替换的匹配项');
      return;
    }

    const confirmed = window.confirm(
      `将替换 ${searchMatches.length} 处匹配内容，是否继续？`,
    );

    if (!confirmed) {
      return;
    }

    setMindmap((currentMindmap) =>
      replaceAllInMindmap(currentMindmap, query, replacementText, searchScope),
    );
    showMessage(`已替换 ${searchMatches.length} 处内容`);
  };

  const handleSaveTemplate = () => {
    const templateName = window.prompt('请输入模板名称', mindmap.text);

    if (templateName === null) {
      return;
    }

    const template = createTemplateFromMindmap(templateName, mindmap, nodeTypes);
    setTemplates(addMindmapTemplate(template));
    showMessage('已保存为模板');
  };

  const handleCreateFromTemplate = (template: MindmapTemplate) => {
    applyProject(cloneTemplateProject(template));
    setIsTemplateListVisible(false);
    showMessage('已从模板新建思维导图');
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(deleteMindmapTemplate(templateId));
    showMessage('已删除模板');
  };

  const handleCreateNodeType = () => {
    const nodeType = createMindmapNodeType(nodeTypeDraft);

    if (!nodeType) {
      showMessage('请先填写节点类型名称');
      return;
    }

    setNodeTypes((currentNodeTypes) => [...currentNodeTypes, nodeType]);
    setNodeTypeDraft(createEmptyNodeTypeDraft());
    showMessage('已创建节点类型');
  };

  const handleSelectedNodeTypeChange = (nodeTypeId: string) => {
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNodeId, (node) => ({
        ...node,
        ...(nodeTypeId ? { nodeTypeId } : { nodeTypeId: undefined }),
      })),
    );
  };

  return (
    <main className="app-shell">
      <header className="app-header" aria-labelledby="app-title">
        <div className="app-title-group">
          <p className="eyebrow">Local Mindmap</p>
          <h1 id="app-title">本地化思维导图工具</h1>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={handleCreateMindmap}
        >
          新建思维导图
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleSaveMindmap}
        >
          保存 .lmind
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleOpenMindmap}
        >
          打开 .lmind
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleExportMarkdown}
        >
          导出 Markdown
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleExportExcel}
        >
          导出 Excel
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleExportJson}
        >
          导出 JSON
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleImportJson}
        >
          导入 JSON
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleImportMarkdown}
        >
          导入 Markdown
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleImportExcel}
        >
          导入 Excel
        </button>
      </header>

      <section className="node-toolbar" aria-label="节点操作">
        <span className="toolbar-label">节点操作</span>
        <label className="inline-control">
          子节点类型
          <select
            value={childNodeTypeId}
            onChange={(event) => setChildNodeTypeId(event.target.value)}
          >
            <option value="">普通节点</option>
            {nodeTypes.map((nodeType) => (
              <option key={nodeType.id} value={nodeType.id}>
                {nodeType.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={handleAddChild}>
          新增子节点
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleAddSibling}
        >
          新增同级节点
        </button>
        <button
          type="button"
          className="secondary-action danger-action"
          onClick={handleDeleteNode}
        >
          删除节点
        </button>
        <label className="inline-control">
          当前节点类型
          <select
            value={selectedNode.nodeTypeId ?? ''}
            onChange={(event) => handleSelectedNodeTypeChange(event.target.value)}
          >
            <option value="">普通节点</option>
            {nodeTypes.map((nodeType) => (
              <option key={nodeType.id} value={nodeType.id}>
                {nodeType.name}
              </option>
            ))}
          </select>
        </label>
        {message ? (
          <span className="operation-message" role="status">
            {message}
          </span>
        ) : null}
      </section>

      <section className="feature-panel" aria-label="查找替换">
        <div className="panel-heading">
          <h2>查找替换</h2>
          <span className="panel-note">
            {searchMatches.length > 0
              ? `${activeMatchIndex + 1} / ${searchMatches.length}`
              : '0 个结果'}
          </span>
        </div>
        <div className="compact-form">
          <input
            type="search"
            value={searchQuery}
            placeholder="查找内容"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <input
            type="text"
            value={replacementText}
            placeholder="替换为"
            onChange={(event) => setReplacementText(event.target.value)}
          />
          <select
            value={searchScope}
            onChange={(event) => setSearchScope(event.target.value as SearchScope)}
          >
            <option value="all">全部</option>
            <option value="text">节点文本</option>
            <option value="remark">备注内容</option>
          </select>
          <button
            type="button"
            className="secondary-action"
            onClick={() => jumpToMatch(activeMatchIndex - 1)}
          >
            上一个
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => jumpToMatch(activeMatchIndex + 1)}
          >
            下一个
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleReplaceCurrent}
          >
            替换
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleReplaceAll}
          >
            全部替换
          </button>
        </div>
      </section>

      <section className="feature-panel" aria-label="模板和节点类型">
        <div className="panel-heading">
          <h2>模板与节点类型</h2>
          <div className="panel-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={handleSaveTemplate}
            >
              保存为模板
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setIsTemplateListVisible((visible) => !visible)}
            >
              从模板新建
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setIsNodeTypePanelVisible((visible) => !visible)}
            >
              节点类型
            </button>
          </div>
        </div>

        {isTemplateListVisible ? (
          <div className="template-list">
            {templates.length === 0 ? (
              <p className="empty-note">暂无自定义模板</p>
            ) : (
              templates.map((template) => (
                <div className="template-item" key={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <span>{new Date(template.createTime).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    使用
                  </button>
                  <button
                    type="button"
                    className="secondary-action danger-action"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}

        {isNodeTypePanelVisible ? (
          <div className="node-type-panel">
            <div className="compact-form node-type-form">
              <input
                type="text"
                value={nodeTypeDraft.name}
                placeholder="类型名称"
                onChange={(event) =>
                  setNodeTypeDraft((draft) => ({
                    ...draft,
                    name: event.target.value,
                  }))
                }
              />
              <label className="inline-control">
                背景色
                <input
                  type="color"
                  value={nodeTypeDraft.backgroundColor}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      backgroundColor: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="inline-control">
                边框颜色
                <input
                  type="color"
                  value={nodeTypeDraft.borderColor}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      borderColor: event.target.value,
                    }))
                  }
                />
              </label>
              <input
                type="text"
                value={nodeTypeDraft.defaultText}
                placeholder="默认文本"
                onChange={(event) =>
                  setNodeTypeDraft((draft) => ({
                    ...draft,
                    defaultText: event.target.value,
                  }))
                }
              />
              <textarea
                value={nodeTypeDraft.defaultRemark}
                placeholder="默认备注"
                onChange={(event) =>
                  setNodeTypeDraft((draft) => ({
                    ...draft,
                    defaultRemark: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                className="secondary-action"
                onClick={handleCreateNodeType}
              >
                创建节点类型
              </button>
            </div>
            <div className="node-type-list">
              {nodeTypes.length === 0 ? (
                <p className="empty-note">暂无节点类型</p>
              ) : (
                nodeTypes.map((nodeType) => (
                  <div className="node-type-item" key={nodeType.id}>
                    <span
                      className="node-type-swatch"
                      style={{
                        background: nodeType.backgroundColor,
                        borderColor: nodeType.borderColor,
                      }}
                    />
                    <strong>{nodeType.name}</strong>
                    <span>{nodeType.defaultText}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="workspace-layout">
        <section className="mindmap-canvas" aria-label="思维导图画布">
          <div className="canvas-grid" aria-hidden="true" />
          <div className="mindmap-tree" style={mindmapLayoutStyle}>
            <MindmapTree
              node={mindmap}
              nodeTypes={nodeTypes}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editingText={editingText}
              searchMatchNodeIds={searchMatchNodeIds}
              onSelectNode={setSelectedNodeId}
              onStartEdit={handleStartEdit}
              onEditingTextChange={setEditingText}
              onCommitEdit={handleCommitEdit}
            />
          </div>
        </section>

        <RemarkPanel
          selectedNode={selectedNode}
          mode={remarkMode}
          onModeChange={setRemarkMode}
          onRemarkChange={handleRemarkChange}
        />
      </div>
    </main>
  );
}
