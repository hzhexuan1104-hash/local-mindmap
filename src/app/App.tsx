import {
  type CSSProperties,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CanvasControls } from './components/CanvasControls';
import {
  LeftResourcePanel,
  type ResourceView,
} from './components/LeftResourcePanel';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import {
  TopMenuBar,
  type TopMenuGroup,
} from './components/TopMenuBar';
import {
  centerCanvasView,
  DEFAULT_CANVAS_VIEW,
  panCanvasView,
  zoomCanvasView,
  type CanvasViewState,
} from '../features/mindmap/canvasControls';
import {
  getBoxSelectionGeometry,
  hitTestNodesInRect,
  isCanvasInteractionBlockedTarget,
  isDragPastThreshold,
  screenPointToWorldPoint,
  screenToCanvasPoint,
  shouldStartCanvasPan,
  shouldStartBoxSelection,
  type Point,
  type Rect,
} from '../features/mindmap/boxSelection';
import {
  collectNodeIds,
  collectSelectedSubtrees,
  cutNodesSafely,
  duplicateNodeAsSibling,
  pasteNodesAsChildren,
  validateTreeIntegrity,
} from '../features/mindmap/clipboard';
import { ExcelImportMappingDialog } from '../features/mindmap/ExcelImportMappingDialog';
import { createMindmapExcelBytes } from '../features/mindmap/exportExcel';
import { createMindmapImageBytes } from '../features/mindmap/exportImage';
import { serializeMindmapMarkdown } from '../features/mindmap/exportMarkdown';
import { serializeMindmapTxt } from '../features/mindmap/exportTxt';
import { selectLocalFile } from '../features/mindmap/fileUtils';
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
import { getKeyboardShortcutAction } from '../features/mindmap/keyboardShortcuts';
import {
  createEmptyNodeTypeDraft,
  createMindmapNodeType,
  findNodeTypeById,
  loadAllUserNodeTypes,
  NODE_TYPE_ICONS,
  NODE_TYPE_SHAPES,
  saveImportedNodeTypePack,
  saveLocalNodeTypes,
  type NodeTypeDraft,
} from '../features/mindmap/nodeTypes';
import { updateNodePositionById } from '../features/mindmap/nodePositions';
import {
  createNodeTypePack,
  exportNodeTypesToPack,
  importNodeTypesFromPack,
  parseNodeTypePack,
} from '../features/mindmap/nodeTypePacks';
import { parseLmindProject } from '../features/mindmap/openMindmap';
import { OFFICIAL_TEMPLATES } from '../features/mindmap/officialTemplates';
import { PerformancePanel } from '../features/mindmap/PerformancePanel';
import type { PerformanceBenchmarkResult } from '../features/mindmap/performanceTest';
import { PluginManagerPanel } from '../features/mindmap/PluginManagerPanel';
import {
  getPluginIcons,
  getPluginMenuGroups,
  getPluginNodeTypes,
  getPluginTemplates,
  getPluginThemes,
  createPluginOverwritePrompt,
  installPlugin,
  isTxtExportPluginEnabled,
  loadPluginRegistry,
  readLocalPluginManifest,
  savePluginRegistry,
  setPluginEnabled,
  uninstallPlugin,
  PluginManifestError,
  type PluginManifest,
} from '../features/mindmap/plugins';
import {
  executePluginCommand,
  type PluginCommandHandlers,
} from '../features/plugins/pluginCommands';
import { serializeLmindDocument } from '../features/mindmap/saveMindmap';
import {
  openFileLocation,
  openLocalTextFile,
  readLocalTextFile,
  sanitizeFileName,
  saveLocalFile,
  type LocalFileResult,
} from '../features/mindmap/localFileOperations';
import {
  loadRecentFileEntries,
  updateRecentFile,
  type RecentFileEntry,
} from '../features/mindmap/recentFiles';
import {
  findNextMatchIndex,
  findMindmapMatches,
  replaceAllInMindmap,
  replaceMatchInMindmap,
  type SearchMatch,
  type SearchScope,
} from '../features/mindmap/searchReplace';
import {
  applyNodeTypeToNodes,
  deleteNodesByIds,
  getDeletableSelectedNodeIds,
  resolveBoxSelectionState,
  resolveNodeClickSelection,
} from '../features/mindmap/selection';
import {
  cloneTemplateProject,
  createTemplateFromMindmap,
  filterAndSortTemplates,
  getTemplateCategories,
  loadAllUserTemplates,
  saveImportedTemplatePack,
  saveMindmapTemplates,
  type MindmapTemplate,
  type TemplateSortMode,
} from '../features/mindmap/templates';
import {
  exportTemplatesToPack,
  importTemplatesFromPack,
  parseTemplatePack,
} from '../features/mindmap/templatePacks';
import { createThemeStyle, MINDMAP_THEMES } from '../features/mindmap/themes';
import {
  isDescendant as isTreeDescendant,
  moveNodeAsChild,
} from '../features/mindmap/treeOperations';
import {
  addTypedChildNode,
  addTypedSiblingNode,
  getNodeTypeCreationOptions,
  type TypedNodeCreationResult,
} from '../features/mindmap/typedNodeCreation';
import {
  ensureUserDataDirs,
  getUserDataDir,
  installPluginToUserDir,
  isDesktopRuntime,
  migrateLegacyLocalStorageToUserData,
  openUserDataDir,
  openPluginDir,
  openPluginManifestDir,
  resolveUserDataPath,
  uninstallPluginFromUserDir,
} from '../features/storage/userDataStorage';
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

const getErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string' && error.trim()
    ? error
    : error instanceof Error && error.message
      ? error.message
      : fallback;

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

type InternalClipboardState = {
  mode: 'copy' | 'cut';
  nodes: MindmapNode[];
  sourceNodeIds: string[];
};

type BoxSelectionState = {
  screenStart: Point;
  screenCurrent: Point;
  canvasStart: Point;
  canvasCurrent: Point;
  append: boolean;
  isActive: boolean;
};

type CanvasPanState = {
  screenStart: Point;
  lastScreenPoint: Point;
  hasMoved: boolean;
};

type ToolDrawer = ResourceView;

type MindmapTreeProps = {
  layoutNode: MindmapLayoutNode;
  isRoot: boolean;
  nodeTypes: MindmapNodeType[];
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  boxSelectionPreviewIds: Set<string>;
  draggingNodeId: string | null;
  dropTargetNodeId: string | null;
  editingNodeId: string | null;
  editingText: string;
  searchMatchNodeIds: Set<string>;
  activeSearchMatch: SearchMatch | null;
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
  isRoot,
  nodeTypes,
  selectedNodeId,
  selectedNodeIds,
  boxSelectionPreviewIds,
  draggingNodeId,
  dropTargetNodeId,
  editingNodeId,
  editingText,
  searchMatchNodeIds,
  activeSearchMatch,
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
  const isBoxSelectionPreview = boxSelectionPreviewIds.has(node.id);
  const isPrimarySelected = isSelected && node.id === selectedNodeId;
  const isDropTarget = node.id === dropTargetNodeId;
  const isEditing = node.id === editingNodeId;
  const isSearchMatch = searchMatchNodeIds.has(node.id);
  const activeTextMatch =
    activeSearchMatch?.nodeId === node.id && activeSearchMatch.field === 'text'
      ? activeSearchMatch
      : null;
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
            isBoxSelectionPreview ? 'is-box-selection-preview' : '',
            isPrimarySelected ? 'is-primary-selected' : '',
            draggingNodeId === node.id ? 'is-dragging' : '',
            isDropTarget ? 'is-drop-target' : '',
            isSearchMatch ? 'is-search-match' : '',
            isRoot ? 'is-root' : '',
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
              <span>
                {activeTextMatch ? (
                  <>
                    {node.text.slice(0, activeTextMatch.start)}
                    <mark className="node-search-highlight">
                      {node.text.slice(activeTextMatch.start, activeTextMatch.end)}
                    </mark>
                    {node.text.slice(activeTextMatch.end)}
                  </>
                ) : (
                  node.text
                )}
              </span>
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
  const [userNodeTypes, setUserNodeTypes] = useState<MindmapNodeType[]>([]);
  const [themeId, setThemeId] = useState('default-blue');
  const [history, setHistory] = useState<HistoryState>(createHistoryState);
  const [canvasView, setCanvasView] =
    useState<CanvasViewState>(DEFAULT_CANVAS_VIEW);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [remarkMode, setRemarkMode] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState('');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isDocumentDirty, setIsDocumentDirty] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [excelImportPreview, setExcelImportPreview] =
    useState<ExcelImportPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [templates, setTemplates] = useState<MindmapTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('未分类');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('');
  const [templateSortMode, setTemplateSortMode] =
    useState<TemplateSortMode>('created-desc');
  const [childNodeTypeId, setChildNodeTypeId] = useState('');
  const [siblingNodeTypeId, setSiblingNodeTypeId] = useState('');
  const [nodeTypeDraft, setNodeTypeDraft] = useState<NodeTypeDraft>(
    createEmptyNodeTypeDraft,
  );
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [lastPluginInstallError, setLastPluginInstallError] = useState('');
  const [userDataDir, setUserDataDir] = useState('浏览器本地存储');
  const [isDesktopApp] = useState(isDesktopRuntime);
  const [isPluginManagerVisible, setIsPluginManagerVisible] = useState(false);
  const [performanceResult, setPerformanceResult] =
    useState<PerformanceBenchmarkResult | null>(null);
  const [activeDrawer, setActiveDrawer] =
    useState<ToolDrawer | null>('templates');
  const [isRemarkPanelCollapsed, setIsRemarkPanelCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [internalClipboard, setInternalClipboard] =
    useState<InternalClipboardState | null>(null);
  const [boxSelection, setBoxSelection] = useState<BoxSelectionState | null>(null);
  const [boxSelectionPreviewIds, setBoxSelectionPreviewIds] = useState<string[]>([]);
  const [isShortcutHelpVisible, setIsShortcutHelpVisible] = useState(false);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const exportTreeRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const panLayerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const canvasPanStateRef = useRef<CanvasPanState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pluginReloadRequestRef = useRef(0);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedNode = selectedNodeId
    ? findNodeById(mindmap, selectedNodeId) ?? mindmap
    : mindmap;
  const mindmapLayout = useMemo(() => createMindmapLayout(mindmap), [mindmap]);
  const nodeHitboxes = useMemo(
    () =>
      mindmapLayout.nodes.map((layoutNode) => ({
        id: layoutNode.id,
        left: layoutNode.x,
        top: layoutNode.y,
        width: POSITIONED_LAYOUT.nodeWidth,
        height: POSITIONED_LAYOUT.nodeHeight,
      })),
    [mindmapLayout.nodes],
  );
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
  const boxSelectionPreviewIdSet = useMemo(
    () => new Set(boxSelectionPreviewIds),
    [boxSelectionPreviewIds],
  );
  const allNodeIds = useMemo(() => Array.from(collectNodeIds(mindmap)), [mindmap]);
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
  const nodeTypeCreationOptions = useMemo(
    () => getNodeTypeCreationOptions(availableNodeTypes),
    [availableNodeTypes],
  );
  const canExportTxt = useMemo(
    () => isTxtExportPluginEnabled(plugins),
    [plugins],
  );
  const pluginTemplates = useMemo(
    () => getPluginTemplates(plugins),
    [plugins],
  );
  const availableOfficialTemplates = useMemo(
    () => [...OFFICIAL_TEMPLATES, ...pluginTemplates],
    [pluginTemplates],
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
  const boxSelectionRect = useMemo(() => {
    if (!boxSelection?.isActive || !canvasRef.current) {
      return null;
    }

    const viewportRect = canvasRef.current.getBoundingClientRect();
    const worldViewportRect = panLayerRef.current?.getBoundingClientRect();

    return getBoxSelectionGeometry({
      screenStart: boxSelection.screenStart,
      screenCurrent: boxSelection.screenCurrent,
      canvasViewportRect: viewportRect,
      worldViewportRect,
      canvasView,
      scrollOffset: {
        x: canvasRef.current.scrollLeft,
        y: canvasRef.current.scrollTop,
      },
    }).viewportRect;
  }, [boxSelection, canvasView]);
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
    () => getTemplateCategories([...availableOfficialTemplates, ...templates]),
    [availableOfficialTemplates, templates],
  );
  const visibleOfficialTemplates = useMemo(
    () =>
      filterAndSortTemplates(availableOfficialTemplates, {
        keyword: templateKeyword,
        category: templateCategoryFilter,
        sortMode: templateSortMode,
      }),
    [
      availableOfficialTemplates,
      templateCategoryFilter,
      templateKeyword,
      templateSortMode,
    ],
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
  const drawerTitle = {
    templates: '模板库',
    'node-types': '节点类型',
    search: '查找替换',
    performance: '性能测试',
    plugins: '插件管理',
    settings: '设置',
  } as const;

  useEffect(() => {
    let isActive = true;

    void (async () => {
      console.info('[user-data] runtime detected', {
        desktop: isDesktopApp,
      });
      const migration = await migrateLegacyLocalStorageToUserData();

      try {
        await ensureUserDataDirs();
        const [
          templatesResult,
          initialPluginsResult,
          nodeTypesResult,
          userDataDirResult,
          recentFilesResult,
        ] = await Promise.allSettled([
            loadAllUserTemplates(),
            loadPluginRegistry({
              allowRegistryFallback: migration.migrated,
            }),
            loadAllUserNodeTypes(),
            getUserDataDir(),
            loadRecentFileEntries(),
        ]);
        let pluginsResult = initialPluginsResult;
        let pluginStorageSyncFailed = false;

        if (
          isDesktopApp &&
          migration.migrated &&
          initialPluginsResult.status === 'fulfilled'
        ) {
          try {
            for (const plugin of initialPluginsResult.value.filter(
              (item) => !item.builtIn,
            )) {
              await installPluginToUserDir(plugin, true);
            }
            await savePluginRegistry(initialPluginsResult.value);
          } catch {
            pluginStorageSyncFailed = true;
          }
          try {
            pluginsResult = {
              status: 'fulfilled',
              value: await loadPluginRegistry(),
            };
          } catch (error) {
            pluginsResult = { status: 'rejected', reason: error };
          }
        }

        if (!isActive) {
          return;
        }

        const loadFailures: string[] = [];
        if (templatesResult.status === 'fulfilled') {
          setTemplates(templatesResult.value);
        } else {
          loadFailures.push('templates');
          console.error(
            '[user-data][templates] startup load failed',
            templatesResult.reason,
          );
        }
        if (pluginsResult.status === 'fulfilled') {
          setPlugins(pluginsResult.value);
        } else {
          loadFailures.push('plugins');
          console.error(
            '[user-data][plugins] startup load failed',
            pluginsResult.reason,
          );
        }
        if (nodeTypesResult.status === 'fulfilled') {
          setNodeTypes(nodeTypesResult.value);
          setUserNodeTypes(nodeTypesResult.value);
          console.info('[user-data][node-types] applied to UI state', {
            count: nodeTypesResult.value.length,
            names: nodeTypesResult.value.map((nodeType) => nodeType.name),
          });
        } else {
          loadFailures.push('nodeTypes');
          console.error(
            '[user-data][node-types] startup load failed',
            nodeTypesResult.reason,
          );
        }
        if (userDataDirResult.status === 'fulfilled') {
          setUserDataDir(userDataDirResult.value);
        } else {
          loadFailures.push('userDataDir');
          console.error(
            '[user-data] user data directory lookup failed',
            userDataDirResult.reason,
          );
        }
        if (recentFilesResult.status === 'fulfilled') {
          setRecentFiles(recentFilesResult.value);
        } else {
          loadFailures.push('recentFiles');
          console.error(
            '[user-data][recent-files] startup load failed',
            recentFilesResult.reason,
          );
        }

        if (migration.migrated) {
          showMessage(`已迁移 ${migration.migratedKeys.length} 项旧版用户数据`);
        } else if (migration.error) {
          console.error('[user-data] localStorage migration failed', migration.error);
          showMessage('用户数据迁移失败，未读取旧 localStorage');
        } else if (pluginStorageSyncFailed) {
          showMessage('插件用户目录同步失败，已保留当前可用状态');
        } else if (loadFailures.length > 0) {
          showMessage(`用户数据读取失败：${loadFailures.join(', ')}`);
        }
      } catch (error) {
        if (isActive) {
          console.error('[user-data] startup initialization failed', error);
          showMessage(getErrorMessage(error, '用户数据目录初始化失败，应用仍可继续使用'));
        }
      }
    })();

    return () => {
      isActive = false;
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
    if (!activeMatch) {
      return;
    }

    setSelectedNodeId(activeMatch.nodeId);
    setSelectedNodeIds([activeMatch.nodeId]);

    if (activeMatch.field === 'remark') {
      setIsRemarkPanelCollapsed(false);
      setRemarkMode('edit');
    }
  }, [
    activeMatch?.end,
    activeMatch?.field,
    activeMatch?.nodeId,
    activeMatch?.start,
  ]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const action = getKeyboardShortcutAction(event, {
        hasModalOpen: Boolean(excelImportPreview || isPluginManagerVisible || isShortcutHelpVisible),
        hasContextMenuOpen: Boolean(contextMenu),
        isBoxSelecting: Boolean(boxSelection),
        hasSelection: selectedNodeIds.length > 0,
      });

      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action) {
        case 'close-or-clear':
          handleEscapeShortcut();
          return;
        case 'delete':
          handleDeleteNode();
          return;
        case 'undo':
          handleUndo();
          return;
        case 'redo':
          handleRedo();
          return;
        case 'copy':
          handleCopyNodes();
          return;
        case 'cut':
          handleCutNodes();
          return;
        case 'paste':
          handlePasteNodes();
          return;
        case 'duplicate':
          handleDuplicateNodeAsSibling();
          return;
        case 'select-all':
          handleSelectAllNodes();
          return;
        case 'save':
          handleSaveMindmap();
          return;
        case 'open':
          void handleOpenMindmap();
          return;
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  });

  useEffect(() => {
    const stopDrag = () => {
      dragStateRef.current = null;
      canvasPanStateRef.current = null;
      isPanningRef.current = false;
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
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
    setIsDocumentDirty(true);
  };

  const selectNode = (nodeId: string, append: boolean) => {
    const nextSelection = resolveNodeClickSelection(
      {
        selectedNodeId,
        selectedNodeIds,
      },
      nodeId,
      append,
    );

    setSelectedNodeId(nextSelection.selectedNodeId);
    setSelectedNodeIds(nextSelection.selectedNodeIds);
    setContextMenu(null);
  };

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setContextMenu(null);
  };

  const handleSelectAllNodes = () => {
    const nextSelectedNodeIds = allNodeIds;

    if (nextSelectedNodeIds.length === 0) {
      return;
    }

    setSelectedNodeId(nextSelectedNodeIds[0]);
    setSelectedNodeIds(nextSelectedNodeIds);
    setContextMenu(null);
    showMessage(`已全选 ${nextSelectedNodeIds.length} 个节点`);
  };

  const cancelBoxSelection = () => {
    setBoxSelection(null);
    setBoxSelectionPreviewIds([]);
  };

  const handleEscapeShortcut = () => {
    if (excelImportPreview) {
      setExcelImportPreview(null);
      return;
    }

    if (isPluginManagerVisible) {
      setIsPluginManagerVisible(false);
      return;
    }

    if (isShortcutHelpVisible) {
      setIsShortcutHelpVisible(false);
      return;
    }

    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    if (boxSelection) {
      cancelBoxSelection();
      return;
    }

    if (dragStateRef.current) {
      dragStateRef.current = null;
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
      return;
    }

    clearSelection();
  };

  const applyProject = (
    project: MindmapProject,
    nextSelectedNodeId?: string | null,
  ) => {
    const nextThemeId =
      project.themeId && availableThemes.some((theme) => theme.id === project.themeId)
        ? project.themeId
        : 'default-blue';

    setMindmap(project.rootNode);
    setNodeTypes(
      importNodeTypesFromPack(
        project.nodeTypes,
        createNodeTypePack(userNodeTypes),
      ).nodeTypes,
    );
    setThemeId(nextThemeId);
    if (project.themeId && project.themeId !== nextThemeId) {
      showMessage('文件使用的插件主题未启用，已切回默认主题');
    }
    const nextPrimaryNodeId =
      nextSelectedNodeId && findNodeById(project.rootNode, nextSelectedNodeId)
        ? nextSelectedNodeId
        : null;

    setSelectedNodeId(nextPrimaryNodeId);
    setSelectedNodeIds(nextPrimaryNodeId ? [nextPrimaryNodeId] : []);
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
    setNodeTypes(userNodeTypes);
    setThemeId('default-blue');
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setEditingNodeId(null);
    setEditingText('');
    setCurrentFilePath(null);
    setCurrentFileName(null);
    setIsDocumentDirty(true);
    showMessage('已新建空白思维导图');
  };

  const showFileResult = (
    result: LocalFileResult,
    desktopVerb: string,
  ) => {
    showMessage(
      result.kind === 'desktop'
        ? `${desktopVerb}：${result.path}`
        : `已下载 ${result.fileName}，请在浏览器下载目录查看。`,
    );
  };

  const rememberRecentFile = async (
    path: string,
    action: 'open' | 'save',
  ) => {
    const next = await updateRecentFile(recentFiles, path, action);
    setRecentFiles(next);
  };

  const saveMindmap = async (saveAs: boolean) => {
    try {
      const result = await saveLocalFile({
        content: serializeLmindDocument(mindmap, nodeTypes, themeId),
        defaultFileName: `${sanitizeFileName(mindmap.text)}.lmind`,
        mimeType: 'application/json;charset=utf-8',
        filterName: 'Local Mindmap 工程文件',
        extensions: ['lmind'],
        currentPath: currentFilePath,
        forceDialog: saveAs,
      });

      if (!result) {
        showMessage('保存已取消。');
        return;
      }
      if (result.kind === 'desktop') {
        setCurrentFilePath(result.path);
        setCurrentFileName(result.fileName);
        await rememberRecentFile(result.path, 'save');
      } else {
        setCurrentFileName(result.fileName);
      }
      setIsDocumentDirty(false);
      showFileResult(result, saveAs ? '已另存为' : '已保存');
    } catch (error) {
      showMessage(`保存失败：${getErrorMessage(error, '未知错误')}`);
    }
  };

  const handleSaveMindmap = () => void saveMindmap(false);
  const handleSaveMindmapAs = () => void saveMindmap(true);

  const handleOpenMindmap = async () => {
    try {
      const opened = await openLocalTextFile({
        accept: '.lmind,application/json',
        filterName: 'Local Mindmap 工程文件',
        extensions: ['lmind'],
      });

      if (!opened) {
        return;
      }
      const openedProject = parseLmindProject(opened.content);

      recordHistory();
      applyProject(openedProject);
      setCurrentFilePath(opened.path);
      setCurrentFileName(opened.fileName);
      setIsDocumentDirty(false);
      await rememberRecentFile(opened.path ?? opened.fileName, 'open');
      showMessage(opened.path ? `已打开：${opened.path}` : `已打开 ${opened.fileName}`);
    } catch (error) {
      showMessage(`打开失败：${getErrorMessage(error, '文件格式不正确')}`);
    }
  };

  const handleOpenRecentFile = async (entry: RecentFileEntry) => {
    if (!isDesktopApp) {
      showMessage(`最近下载：${entry.name}。浏览器无法重新打开本地下载路径。`);
      return;
    }
    try {
      const openedProject = parseLmindProject(
        await readLocalTextFile(entry.path),
      );
      recordHistory();
      applyProject(openedProject);
      setCurrentFilePath(entry.path);
      setCurrentFileName(entry.name);
      setIsDocumentDirty(false);
      await rememberRecentFile(entry.path, 'open');
      showMessage(`已打开：${entry.path}`);
    } catch (error) {
      showMessage(
        `打开失败：${getErrorMessage(error, '文件不存在或格式不正确')}`,
      );
    }
  };

  const handleOpenCurrentFileLocation = async () => {
    if (!currentFilePath) {
      showMessage('当前文件尚未保存。');
      return;
    }
    try {
      await openFileLocation(currentFilePath);
    } catch (error) {
      showMessage(
        `打开所在目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCopyCurrentFilePath = async () => {
    if (!currentFilePath) {
      showMessage('当前文件尚未保存。');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentFilePath);
      showMessage('路径已复制。');
    } catch (error) {
      showMessage(`复制路径失败：${getErrorMessage(error, '剪贴板不可用')}`);
    }
  };

  const exportFile = async (options: {
    content: string | Uint8Array | ArrayBuffer;
    extension: string;
    mimeType: string;
    filterName: string;
    defaultFileName?: string;
  }) => {
    try {
      const result = await saveLocalFile({
        content: options.content,
        defaultFileName:
          options.defaultFileName ??
          `${sanitizeFileName(mindmap.text)}.${options.extension}`,
        mimeType: options.mimeType,
        filterName: options.filterName,
        extensions: [options.extension],
        forceDialog: true,
      });
      if (!result) {
        showMessage('导出已取消。');
        return;
      }
      showFileResult(result, '已导出');
    } catch (error) {
      showMessage(`导出失败：${getErrorMessage(error, '未知错误')}`);
    }
  };

  const handleExportMarkdown = () =>
    void exportFile({
      content: serializeMindmapMarkdown(mindmap),
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
      filterName: 'Markdown',
    });

  const handleExportExcel = () =>
    void exportFile({
      content: createMindmapExcelBytes(mindmap),
      extension: 'xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filterName: 'Excel',
    });

  const handleExportJson = () =>
    void exportFile({
      content: serializeLmindDocument(mindmap, nodeTypes, themeId),
      extension: 'json',
      mimeType: 'application/json;charset=utf-8',
      filterName: 'JSON',
    });

  const handleExportNodeTypePack = async () => {
    if (nodeTypes.length === 0) {
      showMessage('暂无可导出的自定义节点类型');
      return;
    }

    await exportFile({
      content: exportNodeTypesToPack(nodeTypes, {
        name: 'Local Mindmap 节点类型包',
        description: '用于分享本地自定义节点类型，不包含导图内容。',
      }),
      extension: 'json',
      mimeType: 'application/json;charset=utf-8',
      filterName: '节点类型包',
      defaultFileName: `Local-Mindmap-节点类型包-${new Date().toISOString().slice(0, 10)}.json`,
    });
  };

  const handleImportNodeTypePack = async () => {
    try {
      const selectedFile = await selectLocalFile('.json,application/json');

      if (!selectedFile) {
        return;
      }

      const pack = parseNodeTypePack(await selectedFile.text());

      if (pack.nodeTypes.length === 0) {
        showMessage('未找到可导入的节点类型');
        return;
      }

      const result = importNodeTypesFromPack(nodeTypes, pack);

      let savedPackPath = '';
      if (result.importedCount > 0) {
        recordHistory();
        setNodeTypes(result.nodeTypes);
        setUserNodeTypes(result.nodeTypes);
        const [, packPath] = await Promise.all([
          saveLocalNodeTypes(result.nodeTypes),
          saveImportedNodeTypePack(pack),
        ]);
        savedPackPath = packPath;
      }

      const nameConflictText =
        result.nameConflictCount > 0 ? `，同名 ${result.nameConflictCount}` : '';
      showMessage(
        `已导入节点类型包：${pack.meta.name}。${savedPackPath ? `已保存到用户目录：${savedPackPath}。` : ''}成功导入 ${result.importedCount} 个，跳过重复 ${result.skippedDuplicateCount} 个，重命名冲突 ${result.renamedConflictCount} 个，无效条目 ${result.invalidCount} 个${nameConflictText}`,
      );
    } catch (error) {
      showMessage(`导入失败：${getErrorMessage(error, '节点类型包格式不正确')}`);
    }
  };

  const handleExportTxt = () =>
    void exportFile({
      content: serializeMindmapTxt(mindmap),
      extension: 'txt',
      mimeType: 'text/plain;charset=utf-8',
      filterName: 'Text',
    });

  const handleInstallPlugin = async () => {
    try {
      const manifest = await readLocalPluginManifest();

      if (!manifest) {
        return;
      }

      const existingPlugin = plugins.find(
        (plugin) => plugin.pluginId === manifest.pluginId,
      );
      if (existingPlugin?.builtIn) {
        throw new Error(`不能覆盖内置插件：${manifest.pluginId}`);
      }
      const exists = Boolean(existingPlugin);

      if (
        existingPlugin &&
        !window.confirm(createPluginOverwritePrompt(existingPlugin, manifest))
      ) {
        const duplicateMessage =
          `插件已安装：${existingPlugin.name}（${existingPlugin.pluginId}）。` +
          '已取消覆盖安装。';
        setLastPluginInstallError(duplicateMessage);
        showMessage(duplicateMessage);
        return;
      }

      const {
        plugins: nextPlugins,
        manifest: installedManifest,
      } = await installPlugin(plugins, manifest, exists);
      setPlugins(nextPlugins);
      setLastPluginInstallError('');
      const installPaths =
        `已${exists ? '覆盖安装' : '安装'}插件：${installedManifest.name}。` +
        `pluginId：${installedManifest.pluginId}。` +
        `版本：${installedManifest.version}。` +
        `已保存到用户目录：plugins/installed/${installedManifest.pluginId}/manifest.json。` +
        '已更新插件注册表：plugins/plugin-registry.json。';
      const warningCount = installedManifest.validationWarnings?.length ?? 0;
      showMessage(
        warningCount > 0
          ? `${installPaths}插件已安装，但存在 ${warningCount} 个警告，请在插件详情中查看。`
          : installPaths,
      );
    } catch (error) {
      const errorMessage =
        error instanceof PluginManifestError
          ? error.message
          : getErrorMessage(error, '插件安装失败：未知错误');
      setLastPluginInstallError(errorMessage);
      showMessage(errorMessage);
    }
  };

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    const nextPlugins = setPluginEnabled(plugins, pluginId, enabled);
    try {
      await savePluginRegistry(nextPlugins);
      setPlugins(nextPlugins);
      showMessage(enabled ? '插件已启用' : '插件已禁用');
    } catch (error) {
      showMessage(getErrorMessage(error, '插件状态保存失败'));
    }
  };

  const handleUninstallPlugin = async (pluginId: string) => {
    const targetPlugin = plugins.find((plugin) => plugin.pluginId === pluginId);
    if (targetPlugin?.builtIn) {
      showMessage('内置插件不能卸载，可选择禁用');
      return;
    }
    if (!window.confirm('确定要卸载这个插件吗？')) {
      return;
    }

    const nextPlugins = uninstallPlugin(plugins, pluginId);
    try {
      await uninstallPluginFromUserDir(pluginId);
      await savePluginRegistry(nextPlugins);
      setPlugins(nextPlugins);
      showMessage('插件已卸载');
    } catch (error) {
      showMessage(getErrorMessage(error, '插件卸载失败'));
    }
  };

  const handleCopyUserDataDir = async () => {
    try {
      await navigator.clipboard.writeText(userDataDir);
      showMessage('用户数据目录路径已复制');
    } catch {
      showMessage('复制失败，请手动选择路径');
    }
  };

  const handleOpenUserDataDir = async () => {
    try {
      await openUserDataDir();
      showMessage('已打开用户数据目录');
    } catch (error) {
      showMessage(getErrorMessage(error, '无法打开用户数据目录'));
    }
  };

  const handleCopyPluginId = async (pluginId: string) => {
    try {
      await navigator.clipboard.writeText(pluginId);
      showMessage('pluginId 已复制');
    } catch {
      showMessage('复制 pluginId 失败');
    }
  };

  const handleCopyPluginPath = async (
    relativePath: string,
    label: string,
  ) => {
    try {
      await navigator.clipboard.writeText(
        resolveUserDataPath(userDataDir, relativePath),
      );
      showMessage(`${label}已复制`);
    } catch {
      showMessage(`复制${label}失败`);
    }
  };

  const handleOpenPluginDir = async () => {
    if (!isDesktopApp) {
      showMessage('Web 端不支持打开插件目录');
      return;
    }
    try {
      await openPluginDir();
      showMessage('已打开插件目录');
    } catch (error) {
      showMessage(
        `打开插件目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleReloadPlugins = async () => {
    const requestId = pluginReloadRequestRef.current + 1;
    pluginReloadRequestRef.current = requestId;
    try {
      const reloadedPlugins = await loadPluginRegistry();
      if (requestId !== pluginReloadRequestRef.current) {
        return;
      }
      setPlugins(reloadedPlugins);
      setLastPluginInstallError('');
      showMessage('插件已重新加载。');
    } catch (error) {
      if (requestId !== pluginReloadRequestRef.current) {
        return;
      }
      showMessage(
        `插件重新加载失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleOpenPluginManifestDir = async (pluginId: string) => {
    if (!isDesktopApp) {
      showMessage('Web 端不支持打开 manifest 所在目录');
      return;
    }
    try {
      await openPluginManifestDir(pluginId);
      showMessage('已打开 manifest 所在目录');
    } catch (error) {
      showMessage(
        `打开 manifest 所在目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleRepairPluginRegistry = async (pluginId: string) => {
    const target = plugins.find((plugin) => plugin.pluginId === pluginId);
    if (!target || target.source !== 'registry-missing') {
      showMessage('该插件不需要修复 registry');
      return;
    }
    try {
      const repaired = plugins.map((plugin) =>
        plugin.pluginId === pluginId
          ? {
              ...plugin,
              source: 'external' as const,
              enabled: false,
              validationWarnings: plugin.validationWarnings?.filter(
                (warning) => !warning.includes('registry'),
              ),
            }
          : plugin,
      );
      await savePluginRegistry(repaired);
      setPlugins(await loadPluginRegistry());
      showMessage('插件 registry 记录已修复，插件保持禁用');
    } catch (error) {
      showMessage(
        `修复 registry 失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCleanPluginRecord = async (pluginId: string) => {
    if (!window.confirm(`确定清理异常插件记录 ${pluginId} 吗？`)) {
      return;
    }
    try {
      await uninstallPluginFromUserDir(pluginId);
      const nextPlugins = uninstallPlugin(plugins, pluginId);
      await savePluginRegistry(nextPlugins);
      setPlugins(await loadPluginRegistry());
      showMessage('异常插件记录已清理');
    } catch (error) {
      showMessage(
        `清理异常插件记录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
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

  const applyTypedNodeCreation = (result: TypedNodeCreationResult) => {
    setMindmap(result.rootNode);
    setSelectedNodeId(result.selectedNodeId);
    setSelectedNodeIds(result.selectedNodeIds);
    setEditingNodeId(null);
  };

  const handleAddChild = (nodeTypeId = childNodeTypeId) => {
    const parentNodeId = selectedNodeId ?? mindmap.id;
    const parentNode = findNodeById(mindmap, parentNodeId) ?? mindmap;
    const position = parentNode.position
      ? {
          x: parentNode.position.x + POSITIONED_LAYOUT.nodeWidth + 80,
          y: parentNode.position.y + parentNode.children.length * 96,
        }
      : undefined;
    const result = addTypedChildNode(
      mindmap,
      parentNodeId,
      availableNodeTypes,
      nodeTypeId,
      position,
    );

    if (!result) {
      showMessage('无法新增子节点');
      return;
    }

    recordHistory();
    applyTypedNodeCreation(result);
  };

  const handleAddSibling = (nodeTypeId = childNodeTypeId) => {
    if (!selectedNodeId) {
      showMessage('请先选择节点');
      return;
    }

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
    const result = addTypedSiblingNode(
      mindmap,
      selectedNodeId,
      availableNodeTypes,
      nodeTypeId,
      siblingPosition,
    );

    if (!result) {
      showMessage('无法新增同级节点');
      return;
    }

    recordHistory();
    applyTypedNodeCreation(result);
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
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setEditingNodeId(null);
    showMessage(
      deletableIds.length > 1 ? `已删除 ${deletableIds.length} 个节点` : '已删除节点',
    );
  };

  const getPastedRootPosition = ({
    targetNode,
    index,
    existingChildCount,
  }: {
    targetNode: MindmapNode;
    index: number;
    existingChildCount: number;
  }) =>
    targetNode.position
      ? {
          x: targetNode.position.x + POSITIONED_LAYOUT.nodeWidth + 80,
          y: targetNode.position.y + (existingChildCount + index) * 96,
        }
      : undefined;

  const getSafePasteTargetId = (clipboard: InternalClipboardState) => {
    const targetNode = selectedNodeId
      ? findNodeById(mindmap, selectedNodeId)
      : null;

    if (!targetNode) {
      return mindmap.id;
    }

    if (clipboard.mode !== 'cut') {
      return targetNode.id;
    }

    const sourceSubtreeIds = new Set<string>();
    clipboard.nodes.forEach((node) => {
      collectNodeIds(node).forEach((nodeId) => sourceSubtreeIds.add(nodeId));
    });

    return sourceSubtreeIds.has(targetNode.id) ? mindmap.id : targetNode.id;
  };

  const handleCopyNodes = () => {
    const copiedNodes = collectSelectedSubtrees(mindmap, selectedNodeIds);

    if (copiedNodes.length === 0) {
      showMessage('请先选择节点');
      return;
    }

    setInternalClipboard({
      mode: 'copy',
      nodes: copiedNodes,
      sourceNodeIds: [],
    });
    showMessage(
      copiedNodes.length > 1
        ? `已复制 ${copiedNodes.length} 个节点`
        : '已复制 1 个节点',
    );
  };

  const handleCutNodes = () => {
    const cutResult = cutNodesSafely(mindmap, selectedNodeIds, mindmap.id);

    if (cutResult.cutNodes.length === 0) {
      showMessage(
        cutResult.skippedRoot ? '中心主题不能剪切' : '请先选择可剪切节点',
      );
      return;
    }

    setInternalClipboard({
      mode: 'cut',
      nodes: cutResult.cutNodes,
      sourceNodeIds: cutResult.cutNodeIds,
    });
    showMessage(
      cutResult.cutNodes.length > 1
        ? `已剪切 ${cutResult.cutNodes.length} 个节点`
        : '已剪切 1 个节点',
    );
  };

  const handlePasteNodes = (targetNodeId?: string) => {
    if (!internalClipboard || internalClipboard.nodes.length === 0) {
      showMessage('内部剪贴板为空');
      return;
    }

    const pasteTargetId = targetNodeId ?? getSafePasteTargetId(internalClipboard);
    const existingTargetNode = findNodeById(mindmap, pasteTargetId);
    const safeTargetId = existingTargetNode ? pasteTargetId : mindmap.id;

    recordHistory();
    const sourceNodeIds = new Set(
      internalClipboard.mode === 'cut' ? internalClipboard.sourceNodeIds : [],
    );
    const baseMindmap =
      sourceNodeIds.size > 0
        ? deleteNodesByIds(mindmap, sourceNodeIds)
        : mindmap;
    const targetStillExists = findNodeById(baseMindmap, safeTargetId);
    const result = pasteNodesAsChildren(
      baseMindmap,
      targetStillExists ? safeTargetId : baseMindmap.id,
      internalClipboard.nodes,
      { getRootPosition: getPastedRootPosition },
    );
    const integrity = validateTreeIntegrity(result.rootNode);

    if (!integrity.valid) {
      showMessage('粘贴失败：节点结构异常');
      return;
    }

    setMindmap(result.rootNode);
    setSelectedNodeId(result.pastedNodeIds[0] ?? null);
    setSelectedNodeIds(result.pastedNodeIds);
    setEditingNodeId(null);
    setEditingText('');
    if (internalClipboard.mode === 'cut') {
      setInternalClipboard(null);
    }
    showMessage(
      result.pastedNodeIds.length > 1
        ? `已粘贴 ${result.pastedNodeIds.length} 个节点`
        : '已粘贴 1 个节点',
    );
  };

  const handleDuplicateNodeAsSibling = () => {
    if (!selectedNodeId) {
      showMessage('璇峰厛閫夋嫨鑺傜偣');
      return;
    }

    const result = duplicateNodeAsSibling(mindmap, selectedNodeId, {
      getRootPosition: getPastedRootPosition,
    });

    if (!result) {
      showMessage('请先选择节点');
      return;
    }

    const integrity = validateTreeIntegrity(result.rootNode);

    if (!integrity.valid) {
      showMessage('复制失败：节点结构异常');
      return;
    }

    recordHistory();
    setMindmap(result.rootNode);
    setSelectedNodeId(result.pastedNodeIds[0] ?? null);
    setSelectedNodeIds(result.pastedNodeIds);
    setEditingNodeId(null);
    setEditingText('');
    showMessage('已复制为同级节点');
  };

  const handleClearInternalClipboard = () => {
    setInternalClipboard(null);
    showMessage('已清空内部剪贴板');
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
    const query = searchQuery.trim();

    if (!query || !activeMatch) {
      showMessage('没有可替换的匹配项');
      return;
    }

    const nextMindmap = replaceMatchInMindmap(
      mindmap,
      activeMatch,
      query,
      replacementText,
    );
    const nextMatches = findMindmapMatches(nextMindmap, query, searchScope);
    const nextMatchIndex = findNextMatchIndex(nextMindmap, nextMatches, {
      nodeId: activeMatch.nodeId,
      field: activeMatch.field,
      offset: activeMatch.start + replacementText.length,
    });

    recordHistory();
    setMindmap(nextMindmap);
    setActiveMatchIndex(Math.max(0, nextMatchIndex));

    const nextMatch = nextMatches[nextMatchIndex];
    if (nextMatch) {
      setSelectedNodeId(nextMatch.nodeId);
      setSelectedNodeIds([nextMatch.nodeId]);
    }
    showMessage('已替换 1 处');
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

  const handleSaveTemplate = async () => {
    const template = createTemplateFromMindmap(
      templateName || mindmap.text,
      templateCategory,
      templateDescription,
      mindmap,
      nodeTypes,
      themeId,
    );
    const nextTemplates = [template, ...templates];
    try {
      await saveMindmapTemplates(nextTemplates);
      setTemplates(nextTemplates);
      setTemplateName('');
      setTemplateDescription('');
      showMessage('已保存为模板');
    } catch (error) {
      showMessage(getErrorMessage(error, '模板保存失败'));
    }
  };

  const handleExportTemplatePack = async () => {
    if (templates.length === 0) {
      showMessage('暂无可导出的自定义模板');
      return;
    }

    await exportFile({
      content: exportTemplatesToPack(templates, {
        name: 'Local Mindmap 模板包',
        description: '用于分享本地自定义模板，不等同于 .lmind 文件。',
      }),
      extension: 'json',
      mimeType: 'application/json;charset=utf-8',
      filterName: '模板包',
      defaultFileName: `Local-Mindmap-模板包-${new Date().toISOString().slice(0, 10)}.json`,
    });
  };

  const handleImportTemplatePack = async () => {
    try {
      const selectedFile = await selectLocalFile('.json,application/json');

      if (!selectedFile) {
        return;
      }

      const pack = parseTemplatePack(await selectedFile.text());

      if (pack.templates.length === 0) {
        showMessage('未找到可导入的模板');
        return;
      }

      const result = importTemplatesFromPack(templates, pack);

      let savedPackPath = '';
      if (result.importedCount > 0) {
        setTemplates(result.templates);
        const [, packPath] = await Promise.all([
          saveMindmapTemplates(result.templates),
          saveImportedTemplatePack(pack),
        ]);
        savedPackPath = packPath;
      }

      const nameConflictText =
        result.nameConflictCount > 0 ? `，同名 ${result.nameConflictCount}` : '';
      showMessage(
        `已导入模板包：${pack.meta.name}。${savedPackPath ? `已保存到用户目录：${savedPackPath}。` : ''}成功导入 ${result.importedCount} 个，跳过重复 ${result.skippedDuplicateCount} 个，重命名冲突 ${result.renamedConflictCount} 个，无效条目 ${result.invalidCount} 个${nameConflictText}`,
      );
    } catch (error) {
      showMessage(`导入失败：${getErrorMessage(error, '模板包格式不正确')}`);
    }
  };

  const handleCreateFromTemplate = (template: MindmapTemplate) => {
    recordHistory();
    applyProject(cloneTemplateProject(template));
    setActiveDrawer(null);
    showMessage('已从模板新建思维导图');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const nextTemplates = templates.filter(
      (template) => template.id !== templateId,
    );
    try {
      await saveMindmapTemplates(nextTemplates);
      setTemplates(nextTemplates);
      showMessage('已删除模板');
    } catch (error) {
      showMessage(getErrorMessage(error, '模板删除失败'));
    }
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

  const handleCreateNodeType = async () => {
    const nodeType = createMindmapNodeType(nodeTypeDraft);

    if (!nodeType) {
      showMessage('请先填写节点类型名称');
      return;
    }

    recordHistory();
    const nextNodeTypes = [...nodeTypes, nodeType];
    try {
      await saveLocalNodeTypes(nextNodeTypes);
      setNodeTypes(nextNodeTypes);
      setUserNodeTypes(nextNodeTypes);
      setNodeTypeDraft(createEmptyNodeTypeDraft());
      showMessage('已创建节点类型');
    } catch (error) {
      showMessage(getErrorMessage(error, '节点类型保存失败'));
    }
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
      await exportFile({
        content: await createMindmapImageBytes(exportTreeRef.current, format),
        extension: format,
        mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
        filterName: format.toUpperCase(),
      });
    } catch (error) {
      showMessage(`导出失败：图片生成失败：${getErrorMessage(error, '未知错误')}`);
    }
  };

  const getCanvasPointFromMouseEvent = (
    event: MouseEvent<HTMLElement>,
  ): Point => {
    const panLayerViewportRect = panLayerRef.current?.getBoundingClientRect();

    if (panLayerViewportRect) {
      return screenPointToWorldPoint(
        { x: event.clientX, y: event.clientY },
        panLayerViewportRect,
        canvasView.scale,
      );
    }

    const canvasElement = canvasRef.current ?? event.currentTarget;
    const canvasViewportRect = canvasElement.getBoundingClientRect();

    return {
      x:
        (event.clientX -
          canvasViewportRect.left +
          canvasElement.scrollLeft -
          canvasView.offsetX) /
        canvasView.scale,
      y:
        (event.clientY -
          canvasViewportRect.top +
          canvasElement.scrollTop -
          canvasView.offsetY) /
        canvasView.scale,
    };
  };

  const findDropTargetNodeId = (
    draggedNodeId: string,
    canvasPoint: Point,
  ): string | null => {
    if (draggedNodeId === mindmap.id) {
      return null;
    }

    const currentParentNode = findParentNodeById(mindmap, draggedNodeId);
    const hitPadding = 12;
    const dropTargetMatches = nodeHitboxes
      .filter((hitbox) => {
        if (
          hitbox.id === draggedNodeId ||
          hitbox.id === currentParentNode?.id ||
          isTreeDescendant(mindmap, draggedNodeId, hitbox.id)
        ) {
          return false;
        }

        return (
          canvasPoint.x >= hitbox.left - hitPadding &&
          canvasPoint.x <= hitbox.left + hitbox.width + hitPadding &&
          canvasPoint.y >= hitbox.top - hitPadding &&
          canvasPoint.y <= hitbox.top + hitbox.height + hitPadding
        );
      })
      .map((hitbox) => {
        const centerX = hitbox.left + hitbox.width / 2;
        const centerY = hitbox.top + hitbox.height / 2;

        return {
          id: hitbox.id,
          distance: Math.hypot(canvasPoint.x - centerX, canvasPoint.y - centerY),
        };
      })
      .sort((a, b) => a.distance - b.distance);

    return dropTargetMatches[0]?.id ?? null;
  };

  const handleCanvasPointerDown = (
    event: MouseEvent<HTMLElement>,
  ) => {
    const isOnInteractiveElement = isCanvasInteractionBlockedTarget(
      event.target as HTMLElement | null,
    );

    const canvasElement = event.currentTarget;
    const canvasViewportRect = canvasElement.getBoundingClientRect();
    const screenPoint = { x: event.clientX, y: event.clientY };

    if (
      shouldStartBoxSelection({
        button: event.button,
        isOnInteractiveElement,
        shiftKey: event.shiftKey,
      })
    ) {
      event.preventDefault();
      isPanningRef.current = false;
      canvasPanStateRef.current = null;
      const selectionGeometry = getBoxSelectionGeometry({
        screenStart: screenPoint,
        screenCurrent: screenPoint,
        canvasViewportRect,
        worldViewportRect: panLayerRef.current?.getBoundingClientRect(),
        canvasView,
        scrollOffset: {
          x: canvasElement.scrollLeft,
          y: canvasElement.scrollTop,
        },
      });

      setContextMenu(null);
      setBoxSelection({
        screenStart: screenPoint,
        screenCurrent: screenPoint,
        canvasStart: selectionGeometry.canvasStart,
        canvasCurrent: selectionGeometry.canvasCurrent,
        append: false,
        isActive: false,
      });
      setBoxSelectionPreviewIds([]);
      return;
    }

    if (
      shouldStartCanvasPan({
        button: event.button,
        isOnInteractiveElement,
        shiftKey: event.shiftKey,
      })
    ) {
      event.preventDefault();
      setContextMenu(null);
      cancelBoxSelection();
      isPanningRef.current = true;
      lastPanPointRef.current = screenPoint;
      canvasPanStateRef.current = {
        screenStart: screenPoint,
        lastScreenPoint: screenPoint,
        hasMoved: false,
      };
    }
  };

  const handleCanvasPointerMove = (
    event: MouseEvent<HTMLElement>,
  ) => {
    if (boxSelection) {
      event.preventDefault();
      const canvasElement = event.currentTarget;
      const canvasViewportRect = canvasElement.getBoundingClientRect();
      const screenPoint = { x: event.clientX, y: event.clientY };
      const selectionGeometry = getBoxSelectionGeometry({
        screenStart: boxSelection.screenStart,
        screenCurrent: screenPoint,
        canvasViewportRect,
        worldViewportRect: panLayerRef.current?.getBoundingClientRect(),
        canvasView,
        scrollOffset: {
          x: canvasElement.scrollLeft,
          y: canvasElement.scrollTop,
        },
      });
      const isActive =
        boxSelection.isActive ||
        isDragPastThreshold(boxSelection.screenStart, screenPoint);
      const nextBoxSelection = {
        ...boxSelection,
        screenCurrent: screenPoint,
        canvasCurrent: selectionGeometry.canvasCurrent,
        isActive,
      };

      setBoxSelection(nextBoxSelection);

      if (isActive) {
        const hitNodeIds = hitTestNodesInRect(
          selectionGeometry.canvasRect,
          nodeHitboxes,
        );
        const nextPreviewSelection = resolveBoxSelectionState(
          {
            selectedNodeId,
            selectedNodeIds,
          },
          hitNodeIds,
          nextBoxSelection.append,
        );
        setBoxSelectionPreviewIds(nextPreviewSelection.selectedNodeIds);
      }

      return;
    }

    if (dragStateRef.current) {
      event.preventDefault();
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
        updateNodePositionById(currentMindmap, dragState.nodeId, nextPosition),
      );
      setDropTargetNodeId(
        findDropTargetNodeId(
          dragState.nodeId,
          getCanvasPointFromMouseEvent(event),
        ),
      );
      return;
    }

    if (!isPanningRef.current || !canvasPanStateRef.current) {
      return;
    }

    event.preventDefault();

    const screenPoint = { x: event.clientX, y: event.clientY };
    const canvasPanState = canvasPanStateRef.current;

    if (
      !canvasPanState.hasMoved &&
      !isDragPastThreshold(canvasPanState.screenStart, screenPoint)
    ) {
      return;
    }

    const deltaX = screenPoint.x - canvasPanState.lastScreenPoint.x;
    const deltaY = screenPoint.y - canvasPanState.lastScreenPoint.y;
    canvasPanStateRef.current = {
      ...canvasPanState,
      lastScreenPoint: screenPoint,
      hasMoved: true,
    };
    lastPanPointRef.current = screenPoint;
    setCanvasView((view) => panCanvasView(view, deltaX, deltaY));
  };

  const stopCanvasPan = () => {
    isPanningRef.current = false;
    canvasPanStateRef.current = null;
  };

  const handleCanvasPointerUp = (
    event: MouseEvent<HTMLElement>,
  ) => {
    if (boxSelection) {
      event.preventDefault();
      if (!boxSelection.isActive) {
        clearSelection();
        cancelBoxSelection();
        return;
      }

      const canvasElement = event.currentTarget;
      const screenPoint = { x: event.clientX, y: event.clientY };
      const selectionGeometry = getBoxSelectionGeometry({
        screenStart: boxSelection.screenStart,
        screenCurrent: screenPoint,
        canvasViewportRect: canvasElement.getBoundingClientRect(),
        worldViewportRect: panLayerRef.current?.getBoundingClientRect(),
        canvasView,
        scrollOffset: {
          x: canvasElement.scrollLeft,
          y: canvasElement.scrollTop,
        },
      });
      const hitNodeIds = hitTestNodesInRect(
        selectionGeometry.canvasRect,
        nodeHitboxes,
      );
      const nextSelection = resolveBoxSelectionState(
        {
          selectedNodeId,
          selectedNodeIds,
        },
        hitNodeIds,
        boxSelection.append,
      );

      setSelectedNodeId(nextSelection.selectedNodeId);
      setSelectedNodeIds(nextSelection.selectedNodeIds);
      cancelBoxSelection();
      showMessage(
        nextSelection.selectedNodeIds.length > 0
          ? `已框选 ${nextSelection.selectedNodeIds.length} 个节点`
          : '未框选到节点',
      );
      return;
    }

    if (dragStateRef.current) {
      event.preventDefault();
      const dragState = dragStateRef.current;
      const finalDropTargetNodeId =
        findDropTargetNodeId(
          dragState.nodeId,
          getCanvasPointFromMouseEvent(event),
        ) ?? dropTargetNodeId;
      const canMoveNode =
        finalDropTargetNodeId !== null &&
        moveNodeAsChild(mindmap, dragState.nodeId, finalDropTargetNodeId) !== null;

      if (finalDropTargetNodeId && canMoveNode) {
        if (!dragState.hasRecordedHistory) {
          recordHistory();
        }

        setMindmap((currentMindmap) => {
          const moveResult = moveNodeAsChild(
            currentMindmap,
            dragState.nodeId,
            finalDropTargetNodeId,
          );

          return moveResult?.rootNode ?? currentMindmap;
        });
        setSelectedNodeId(dragState.nodeId);
        setSelectedNodeIds([dragState.nodeId]);
        showMessage('\u5df2\u79fb\u52a8\u4e3a\u5b50\u8282\u70b9');
      }

      dragStateRef.current = null;
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
      stopCanvasPan();
      return;
    }

    if (canvasPanStateRef.current) {
      event.preventDefault();
      const hasMoved = canvasPanStateRef.current.hasMoved;
      stopCanvasPan();

      if (!hasMoved) {
        clearSelection();
      }

      return;
    }

    stopCanvasPan();
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
    canvasPanStateRef.current = null;
    setDropTargetNodeId(null);
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
    const menuWidth = nextContextMenu.type === 'node' ? 244 : 220;
    const menuHeight =
      nextContextMenu.type === 'node'
        ? Math.min(650, window.innerHeight - 24)
        : 360;
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

  const pluginCommandHandlers: PluginCommandHandlers = {
    'builtin.openPluginManager': () => setIsPluginManagerVisible(true),
    'builtin.reloadPlugins': handleReloadPlugins,
    'builtin.openPluginDirectory': handleOpenPluginDir,
    'builtin.exportText': handleExportTxt,
  };

  const runPluginCommand = async (commandId: string, pluginId?: string) => {
    try {
      await executePluginCommand({
        commandId,
        pluginId,
        plugins,
        handlers: pluginCommandHandlers,
      });
    } catch (error) {
      const reason = getErrorMessage(error, '未知错误');
      showMessage(
        reason.startsWith('插件命令不存在：')
          ? reason
          : `插件命令执行失败：${reason}`,
      );
    }
  };

  const pluginMenuGroups = getPluginMenuGroups(plugins, {
    hasMindmap: Boolean(mindmap),
    hasSelectedNode: Boolean(selectedNodeId),
  });

  const topMenus: TopMenuGroup[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        { label: '新建思维导图', onSelect: handleCreateMindmap },
        {
          label: '打开 .lmind',
          onSelect: () => void handleOpenMindmap(),
        },
        { label: '保存', onSelect: handleSaveMindmap },
        { label: '另存为 .lmind', onSelect: handleSaveMindmapAs },
        ...(isDesktopApp
          ? [
              {
                label: '打开所在目录',
                onSelect: () => void handleOpenCurrentFileLocation(),
                disabled: !currentFilePath,
                dividerBefore: true,
              },
              {
                label: '复制文件路径',
                onSelect: () => void handleCopyCurrentFilePath(),
                disabled: !currentFilePath,
              },
            ]
          : []),
        ...recentFiles.slice(0, 5).map((entry, index) => ({
          label: `最近文件：${entry.name}`,
          onSelect: () => void handleOpenRecentFile(entry),
          dividerBefore: index === 0,
        })),
      ],
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        { label: '撤销', onSelect: handleUndo },
        { label: '重做', onSelect: handleRedo },
        { label: '复制', onSelect: handleCopyNodes, dividerBefore: true },
        { label: '剪切', onSelect: handleCutNodes },
        { label: '粘贴', onSelect: () => handlePasteNodes() },
        { label: '复制为同级节点', onSelect: handleDuplicateNodeAsSibling },
        { label: '删除节点', onSelect: handleDeleteNode, dividerBefore: true },
        {
          label: '查找替换',
          onSelect: () => setActiveDrawer('search'),
          dividerBefore: true,
        },
      ],
    },
    {
      id: 'insert',
      label: '插入',
      items: [
        { label: '添加子节点', onSelect: handleAddChild },
        { label: '添加同级节点', onSelect: handleAddSibling },
      ],
    },
    {
      id: 'view',
      label: '视图',
      items: [
        {
          label: '放大',
          onSelect: () =>
            setCanvasView((view) => zoomCanvasView(view, 'in')),
        },
        {
          label: '缩小',
          onSelect: () =>
            setCanvasView((view) => zoomCanvasView(view, 'out')),
        },
        {
          label: '一键居中',
          onSelect: () => setCanvasView(centerCanvasView()),
        },
        {
          label: '重新自动布局',
          onSelect: handleResetAutoLayout,
          dividerBefore: true,
        },
        { label: '展开全部', onSelect: handleExpandAll },
        { label: '折叠全部', onSelect: handleCollapseAll },
        {
          label: '专注模式',
          onSelect: () => setIsFocusMode(true),
          dividerBefore: true,
        },
      ],
    },
    {
      id: 'import-export',
      label: '导入导出',
      items: [
        { label: '导入 Markdown', onSelect: () => void handleImportMarkdown() },
        { label: '导出 Markdown', onSelect: handleExportMarkdown },
        { label: '导入 Excel', onSelect: () => void handleImportExcel() },
        { label: '导出 Excel', onSelect: handleExportExcel },
        {
          label: '导入 JSON',
          onSelect: () => void handleImportJson(),
          dividerBefore: true,
        },
        { label: '导出 JSON', onSelect: handleExportJson },
        {
          label: '导出 PNG',
          onSelect: () => void handleExportImage('png'),
          dividerBefore: true,
        },
        {
          label: '导出 JPG',
          onSelect: () => void handleExportImage('jpg'),
        },
        {
          label: canExportTxt ? '导出 TXT' : '导出 TXT（需启用插件）',
          onSelect: handleExportTxt,
          disabled: !canExportTxt,
        },
        {
          label: '导入节点类型包',
          onSelect: () => void handleImportNodeTypePack(),
          dividerBefore: true,
        },
        { label: '导出节点类型包', onSelect: handleExportNodeTypePack },
        {
          label: '导入模板包',
          onSelect: () => void handleImportTemplatePack(),
        },
        { label: '导出模板包', onSelect: handleExportTemplatePack },
      ],
    },
    {
      id: 'plugins',
      label: '插件',
      items: [
        {
          label: '插件管理',
          onSelect: () =>
            void runPluginCommand('builtin.openPluginManager'),
        },
        {
          label: '重新加载插件',
          onSelect: () => void runPluginCommand('builtin.reloadPlugins'),
        },
        ...(isDesktopApp
          ? [
              {
                label: '打开插件目录',
                onSelect: () =>
                  void runPluginCommand('builtin.openPluginDirectory'),
              },
            ]
          : []),
        ...pluginMenuGroups.map((group, index) => ({
          label: group.pluginName,
          dividerBefore: index === 0,
          children: group.items.map((menu) => ({
            label: menu.label,
            onSelect: () =>
              void runPluginCommand(menu.command, group.pluginId),
          })),
        })),
      ],
    },
    {
      id: 'more',
      label: '更多',
      items: [
        {
          label: '插件管理',
          onSelect: () => setActiveDrawer('plugins'),
        },
        {
          label: '性能测试',
          onSelect: () => setActiveDrawer('performance'),
        },
        {
          label: '快捷键帮助',
          onSelect: () => setIsShortcutHelpVisible(true),
        },
      ],
    },
  ];

  return (
    <main
      className="app-shell"
      style={themeStyle}
      onMouseDown={() => setContextMenu(null)}
    >
      {!isFocusMode ? (
        <TopMenuBar
          currentTitle={`${currentFileName ?? mindmap.text ?? '未命名导图'} · ${
            currentFileName
              ? isDocumentDirty
                ? '有未保存修改'
                : '已保存'
              : '未保存'
          }`}
          currentPath={currentFilePath}
          menus={topMenus}
          message={message}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      ) : null}

      <div
        className={[
          'app-body',
          activeDrawer && !isFocusMode ? 'has-drawer' : '',
          isFocusMode ? 'is-focus-mode' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!isFocusMode ? (
          <LeftResourcePanel
            activeView={activeDrawer}
            title={activeDrawer ? drawerTitle[activeDrawer] : '资源'}
            onViewChange={setActiveDrawer}
          >
            {activeDrawer ? (
              <>

            {activeDrawer === 'templates' ? (
              <section className="feature-panel" aria-label="模板库">
                <label className="resource-search-shell">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={templateKeyword}
                    placeholder="搜索模板或文件"
                    onChange={(event) => setTemplateKeyword(event.target.value)}
                  />
                </label>
                <div className="resource-file-card">
                  <div>
                    <span>当前导图</span>
                    <strong title={mindmap.text}>{mindmap.text}</strong>
                  </div>
                  <div className="resource-file-actions">
                    <button type="button" onClick={handleCreateMindmap}>
                      新建
                    </button>
                    <button type="button" onClick={() => void handleOpenMindmap()}>
                      打开
                    </button>
                    <button type="button" onClick={handleSaveMindmap}>
                      保存
                    </button>
                  </div>
                </div>
                <div className="panel-heading">
                  <h2>保存当前导图为模板</h2>
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
                    onClick={handleExportTemplatePack}
                  >
                    导出模板包
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleImportTemplatePack()}
                  >
                    导入模板包
                  </button>
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

                <div className="template-manager">
                  <div className="compact-form">
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
                      onChange={(event) =>
                        setTemplateCategoryFilter(event.target.value)
                      }
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
                              <span>
                                {new Date(template.createTime).toLocaleString()}
                              </span>
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
              </section>
            ) : null}

            {activeDrawer === 'node-types' ? (
              <section className="feature-panel node-type-panel" aria-label="节点类型">
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
              <button
                type="button"
                className="secondary-action"
                onClick={handleExportNodeTypePack}
              >
                导出节点类型包
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleImportNodeTypePack()}
              >
                导入节点类型包
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
              </section>
            ) : null}

            {activeDrawer === 'search' ? (
              <section className="feature-panel" aria-label="查找替换">
                <div className="panel-heading">
                  <h2>查找替换</h2>
                  <span className="panel-note">
                    {searchMatches.length > 0
                      ? `${activeMatchIndex + 1} / ${searchMatches.length}`
                      : '未找到匹配项'}
                  </span>
                </div>
                {activeMatch?.field === 'remark' ? (
                  <p className="search-match-location">当前匹配位于备注</p>
                ) : null}
                <div className="compact-form drawer-form">
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
                    onChange={(event) =>
                      setSearchScope(event.target.value as SearchScope)
                    }
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
            ) : null}

            {activeDrawer === 'performance' ? (
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
            ) : null}

            {activeDrawer === 'plugins' ? (
              <section className="feature-panel" aria-label="插件管理入口">
                <div className="panel-heading">
                  <h2>插件管理</h2>
                  <span className="panel-note">{plugins.length} 个插件</span>
                </div>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsPluginManagerVisible(true)}
                >
                  打开插件管理面板
                </button>
              </section>
            ) : null}

            {activeDrawer === 'settings' ? (
              <section className="feature-panel" aria-label="界面设置">
                <div className="panel-heading">
                  <h2>界面设置</h2>
                </div>
                <label className="stacked-control">
                  <span>画布主题</span>
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
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsShortcutHelpVisible(true)}
                >
                  查看快捷键
                </button>
              </section>
            ) : null}
              </>
            ) : null}
          </LeftResourcePanel>
        ) : null}

        <div
        className={[
          'workspace-layout',
          isRemarkPanelCollapsed || isFocusMode ? 'is-remark-collapsed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <section
          className={[
            'mindmap-canvas',
            boxSelection ? 'is-box-selecting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="思维导图画布"
          ref={canvasRef}
          onMouseDown={handleCanvasPointerDown}
          onMouseMove={handleCanvasPointerMove}
          onMouseUp={handleCanvasPointerUp}
          onMouseLeave={stopCanvasPan}
          onWheel={handleCanvasWheel}
          onContextMenu={handleCanvasContextMenu}
        >
          <div className="canvas-grid" aria-hidden="true" />
          <CanvasControls
            scale={canvasView.scale}
            isFocusMode={isFocusMode}
            onZoomIn={() =>
              setCanvasView((view) => zoomCanvasView(view, 'in'))
            }
            onZoomOut={() =>
              setCanvasView((view) => zoomCanvasView(view, 'out'))
            }
            onCenter={() => setCanvasView(centerCanvasView())}
            onAutoLayout={handleResetAutoLayout}
            onExitFocusMode={() => setIsFocusMode(false)}
          />
          <div
            className="mindmap-pan-layer"
            style={panLayerStyle}
            ref={panLayerRef}
          >
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
                  isRoot={layoutNode.id === mindmap.id}
                  nodeTypes={availableNodeTypes}
                  selectedNodeId={selectedNodeId}
                  selectedNodeIds={selectedNodeIdSet}
                  boxSelectionPreviewIds={boxSelectionPreviewIdSet}
                  draggingNodeId={draggingNodeId}
                  dropTargetNodeId={dropTargetNodeId}
                  editingNodeId={editingNodeId}
                  editingText={editingText}
                  searchMatchNodeIds={searchMatchNodeIds}
                  activeSearchMatch={activeMatch}
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
          {boxSelectionRect ? (
            <div
              className="box-selection-rect"
              style={{
                left: boxSelectionRect.left,
                top: boxSelectionRect.top,
                width: boxSelectionRect.width,
                height: boxSelectionRect.height,
              }}
              aria-hidden="true"
            />
          ) : null}
        </section>

        {!isFocusMode ? (
          isRemarkPanelCollapsed ? (
            <aside className="inspector-collapsed-bar" aria-label="属性面板已收起">
              <button
                type="button"
                onClick={() => setIsRemarkPanelCollapsed(false)}
                aria-label="展开属性面板"
              >
                ‹ 属性
              </button>
            </aside>
          ) : (
            <RightInspectorPanel
              selectedNode={selectedNode}
              selectedCount={selectedNodeIds.length}
              nodeTypes={availableNodeTypes}
              childNodeTypeId={childNodeTypeId}
              themeId={themeId}
              themes={availableThemes}
              remarkMode={remarkMode}
              activeRemarkMatch={
                activeMatch?.field === 'remark' ? activeMatch : null
              }
              onChildNodeTypeChange={setChildNodeTypeId}
              onSelectedNodeTypeChange={handleSelectedNodeTypeChange}
              onThemeChange={handleThemeChange}
              onRemarkModeChange={setRemarkMode}
              onRemarkChange={handleRemarkChange}
              onManageNodeTypes={() => setActiveDrawer('node-types')}
              onCollapse={() => setIsRemarkPanelCollapsed(true)}
            />
          )
        ) : null}
      </div>
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
          lastInstallError={lastPluginInstallError}
          userDataDir={userDataDir}
          isDesktopApp={isDesktopApp}
          onClose={() => setIsPluginManagerVisible(false)}
          onInstall={handleInstallPlugin}
          onToggle={(pluginId, enabled) =>
            void handleTogglePlugin(pluginId, enabled)
          }
          onUninstall={(pluginId) => void handleUninstallPlugin(pluginId)}
          onCopyUserDataDir={() => void handleCopyUserDataDir()}
          onOpenUserDataDir={() => void handleOpenUserDataDir()}
          onOpenPluginDir={() => void handleOpenPluginDir()}
          onCopyPluginId={(pluginId) => void handleCopyPluginId(pluginId)}
          onCopyPath={(relativePath, label) =>
            void handleCopyPluginPath(relativePath, label)
          }
          onOpenManifestDir={(pluginId) =>
            void handleOpenPluginManifestDir(pluginId)
          }
          onReload={() => void handleReloadPlugins()}
          onRepairRegistry={(pluginId) =>
            void handleRepairPluginRegistry(pluginId)
          }
          onCleanRecord={(pluginId) =>
            void handleCleanPluginRecord(pluginId)
          }
        />
      ) : null}

      {isShortcutHelpVisible ? (
        <div className="shortcut-help-backdrop" role="presentation">
          <section
            className="shortcut-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-help-title"
          >
            <header className="shortcut-help-header">
              <div>
                <p className="eyebrow">Shortcuts</p>
                <h2 id="shortcut-help-title">快捷键帮助</h2>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setIsShortcutHelpVisible(false)}
              >
                关闭
              </button>
            </header>
            <div className="shortcut-list">
              <span>
                <kbd>Ctrl</kbd> + <kbd>Z</kbd>：撤销
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>Y</kbd>：重做
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>C</kbd>：复制节点
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>X</kbd>：剪切节点
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>V</kbd>：粘贴节点
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>D</kbd>：复制为同级节点
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>A</kbd>：全选节点
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>S</kbd>：保存 .lmind
              </span>
              <span>
                <kbd>Ctrl</kbd> + <kbd>O</kbd>：打开 .lmind
              </span>
              <span>
                <kbd>Delete</kbd>：删除选中节点
              </span>
              <span>
                <kbd>Backspace</kbd>：删除选中节点
              </span>
              <span>
                <kbd>Esc</kbd>：关闭弹窗 / 右键菜单 / 框选，或清空选择
              </span>
              <span>Ctrl / Shift + 点击节点：多选</span>
              <span>拖动画布空白区域：平移画布</span>
              <span>Shift + 拖动画布空白区域：框选节点</span>
              <span>Ctrl + 鼠标滚轮：缩放画布</span>
            </div>
          </section>
        </div>
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
              <div className="context-menu-type-action">
                <span>新增子节点类型</span>
                <div>
                  <select
                    value={childNodeTypeId}
                    aria-label="新增子节点类型"
                    onChange={(event) => setChildNodeTypeId(event.target.value)}
                  >
                    {nodeTypeCreationOptions.map((option) => (
                      <option key={option.value || 'default'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      runContextMenuAction(() =>
                        handleAddChild(childNodeTypeId),
                      )
                    }
                  >
                    新增
                  </button>
                </div>
              </div>
              <div className="context-menu-type-action">
                <span>新增同级节点类型</span>
                <div>
                  <select
                    value={siblingNodeTypeId}
                    aria-label="新增同级节点类型"
                    onChange={(event) => setSiblingNodeTypeId(event.target.value)}
                  >
                    {nodeTypeCreationOptions.map((option) => (
                      <option key={option.value || 'default'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedNode.id === mindmap.id}
                    title={
                      selectedNode.id === mindmap.id
                        ? '中心主题不能新增同级节点'
                        : '新增同级节点'
                    }
                    onClick={() =>
                      runContextMenuAction(() =>
                        handleAddSibling(siblingNodeTypeId),
                      )
                    }
                  >
                    新增
                  </button>
                </div>
              </div>
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
                onClick={() => runContextMenuAction(handleCopyNodes)}
              >
                复制节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleCutNodes)}
              >
                剪切节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  runContextMenuAction(() => handlePasteNodes(selectedNode.id))
                }
              >
                粘贴为子节点
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleDuplicateNodeAsSibling)}
              >
                复制为同级节点
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
                  {nodeTypeCreationOptions.map((option) => (
                    <option key={option.value || 'default'} value={option.value}>
                      {option.label}
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
                onClick={() => runContextMenuAction(() => handlePasteNodes(mindmap.id))}
              >
                粘贴到中心主题
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runContextMenuAction(handleClearInternalClipboard)}
              >
                清空内部剪贴板
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
