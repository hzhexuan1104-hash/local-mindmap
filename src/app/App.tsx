import { useEffect, useRef, useState } from 'react';
import { openMindmapFromLocalFile } from '../features/mindmap/openMindmap';
import { RemarkPanel } from '../features/mindmap/RemarkPanel';
import { saveMindmapAsLmind } from '../features/mindmap/saveMindmap';
import type { MindmapNode } from '../features/mindmap/types';

const createCenterNode = (): MindmapNode => ({
  id: 'root',
  text: '中心主题',
  remark: '',
  children: [],
});

const createNode = (): MindmapNode => ({
  id: crypto.randomUUID(),
  text: '新节点',
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
  selectedNodeId: string;
  editingNodeId: string | null;
  editingText: string;
  onSelectNode: (nodeId: string) => void;
  onStartEdit: (node: MindmapNode) => void;
  onEditingTextChange: (text: string) => void;
  onCommitEdit: () => void;
};

function MindmapTree({
  node,
  selectedNodeId,
  editingNodeId,
  editingText,
  onSelectNode,
  onStartEdit,
  onEditingTextChange,
  onCommitEdit,
}: MindmapTreeProps) {
  const isSelected = node.id === selectedNodeId;
  const isEditing = node.id === editingNodeId;

  return (
    <div className="mindmap-branch">
      <div
        role="button"
        tabIndex={0}
        className={`mindmap-node${isSelected ? ' is-selected' : ''}`}
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
          <input
            className="node-editor"
            value={editingText}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onChange={(event) => onEditingTextChange(event.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
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
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editingText={editingText}
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
  const [selectedNodeId, setSelectedNodeId] = useState('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [remarkMode, setRemarkMode] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState('');
  const messageTimerRef = useRef<number | undefined>(undefined);
  const selectedNode = findNodeById(mindmap, selectedNodeId) ?? mindmap;

  useEffect(() => {
    return () => {
      window.clearTimeout(messageTimerRef.current);
    };
  }, []);

  const showMessage = (text: string) => {
    window.clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 2400);
  };

  const handleCreateMindmap = () => {
    setMindmap(createCenterNode());
    setSelectedNodeId('root');
    setEditingNodeId(null);
    setEditingText('');
    showMessage('已新建空白思维导图');
  };

  const handleSaveMindmap = () => {
    saveMindmapAsLmind(mindmap);
    showMessage('已生成 mindmap.lmind 文件');
  };

  const handleOpenMindmap = async () => {
    try {
      const openedMindmap = await openMindmapFromLocalFile();

      if (!openedMindmap) {
        return;
      }

      setMindmap(openedMindmap);
      setSelectedNodeId(openedMindmap.id);
      setEditingNodeId(null);
      setEditingText('');
      showMessage('已打开 .lmind 文件');
    } catch {
      showMessage('文件格式不正确，无法打开');
    }
  };

  const handleAddChild = () => {
    const newNode = createNode();

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

    const newNode = createNode();

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
    setSelectedNodeId('root');
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
      </header>

      <section className="node-toolbar" aria-label="节点操作">
        <span className="toolbar-label">节点操作</span>
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
        {message ? (
          <span className="operation-message" role="status">
            {message}
          </span>
        ) : null}
      </section>

      <div className="workspace-layout">
        <section className="mindmap-canvas" aria-label="思维导图画布">
          <div className="canvas-grid" aria-hidden="true" />
          <div className="mindmap-tree">
            <MindmapTree
              node={mindmap}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editingText={editingText}
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
