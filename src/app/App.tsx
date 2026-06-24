import {
  type CSSProperties,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  centerCanvasView,
  DEFAULT_CANVAS_VIEW,
  panCanvasView,
  zoomCanvasView,
  type CanvasViewState,
} from '../features/mindmap/canvasControls';
import { ExcelImportMappingDialog } from '../features/mindmap/ExcelImportMappingDialog';
import { exportMindmapExcel } from '../features/mindmap/exportExcel';
import { exportMindmapAsImage } from '../features/mindmap/exportImage';
import { exportMindmapJson } from '../features/mindmap/exportJson';
import { exportMindmapMarkdown } from '../features/mindmap/exportMarkdown';
import { exportMindmapTxt } from '../features/mindmap/exportTxt';
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from '../features/mindmap/history';
import {
  ExcelImportError,
  parseExcelRowsToMindmap,
  selectExcelImportPreview,
  type ExcelImportMapping,
  type ExcelImportPreview,
  type RawExcelRow,
} from '../features/mindmap/importExcel';
import { importMindmapJson } from '../features/mindmap/importJson';
import { importMindmapMarkdown } from '../features/mindmap/importMarkdown';
import {
  clearMindmapPositions,
  createMindmapLayout,
  POSITIONED_LAYOUT,
  type MindmapLayoutNode,
} from '../features/mindmap/layout';
import {
  createEmptyNodeTypeDraft,
  createMindmapNodeType,
  createNodeFromType,
  findNodeTypeById,
  NODE_TYPE_ICONS,
  NODE_TYPE_SHAPES,
  type NodeTypeDraft,
} from '../features/mindmap/nodeTypes';
import { openMindmapFromLocalFile } from '../features/mindmap/openMindmap';
import { OFFICIAL_TEMPLATES } from '../features/mindmap/officialTemplates';
import { PerformancePanel } from '../features/mindmap/PerformancePanel';
import type { PerformanceBenchmarkResult } from '../features/mindmap/performanceTest';
import { PluginManagerPanel } from '../features/mindmap/PluginManagerPanel';
import {
  getPluginIcons,
  getPluginNodeTypes,
  getPluginThemes,
  installPluginManifest,
  isTxtExportPluginEnabled,
  loadPluginRegistry,
  readLocalPluginManifest,
  savePluginRegistry,
  setPluginEnabled,
  uninstallPlugin,
  type PluginManifest,
} from '../features/mindmap/plugins';
import { RemarkPanel } from '../features/mindmap/RemarkPanel';
import { saveMindmapAsLmind } from '../features/mindmap/saveMindmap';
import {
  findMindmapMatches,
  replaceAllInMindmap,
  replaceMatchInMindmap,
  type SearchScope,
} from '../features/mindmap/searchReplace';
import {
  applyNodeTypeToNodes,
  deleteNodesByIds,
  getDeletableSelectedNodeIds,
  updateSelection,
} from '../features/mindmap/selection';
import {
  addMindmapTemplate,
  cloneTemplateProject,
  createTemplateFromMindmap,
  deleteMindmapTemplate,
  filterAndSortTemplates,
  getTemplateCategories,
  loadMindmapTemplates,
  type MindmapTemplate,
  type TemplateSortMode,
} from '../features/mindmap/templates';
import { createThemeStyle, MINDMAP_THEMES } from '../features/mindmap/themes';
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

const setAllNodesCollapsed = (
  node: MindmapNode,
  collapsed: boolean,
): MindmapNode => ({
  ...node,
  collapsed: node.children.length > 0 ? collapsed : false,
  children: node.children.map((child) => setAllNodesCollapsed(child, collapsed)),
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

const findParentNodeById = (
  node: MindmapNode,
  nodeId: string,
): MindmapNode | null => {
  if (node.children.some((child) => child.id === nodeId)) {
    return node;
  }

  for (const child of node.children) {
    const parent = findParentNodeById(child, nodeId);

    if (parent) {
      return parent;
    }
  }

  return null;
};

const setNodePositionById = (
  node: MindmapNode,
  nodeId: string,
  position: { x: number; y: number },
): MindmapNode =>
  updateNodeById(node, nodeId, (targetNode) => ({
    ...targetNode,
    position,
  }));

type DragState = {
  nodeId: string;
  pointerStart: { x: number; y: number };
  nodeStart: { x: number; y: number };
  hasRecordedHistory: boolean;
};

type ContextMenuState =
  | {
      type: 'node';
      nodeId: string;
      x: number;
      y: number;
    }
  | {
      type: 'canvas';
      x: number;
      y: number;
    };

type ContextMenuInput =
  | {
      type: 'node';
      nodeId: string;
    }
  | {
      type: 'canvas';
    };

type MindmapTreeProps = {
  layoutNode: MindmapLayoutNode;
  nodeTypes: MindmapNodeType[];
  selectedNodeId: string;
  selectedNodeIds: Set<string>;
  draggingNodeId: string | null;
  editingNodeId: string | null;
  editingText: string;
  searchMatchNodeIds: Set<string>;
  onToggleCollapse: (nodeId: string) => void;
  onSelectNode: (nodeId: string, append: boolean) => void;
  onStartEdit: (node: MindmapNode) => void;
  onEditingTextChange: (text: string) => void;
  onCommitEdit: () => void;
  onStartDrag: (nodeId: string, event: MouseEvent<HTMLElement>) => void;
  onOpenContextMenu: (node: MindmapNode, event: MouseEvent<HTMLElement>) => void;
};

function MindmapTree({
  layoutNode,
  nodeTypes,
  selectedNodeId,
  selectedNodeIds,
  draggingNodeId,
  editingNodeId,
  editingText,
  searchMatchNodeIds,
  onToggleCollapse,
  onSelectNode,
  onStartEdit,
  onEditingTextChange,
  onCommitEdit,
  onStartDrag,
  onOpenContextMenu,
}: MindmapTreeProps) {
  const node = layoutNode.node;
  const isSelected = selectedNodeIds.has(node.id);
  const isPrimarySelected = node.id === selectedNodeId;
  const isEditing = node.id === editingNodeId;
  const isSearchMatch = searchMatchNodeIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const nodeType = findNodeTypeById(nodeTypes, node.nodeTypeId);
  const nodeStyle = nodeType
    ? ({
        '--node-type-bg': nodeType.backgroundColor,
        '--node-type-border': nodeType.borderColor,
        '--node-type-text': nodeType.textColor,
        '--node-type-font-size': `${nodeType.fontSize}px`,
        '--node-type-font-weight': nodeType.bold ? 700 : 500,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className="mindmap-node-wrap positioned-node-wrap"
      style={{
        left: layoutNode.x,
        top: layoutNode.y,
        width: POSITIONED_LAYOUT.nodeWidth,
        minHeight: POSITIONED_LAYOUT.nodeHeight,
      }}
    >
        <div
          role="button"
          tabIndex={0}
          className={[
            'mindmap-node',
            isSelected ? 'is-selected' : '',
            isPrimarySelected ? 'is-primary-selected' : '',
            draggingNodeId === node.id ? 'is-dragging' : '',
            isSearchMatch ? 'is-search-match' : '',
            nodeType ? 'has-node-type' : '',
            nodeType ? `shape-${nodeType.shape}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={nodeStyle}
          aria-pressed={isSelected || isPrimarySelected}
          onClick={(event) => {
            event.stopPropagation();
            onSelectNode(node.id, event.ctrlKey || event.shiftKey);
          }}
          onMouseDown={(event) => {
            if (event.button !== 0 || isEditing) {
              return;
            }

            event.stopPropagation();
            onStartDrag(node.id, event);
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            onOpenContextMenu(node, event);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onStartEdit(node);
          }}
          onKeyDown={(event) => {
            if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onSelectNode(node.id, false);
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
            <>
              {nodeType?.icon ? (
                <span className="node-icon" aria-hidden="true">
                  {nodeType.icon}
                </span>
              ) : null}
              <span>{node.text}</span>
            </>
          )}
        </div>
        {hasChildren ? (
          <button
            type="button"
            className="collapse-toggle"
            aria-label={node.collapsed ? '展开子节点' : '折叠子节点'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse(node.id);
            }}
          >
            {node.collapsed ? '+' : '-'}
          </button>
        ) : null}
      </div>
  );
}

export function App() {
  const [mindmap, setMindmap] = useState<MindmapNode>(createCenterNode);
  const [nodeTypes, setNodeTypes] = useState<MindmapNodeType[]>([]);
  const [themeId, setThemeId] = useState('default-blue');
  const [history, setHistory] = useState<HistoryState>(createHistoryState);
  const [canvasView, setCanvasView] =
    useState<CanvasViewState>(DEFAULT_CANVAS_VIEW);
  const [selectedNodeId, setSelectedNodeId] = useState('root');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(['root']);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [remarkMode, setRemarkMode] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState('');
  const [excelImportPreview, setExcelImportPreview] =
    useState<ExcelImportPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [templates, setTemplates] = useState<MindmapTemplate[]>([]);
  const [isTemplateListVisible, setIsTemplateListVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('未分类');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('');
  const [templateSortMode, setTemplateSortMode] =
    useState<TemplateSortMode>('created-desc');
  const [isNodeTypePanelVisible, setIsNodeTypePanelVisible] = useState(false);
  const [childNodeTypeId, setChildNodeTypeId] = useState('');
  const [nodeTypeDraft, setNodeTypeDraft] = useState<NodeTypeDraft>(
    createEmptyNodeTypeDraft,
  );
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [isPluginManagerVisible, setIsPluginManagerVisible] = useState(false);
  const [performanceResult, setPerformanceResult] =
    useState<PerformanceBenchmarkResult | null>(null);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const exportTreeRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedNode = findNodeById(mindmap, selectedNodeId) ?? mindmap;
  const mindmapLayout = useMemo(() => createMindmapLayout(mindmap), [mindmap]);
  const layoutNodeById = useMemo(
    () =>
      new Map(
        mindmapLayout.nodes.map((layoutNode) => [layoutNode.id, layoutNode]),
      ),
    [mindmapLayout.nodes],
  );
  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );
  const pluginThemes = useMemo(() => getPluginThemes(plugins), [plugins]);
  const availableThemes = useMemo(
    () =>
      Array.from(
        new Map(
          [...MINDMAP_THEMES, ...pluginThemes].map((theme) => [theme.id, theme]),
        ).values(),
      ),
    [pluginThemes],
  );
  const pluginIcons = useMemo(() => getPluginIcons(plugins), [plugins]);
  const availableNodeTypeIcons = useMemo(
    () =>
      Array.from(
        new Map(
          [...NODE_TYPE_ICONS, ...pluginIcons].map((icon) => [
            icon.value,
            icon,
          ]),
        ).values(),
      ),
    [pluginIcons],
  );
  const pluginNodeTypes = useMemo(() => getPluginNodeTypes(plugins), [plugins]);
  const availableNodeTypes = useMemo(
    () =>
      Array.from(
        new Map(
          [...nodeTypes, ...pluginNodeTypes].map((nodeType) => [
            nodeType.id,
            nodeType,
          ]),
        ).values(),
      ),
    [nodeTypes, pluginNodeTypes],
  );
  const canExportTxt = useMemo(
    () => isTxtExportPluginEnabled(plugins),
    [plugins],
  );
  const currentProject = useMemo(
    () => ({ rootNode: mindmap, nodeTypes, themeId }),
    [mindmap, nodeTypes, themeId],
  );
  const themeStyle = createThemeStyle(themeId, availableThemes);
  const panLayerStyle = {
    width: mindmapLayout.width,
    height: mindmapLayout.height,
    transform: `translate(${canvasView.offsetX}px, ${canvasView.offsetY}px) scale(${canvasView.scale})`,
  };
  const searchMatches = useMemo(
    () => findMindmapMatches(mindmap, searchQuery, searchScope),
    [mindmap, searchQuery, searchScope],
  );
  const searchMatchNodeIds = useMemo(
    () => new Set(searchMatches.map((match) => match.nodeId)),
    [searchMatches],
  );
  const activeMatch = searchMatches[activeMatchIndex] ?? null;
  const templateCategories = useMemo(
    () => getTemplateCategories([...OFFICIAL_TEMPLATES, ...templates]),
    [templates],
  );
  const visibleOfficialTemplates = useMemo(
    () =>
      filterAndSortTemplates(OFFICIAL_TEMPLATES, {
        keyword: templateKeyword,
        category: templateCategoryFilter,
        sortMode: templateSortMode,
      }),
    [templateCategoryFilter, templateKeyword, templateSortMode],
  );
  const visibleCustomTemplates = useMemo(
    () =>
      filterAndSortTemplates(templates, {
        keyword: templateKeyword,
        category: templateCategoryFilter,
        sortMode: templateSortMode,
      }),
    [templateCategoryFilter, templateKeyword, templateSortMode, templates],
  );

  useEffect(() => {
    setTemplates(loadMindmapTemplates());
    setPlugins(loadPluginRegistry());

    return () => {
      window.clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!availableThemes.some((theme) => theme.id === themeId)) {
      setThemeId('default-blue');
      showMessage('当前主题来自已禁用或未安装插件，已切回默认主题');
    }
  }, [availableThemes, themeId]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery, searchScope]);

  useEffect(() => {
    if (searchMatches.length > 0 && activeMatchIndex >= searchMatches.length) {
      setActiveMatchIndex(searchMatches.length - 1);
    }
  }, [activeMatchIndex, searchMatches.length]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        return;
      }

      if (!event.ctrlKey) {
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
      }

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  });

  useEffect(() => {
    const stopDrag = () => {
      dragStateRef.current = null;
      setDraggingNodeId(null);
    };

    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const showMessage = (text: string) => {
    window.clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 2400);
  };

  const recordHistory = () => {
    setHistory((currentHistory) => pushHistory(currentHistory, currentProject));
  };

  const selectNode = (nodeId: string, append: boolean) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds((currentSelectedIds) =>
      updateSelection(currentSelectedIds, nodeId, { append }),
    );
    setContextMenu(null);
  };

  const clearSelectionToRoot = () => {
    setSelectedNodeId(mindmap.id);
    setSelectedNodeIds([mindmap.id]);
    setContextMenu(null);
  };

  const applyProject = (project: MindmapProject, nextSelectedNodeId?: string) => {
    const nextThemeId =
      project.themeId && availableThemes.some((theme) => theme.id === project.themeId)
        ? project.themeId
        : 'default-blue';

    setMindmap(project.rootNode);
    setNodeTypes(project.nodeTypes);
    setThemeId(nextThemeId);
    if (project.themeId && project.themeId !== nextThemeId) {
      showMessage('文件使用的插件主题未启用，已切回默认主题');
    }
    const nextPrimaryNodeId =
      nextSelectedNodeId && findNodeById(project.rootNode, nextSelectedNodeId)
        ? nextSelectedNodeId
        : project.rootNode.id;

    setSelectedNodeId(nextPrimaryNodeId);
    setSelectedNodeIds([nextPrimaryNodeId]);
    setEditingNodeId(null);
    setEditingText('');
    setContextMenu(null);
  };

  const handleUndo = () => {
    const result = undoHistory(history, currentProject);

    if (!result) {
      showMessage('没有可撤销的操作');
      return;
    }

    setHistory(result.history);
    applyProject(result.project, selectedNodeId);
    showMessage('已撤销');
  };

  const handleRedo = () => {
    const result = redoHistory(history, currentProject);

    if (!result) {
      showMessage('没有可重做的操作');
      return;
    }

    setHistory(result.history);
    applyProject(result.project, selectedNodeId);
    showMessage('已重做');
  };

  const handleCreateMindmap = () => {
    recordHistory();
    setMindmap(createCenterNode());
    setNodeTypes([]);
    setThemeId('default-blue');
    setSelectedNodeId('root');
    setSelectedNodeIds(['root']);
    setEditingNodeId(null);
    setEditingText('');
    showMessage('已新建空白思维导图');
  };

  const handleSaveMindmap = () => {
    saveMindmapAsLmind(mindmap, 'mindmap.lmind', nodeTypes, themeId);
    showMessage('已生成 mindmap.lmind 文件');
  };

  const handleOpenMindmap = async () => {
    try {
      const openedProject = await openMindmapFromLocalFile();

      if (!openedProject) {
        return;
      }

      recordHistory();
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
    exportMindmapJson(mindmap, nodeTypes, themeId);
    showMessage('已导出 mindmap.json');
  };

  const handleExportTxt = () => {
    exportMindmapTxt(mindmap);
    showMessage('已导出 mindmap.txt');
  };

  const handleInstallPlugin = async () => {
    try {
      const manifest = await readLocalPluginManifest();

      if (!manifest) {
        return;
      }

      const exists = plugins.some(
        (plugin) => plugin.pluginId === manifest.pluginId,
      );

      if (exists && !window.confirm('插件已存在，是否覆盖安装？')) {
        return;
      }

      const nextPlugins = installPluginManifest(plugins, manifest);
      setPlugins(nextPlugins);
      savePluginRegistry(nextPlugins);
      showMessage('插件安装成功');
    } catch {
      showMessage('插件格式不正确');
    }
  };

  const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
    const nextPlugins = setPluginEnabled(plugins, pluginId, enabled);
    setPlugins(nextPlugins);
    savePluginRegistry(nextPlugins);
    showMessage(enabled ? '插件已启用' : '插件已禁用');
  };

  const handleUninstallPlugin = (pluginId: string) => {
    if (!window.confirm('确定要卸载这个插件吗？')) {
      return;
    }

    const nextPlugins = uninstallPlugin(plugins, pluginId);
    setPlugins(nextPlugins);
    savePluginRegistry(nextPlugins);
    showMessage('插件已卸载');
  };

  const handleImportJson = async () => {
    try {
      const importedProject = await importMindmapJson();

      if (!importedProject) {
        return;
      }

      recordHistory();
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

      recordHistory();
      applyProject({ rootNode: importedMindmap, nodeTypes: [], themeId });
      showMessage('已导入 Markdown');
    } catch {
      showMessage('Markdown 格式不正确，无法导入');
    }
  };

  const handleImportExcel = async () => {
    try {
      const preview = await selectExcelImportPreview();

      if (!preview) {
        return;
      }

      setExcelImportPreview(preview);
    } catch (error) {
      if (error instanceof ExcelImportError) {
        showMessage(error.message);
        return;
      }

      showMessage('Excel 格式不正确，无法导入');
    }
  };

  const handleConfirmExcelImport = (
    mapping: ExcelImportMapping,
    rows: RawExcelRow[],
  ) => {
    if (!excelImportPreview) {
      return;
    }

    try {
      const importedMindmap = parseExcelRowsToMindmap(
        rows,
        mapping,
        availableNodeTypes,
      );

      recordHistory();
      applyProject({ rootNode: importedMindmap, nodeTypes, themeId });
      setExcelImportPreview(null);
      showMessage('已导入 Excel');
    } catch (error) {
      if (error instanceof ExcelImportError) {
        showMessage(error.message);
        return;
      }

      showMessage('Excel 格式不正确，无法导入');
    }
  };

  const createTypedNode = (position?: MindmapNode['position']) => {
    const node = createNodeFromType(findNodeTypeById(availableNodeTypes, childNodeTypeId));

    return {
      ...node,
      ...(position ? { position } : {}),
    };
  };

  const createChildNodeForParent = (parent: MindmapNode) =>
    createTypedNode(
      parent.position
        ? {
            x: parent.position.x + POSITIONED_LAYOUT.nodeWidth + 80,
            y: parent.position.y + parent.children.length * 96,
          }
        : undefined,
    );

  const handleAddChild = () => {
    const parentNode = findNodeById(mindmap, selectedNodeId) ?? mindmap;
    const newNode = createChildNodeForParent(parentNode);

    recordHistory();
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNodeId, (node) => ({
        ...node,
        children: [...node.children, newNode],
      })),
    );
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    setEditingNodeId(null);
  };

  const handleAddSibling = () => {
    if (selectedNodeId === mindmap.id) {
      showMessage('中心主题不能新增同级节点');
      return;
    }

    const parentNode = findParentNodeById(mindmap, selectedNodeId);
    const selectedLayoutNode = layoutNodeById.get(selectedNodeId);
    const siblingPosition =
      parentNode?.position && selectedLayoutNode
        ? {
            x: parentNode.position.x,
            y:
              selectedLayoutNode.y - POSITIONED_LAYOUT.canvasPadding + 96,
          }
        : undefined;
    const newNode = createTypedNode(siblingPosition);

    recordHistory();
    setMindmap((currentMindmap) =>
      addSiblingById(currentMindmap, selectedNodeId, newNode),
    );
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    setEditingNodeId(null);
  };

  const handleDeleteNode = () => {
    if (selectedNodeIds.length === 0) {
      showMessage('请先选择节点');
      return;
    }

    const deletableIds = getDeletableSelectedNodeIds(selectedNodeIds, mindmap.id);

    if (deletableIds.length === 0) {
      showMessage('中心主题不能删除');
      return;
    }

    if (
      selectedNodeIds.length > 1 &&
      !window.confirm(`将删除 ${deletableIds.length} 个节点及其子节点，是否继续？`)
    ) {
      return;
    }

    recordHistory();
    setMindmap((currentMindmap) =>
      deleteNodesByIds(currentMindmap, new Set(deletableIds)),
    );
    setSelectedNodeId(mindmap.id);
    setSelectedNodeIds([mindmap.id]);
    setEditingNodeId(null);
    showMessage(
      deletableIds.length > 1 ? `已删除 ${deletableIds.length} 个节点` : '已删除节点',
    );
  };

  const handleRemarkChange = (remark: string) => {
    recordHistory();
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNode.id, (node) => ({
        ...node,
        remark,
      })),
    );
  };

  const handleStartEdit = (node: MindmapNode) => {
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setEditingNodeId(node.id);
    setEditingText(node.text);
  };

  const handleCommitEdit = () => {
    if (!editingNodeId) {
      return;
    }

    const nextText = editingText.trim() || '未命名节点';

    recordHistory();
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
    setSelectedNodeIds([searchMatches[normalizedIndex].nodeId]);
  };

  const handleReplaceCurrent = () => {
    if (!searchQuery.trim() || !activeMatch) {
      showMessage('没有可替换的匹配项');
      return;
    }

    recordHistory();
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

    recordHistory();
    setMindmap((currentMindmap) =>
      replaceAllInMindmap(currentMindmap, query, replacementText, searchScope),
    );
    showMessage(`已替换 ${searchMatches.length} 处内容`);
  };

  const handleSaveTemplate = () => {
    const template = createTemplateFromMindmap(
      templateName || mindmap.text,
      templateCategory,
      templateDescription,
      mindmap,
      nodeTypes,
      themeId,
    );
    setTemplates(addMindmapTemplate(template));
    setTemplateName('');
    setTemplateDescription('');
    showMessage('已保存为模板');
  };

  const handleCreateFromTemplate = (template: MindmapTemplate) => {
    recordHistory();
    applyProject(cloneTemplateProject(template));
    setIsTemplateListVisible(false);
    showMessage('已从模板新建思维导图');
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(deleteMindmapTemplate(templateId));
    showMessage('已删除模板');
  };

  const handleGeneratePerformanceMindmap = (
    rootNode: MindmapNode,
    result: PerformanceBenchmarkResult,
  ) => {
    recordHistory();
    applyProject({ rootNode, nodeTypes: [], themeId });
    setPerformanceResult(result);
    setCanvasView(centerCanvasView());
    showMessage(`已生成 ${result.nodeCount} 节点性能测试导图`);
  };

  const handleCreateNodeType = () => {
    const nodeType = createMindmapNodeType(nodeTypeDraft);

    if (!nodeType) {
      showMessage('请先填写节点类型名称');
      return;
    }

    recordHistory();
    setNodeTypes((currentNodeTypes) => [...currentNodeTypes, nodeType]);
    setNodeTypeDraft(createEmptyNodeTypeDraft());
    showMessage('已创建节点类型');
  };

  const handleSelectedNodeTypeChange = (nodeTypeId: string) => {
    if (selectedNodeIds.length === 0) {
      showMessage('请先选择节点');
      return;
    }

    recordHistory();
    const targetNodeIds = selectedNodeIdSet;

    setMindmap((currentMindmap) =>
      applyNodeTypeToNodes(currentMindmap, targetNodeIds, nodeTypeId),
    );
    showMessage(
      targetNodeIds.size > 1
        ? `已为 ${targetNodeIds.size} 个节点切换类型`
        : '已切换当前节点类型',
    );
  };

  const handleThemeChange = (nextThemeId: string) => {
    recordHistory();
    setThemeId(nextThemeId);
    showMessage('已切换主题');
  };

  const handleToggleCollapse = (nodeId: string) => {
    recordHistory();
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, nodeId, (node) => ({
        ...node,
        collapsed: !node.collapsed,
      })),
    );
  };

  const handleExpandAll = () => {
    recordHistory();
    setMindmap((currentMindmap) => setAllNodesCollapsed(currentMindmap, false));
    showMessage('已展开全部');
  };

  const handleCollapseAll = () => {
    recordHistory();
    setMindmap((currentMindmap) => setAllNodesCollapsed(currentMindmap, true));
    showMessage('已折叠全部');
  };

  const handleResetAutoLayout = () => {
    recordHistory();
    setMindmap((currentMindmap) => clearMindmapPositions(currentMindmap));
    showMessage('已重新自动布局');
  };

  const handleExportImage = async (format: 'png' | 'jpg') => {
    if (!exportTreeRef.current) {
      showMessage('当前没有可导出的画布内容');
      return;
    }

    try {
      await exportMindmapAsImage(exportTreeRef.current, format);
      showMessage(format === 'png' ? '已导出 mindmap.png' : '已导出 mindmap.jpg');
    } catch {
      showMessage('图片导出失败，请稍后重试');
    }
  };

  const handleCanvasPointerDown = (
    event: MouseEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest('.mindmap-node, .collapse-toggle, button, input, textarea, select')) {
      return;
    }

    clearSelectionToRoot();
    isPanningRef.current = true;
    lastPanPointRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleCanvasPointerMove = (
    event: MouseEvent<HTMLElement>,
  ) => {
    if (dragStateRef.current) {
      const dragState = dragStateRef.current;
      const pointerDeltaX = event.clientX - dragState.pointerStart.x;
      const pointerDeltaY = event.clientY - dragState.pointerStart.y;

      if (!dragState.hasRecordedHistory) {
        if (Math.hypot(pointerDeltaX, pointerDeltaY) < 3) {
          return;
        }

        recordHistory();
        dragState.hasRecordedHistory = true;
        setDraggingNodeId(dragState.nodeId);
      }

      const nextPosition = {
        x: dragState.nodeStart.x + pointerDeltaX / canvasView.scale,
        y: dragState.nodeStart.y + pointerDeltaY / canvasView.scale,
      };

      setMindmap((currentMindmap) =>
        setNodePositionById(currentMindmap, dragState.nodeId, nextPosition),
      );
      return;
    }

    if (!isPanningRef.current) {
      return;
    }

    const deltaX = event.clientX - lastPanPointRef.current.x;
    const deltaY = event.clientY - lastPanPointRef.current.y;
    lastPanPointRef.current = { x: event.clientX, y: event.clientY };
    setCanvasView((view) => panCanvasView(view, deltaX, deltaY));
  };

  const stopCanvasPan = () => {
    isPanningRef.current = false;
  };

  const handleStartNodeDrag = (
    nodeId: string,
    event: MouseEvent<HTMLElement>,
  ) => {
    const layoutNode = layoutNodeById.get(nodeId);
    const node = findNodeById(mindmap, nodeId);

    if (!layoutNode || !node) {
      return;
    }

    isPanningRef.current = false;
    dragStateRef.current = {
      nodeId,
      pointerStart: { x: event.clientX, y: event.clientY },
      nodeStart: node.position ?? {
        x: layoutNode.x - POSITIONED_LAYOUT.canvasPadding,
        y: layoutNode.y - POSITIONED_LAYOUT.canvasPadding,
      },
      hasRecordedHistory: false,
    };
  };

  const handleCanvasWheel = (event: WheelEvent<HTMLElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    setCanvasView((view) => zoomCanvasView(view, event.deltaY < 0 ? 'in' : 'out'));
  };

  const openContextMenu = (
    nextContextMenu: ContextMenuInput,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 220;
    const menuHeight = nextContextMenu.type === 'node' ? 360 : 280;
    setContextMenu({
      ...nextContextMenu,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
    } as ContextMenuState);
  };

  const handleNodeContextMenu = (
    node: MindmapNode,
    event: MouseEvent<HTMLElement>,
  ) => {
    selectNode(node.id, event.ctrlKey || event.shiftKey);
    openContextMenu({ type: 'node', nodeId: node.id }, event);
  };

  const handleCanvasContextMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest('.mindmap-node, .collapse-toggle')) {
      return;
    }

    openContextMenu({ type: 'canvas' }, event);
  };

  const closeContextMenu = () => setContextMenu(null);

  const runContextMenuAction = (action: () => void) => {
    action();
    closeContextMenu();
  };

  const handleCopySelectedNodeText = async () => {
    const text = selectedNode.text;

    try {
      await navigator.clipboard.writeText(text);
      showMessage('已复制节点文本');
    } catch {
      window.prompt('复制失败，请手动复制节点文本', text);
      showMessage('浏览器限制了自动复制');
    }
  };

  return (
    <main
      className="app-shell"
      style={themeStyle}
      onMouseDown={() => setContextMenu(null)}
    >
      <header className="app-header" aria-labelledby="app-title">
        <div className="app-title-group">
          <p className="eyebrow">Local Mindmap</p>
          <h1 id="app-title">本地化思维导图工具</h1>
        </div>
        <div className="toolbar-group" aria-label="文件">
          <span className="toolbar-label">文件</span>
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
        </div>
        <div className="toolbar-group" aria-label="导入导出">
          <span className="toolbar-label">导入导出</span>
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
            onClick={() => handleExportImage('png')}
          >
            导出 PNG
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => handleExportImage('jpg')}
          >
            导出 JPG
          </button>
          {canExportTxt ? (
            <button
              type="button"
              className="secondary-action"
              onClick={handleExportTxt}
            >
              导出 TXT
            </button>
          ) : null}
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
        </div>
        <div className="toolbar-group" aria-label="工具">
          <span className="toolbar-label">工具</span>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setIsPluginManagerVisible(true)}
          >
            插件管理
          </button>
        </div>
      </header>

      <section className="node-toolbar" aria-label="节点操作">
        <span className="toolbar-label">节点操作</span>
        <span className="selection-count">
          已选 {selectedNodeIds.length} 个
        </span>
        <button type="button" className="secondary-action" onClick={handleUndo}>
          撤销
        </button>
        <button type="button" className="secondary-action" onClick={handleRedo}>
          重做
        </button>
        <label className="inline-control">
          子节点类型
          <select
            value={childNodeTypeId}
            onChange={(event) => setChildNodeTypeId(event.target.value)}
          >
            <option value="">普通节点</option>
            {availableNodeTypes.map((nodeType) => (
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
        <button type="button" className="secondary-action" onClick={handleExpandAll}>
          展开全部
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleCollapseAll}
        >
          折叠全部
        </button>
        <label className="inline-control">
          当前节点类型
          <select
            value={selectedNode.nodeTypeId ?? ''}
            onChange={(event) => handleSelectedNodeTypeChange(event.target.value)}
          >
            <option value="">普通节点</option>
            {availableNodeTypes.map((nodeType) => (
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

      <section className="feature-panel" aria-label="画布和主题">
        <div className="panel-heading">
          <h2>画布与主题</h2>
          <span className="panel-note">{Math.round(canvasView.scale * 100)}%</span>
        </div>
        <div className="compact-form">
          <button
            type="button"
            className="secondary-action"
            onClick={() => setCanvasView((view) => zoomCanvasView(view, 'in'))}
          >
            放大
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setCanvasView((view) => zoomCanvasView(view, 'out'))}
          >
            缩小
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setCanvasView(centerCanvasView())}
          >
          一键居中
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleResetAutoLayout}
          >
            重新自动布局
          </button>
          <label className="inline-control">
            主题
            <select
              value={themeId}
              onChange={(event) => handleThemeChange(event.target.value)}
            >
              {availableThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <PerformancePanel
        rootNode={mindmap}
        nodeTypes={nodeTypes}
        themeId={themeId}
        canExportTxt={canExportTxt}
        result={performanceResult}
        onGenerate={handleGeneratePerformanceMindmap}
        onResultChange={setPerformanceResult}
        onMessage={showMessage}
      />

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

        <div className="template-save-form">
          <input
            type="text"
            value={templateName}
            placeholder="模板名称"
            onChange={(event) => setTemplateName(event.target.value)}
          />
          <input
            type="text"
            value={templateCategory}
            placeholder="模板分类"
            onChange={(event) => setTemplateCategory(event.target.value)}
          />
          <textarea
            value={templateDescription}
            placeholder="模板备注"
            onChange={(event) => setTemplateDescription(event.target.value)}
          />
        </div>

        {isTemplateListVisible ? (
          <div className="template-manager">
            <div className="compact-form">
              <input
                type="search"
                value={templateKeyword}
                placeholder="搜索模板"
                onChange={(event) => setTemplateKeyword(event.target.value)}
              />
              <select
                value={templateSortMode}
                onChange={(event) =>
                  setTemplateSortMode(event.target.value as TemplateSortMode)
                }
              >
                <option value="preset-asc">预设顺序</option>
                <option value="created-desc">创建时间倒序</option>
                <option value="created-asc">创建时间正序</option>
                <option value="name-asc">按名称排序</option>
              </select>
              <select
                value={templateCategoryFilter}
                onChange={(event) => setTemplateCategoryFilter(event.target.value)}
              >
                <option value="">全部分类</option>
                {templateCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="template-group">
              <div className="template-group-heading">
                <h3>官方默认模板</h3>
                <span>{visibleOfficialTemplates.length} 个模板</span>
              </div>
              <div className="template-list">
                {visibleOfficialTemplates.length === 0 ? (
                  <p className="empty-note">暂无匹配的官方模板</p>
                ) : (
                  visibleOfficialTemplates.map((template) => (
                    <div className="template-item" key={template.id}>
                      <div className="template-thumbnail" aria-hidden="true">
                        {template.thumbnail.split('\n').map((line, index) => (
                          <span key={`${template.id}-${index}`}>{line}</span>
                        ))}
                      </div>
                      <div>
                        <strong>{template.name}</strong>
                        <span>分类：{template.category}</span>
                        <span>预设顺序：{template.presetOrder}</span>
                        {template.description ? (
                          <p className="template-description">
                            {template.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => handleCreateFromTemplate(template)}
                      >
                        使用
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="template-group">
              <div className="template-group-heading">
                <h3>我的自定义模板</h3>
                <span>{visibleCustomTemplates.length} 个模板</span>
              </div>
              <div className="template-list">
                {visibleCustomTemplates.length === 0 ? (
                  <p className="empty-note">暂无自定义模板</p>
                ) : (
                  visibleCustomTemplates.map((template) => (
                    <div className="template-item" key={template.id}>
                      <div className="template-thumbnail" aria-hidden="true">
                        {template.thumbnail.split('\n').map((line, index) => (
                          <span key={`${template.id}-${index}`}>{line}</span>
                        ))}
                      </div>
                      <div>
                        <strong>{template.name}</strong>
                        <span>分类：{template.category}</span>
                        <span>{new Date(template.createTime).toLocaleString()}</span>
                        {template.description ? (
                          <p className="template-description">
                            {template.description}
                          </p>
                        ) : null}
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
            </div>
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
                图标
                <select
                  value={nodeTypeDraft.icon}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      icon: event.target.value,
                    }))
                  }
                >
                  {availableNodeTypeIcons.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-control">
                形状
                <select
                  value={nodeTypeDraft.shape}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      shape: event.target.value as NodeTypeDraft['shape'],
                    }))
                  }
                >
                  {NODE_TYPE_SHAPES.map((shape) => (
                    <option key={shape.value} value={shape.value}>
                      {shape.label}
                    </option>
                  ))}
                </select>
              </label>
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
              <label className="inline-control">
                文字颜色
                <input
                  type="color"
                  value={nodeTypeDraft.textColor}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      textColor: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="inline-control">
                字号
                <input
                  type="number"
                  min={12}
                  max={28}
                  value={nodeTypeDraft.fontSize}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      fontSize: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="inline-control">
                加粗
                <input
                  type="checkbox"
                  checked={nodeTypeDraft.bold}
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      bold: event.target.checked,
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
                        color: nodeType.textColor,
                      }}
                    >
                      {nodeType.icon}
                    </span>
                    <strong>{nodeType.name}</strong>
                    <span>
                      {nodeType.shape} · {nodeType.fontSize}px ·{' '}
                      {nodeType.bold ? '加粗' : '常规'} · {nodeType.defaultText}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="workspace-layout">
        <section
          className="mindmap-canvas"
          aria-label="思维导图画布"
          onMouseDown={handleCanvasPointerDown}
          onMouseMove={handleCanvasPointerMove}
          onMouseUp={stopCanvasPan}
          onMouseLeave={stopCanvasPan}
          onWheel={handleCanvasWheel}
          onContextMenu={handleCanvasContextMenu}
        >
          <div className="canvas-grid" aria-hidden="true" />
          <div className="mindmap-pan-layer" style={panLayerStyle}>
            <div
              className="mindmap-tree"
              style={{
                width: mindmapLayout.width,
                height: mindmapLayout.height,
              }}
              ref={exportTreeRef}
            >
              <svg
                className="mindmap-lines"
                width={mindmapLayout.width}
                height={mindmapLayout.height}
                aria-hidden="true"
              >
                {mindmapLayout.lines.map((line) => {
                  const middleX = (line.from.x + line.to.x) / 2;

                  return (
                    <path
                      key={line.id}
                      d={`M ${line.from.x} ${line.from.y} C ${middleX} ${line.from.y}, ${middleX} ${line.to.y}, ${line.to.x} ${line.to.y}`}
                    />
                  );
                })}
              </svg>
              {mindmapLayout.nodes.map((layoutNode) => (
                <MindmapTree
                  key={layoutNode.id}
                  layoutNode={layoutNode}
                  nodeTypes={availableNodeTypes}
                  selectedNodeId={selectedNodeId}
                  selectedNodeIds={selectedNodeIdSet}
                  draggingNodeId={draggingNodeId}
                  editingNodeId={editingNodeId}
                  editingText={editingText}
                  searchMatchNodeIds={searchMatchNodeIds}
                  onToggleCollapse={handleToggleCollapse}
                  onSelectNode={selectNode}
                  onStartEdit={handleStartEdit}
                  onEditingTextChange={setEditingText}
                  onCommitEdit={handleCommitEdit}
                  onStartDrag={handleStartNodeDrag}
                  onOpenContextMenu={handleNodeContextMenu}
                />
              ))}
            </div>
          </div>
        </section>

        <RemarkPanel
          selectedNode={selectedNode}
          mode={remarkMode}
          onModeChange={setRemarkMode}
          onRemarkChange={handleRemarkChange}
        />
      </div>

      {excelImportPreview ? (
        <ExcelImportMappingDialog
          preview={excelImportPreview}
          onCancel={() => setExcelImportPreview(null)}
          onConfirm={handleConfirmExcelImport}
        />
      ) : null}

      {isPluginManagerVisible ? (
        <PluginManagerPanel
          plugins={plugins}
          onClose={() => setIsPluginManagerVisible(false)}
          onInstall={handleInstallPlugin}
          onToggle={handleTogglePlugin}
          onUninstall={handleUninstallPlugin}
        />
      ) : null}

      {contextMenu ? (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenu.type === 'node' ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleAddChild)}
              >
                新增子节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleAddSibling)}
              >
                新增同级节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(() => handleStartEdit(selectedNode))}
              >
                编辑节点
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger-menu-item"
                onClick={() => runContextMenuAction(handleDeleteNode)}
              >
                删除节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleCopySelectedNodeText)}
              >
                复制节点文本
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(() => handleToggleCollapse(selectedNode.id))}
              >
                {selectedNode.collapsed ? '展开' : '折叠'}
              </button>
              <label className="context-menu-select">
                切换节点类型
                <select
                  value={selectedNode.nodeTypeId ?? ''}
                  onChange={(event) =>
                    runContextMenuAction(() =>
                      handleSelectedNodeTypeChange(event.target.value),
                    )
                  }
                >
                  <option value="">普通节点</option>
                  {availableNodeTypes.map((nodeType) => (
                    <option key={nodeType.id} value={nodeType.id}>
                      {nodeType.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleResetAutoLayout)}
              >
                重新自动布局
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleCreateMindmap)}
              >
                新建思维导图
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  runContextMenuAction(() => setCanvasView(centerCanvasView()))
                }
              >
                一键居中
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleResetAutoLayout)}
              >
                重新自动布局
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleExpandAll)}
              >
                展开全部
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleCollapseAll)}
              >
                折叠全部
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(() => void handleExportImage('png'))}
              >
                导出 PNG
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(() => void handleExportImage('jpg'))}
              >
                导出 JPG
              </button>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
