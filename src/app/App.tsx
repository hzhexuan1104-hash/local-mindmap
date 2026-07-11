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
import {
  applyStyleToNodeType,
  createNodeTypeFromStyle,
  getEffectiveNodeStyle,
  getNodeShapeClassName,
  getNodeStyleCssVariables,
  mergeNodeStyle,
} from '../features/mindmap/nodeStyles';
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
  getPluginWritePermissions,
  getScriptWritePermissions,
  getPluginNodeTypes,
  getPluginTemplates,
  getPluginThemes,
  createPluginOverwritePrompt,
  installPlugin,
  isTxtExportPluginEnabled,
  loadPluginRegistry,
  readLocalPluginPackage,
  savePluginRegistry,
  setPluginEnabled,
  setPluginTrusted,
  shouldConfirmScriptPluginRun,
  shouldConfirmExternalPluginRun,
  shouldConfirmWorkflowPluginRun,
  uninstallPlugin,
  PluginManifestError,
  type PluginManifest,
} from '../features/mindmap/plugins';
import {
  executePluginCommand,
  type PluginCommandHandlers,
} from '../features/plugins/pluginCommands';
import {
  appendPluginLog,
  clearPluginLogs,
  createPluginDiagnosticLogs,
  createPluginLog,
  type PluginLogEntry,
  type PluginLogEvent,
  type PluginLogLevel,
} from '../features/plugins/pluginLogs';
import {
  getPluginGalleryInstallWarning,
  type PluginGalleryItem,
} from '../features/plugins/pluginGallery';
import {
  buildDevPluginPackage,
  createDevPluginProject,
  openDevPluginProjectDir,
  openPluginExamplesDir,
  validateDevPluginProject,
  type DevPluginPackageResult,
  type DevPluginProjectRequest,
  type DevPluginProjectResult,
  type DevPluginValidationResult,
} from '../features/plugins/pluginDevWorkbench';
import {
  applyScriptPluginActions,
  createScriptPluginContext,
  validateScriptActionPermissions,
  validateScriptPluginActions,
  type ScriptShowMessageAction,
} from '../features/plugins/pluginScriptActions';
import { runScriptPlugin } from '../features/plugins/pluginScriptRunner';
import {
  parseExternalActionsOutput,
  runExternalCommandPlugin,
  testPythonRuntime,
} from '../features/plugins/pluginExternalRunner';
import {
  resolveWorkflowActions,
  requestWorkflowTrustDecision,
  workflowHasWriteActions,
} from '../features/plugins/pluginWorkflow';
import {
  loadPluginSettings,
  savePluginSettings,
} from '../features/plugins/pluginSettings';
import { serializeLmindDocument } from '../features/mindmap/saveMindmap';
import {
  checkLocalFileHealth,
  openFileLocation,
  openLocalTextFile,
  readLocalTextFile,
  sanitizeFileName,
  saveLocalFile,
  type LocalFileResult,
} from '../features/mindmap/localFileOperations';
import {
  AUTO_SAVE_INTERVAL_OPTIONS,
  DEFAULT_FILE_RELIABILITY_SETTINGS,
  createDraftId,
  createVersionSnapshot,
  deleteRecoveryDraft,
  deleteVersionSnapshot,
  getAutoSaveDelayMs,
  loadFileReliabilitySettings,
  loadRecoveryDrafts,
  loadVersionHistory,
  maskUserDataPath,
  previewVersionSnapshot,
  readUserLmindProject,
  saveAutosaveDraft,
  saveFileReliabilitySettings,
  versionSourceLabel,
  type FileReliabilitySettings,
  type RecoveryDraftEntry,
  type VersionHistoryEntry,
  type VersionPreview,
} from '../features/mindmap/fileReliability';
import {
  formatLocalDateTime,
  formatRelativeLocalTime,
} from '../features/mindmap/timeFormat';
import {
  loadRecentFileEntries,
  updateRecentFile,
  type RecentFileEntry,
} from '../features/mindmap/recentFiles';
import {
  findNextMatchIndex,
  findMindmapMatches,
  getSearchPanelStatusText,
  replaceAllInMindmap,
  replaceMatchInMindmap,
  SEARCH_SCOPE_LABELS,
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
  createSamplePlugin,
  createSampleBatchScriptPlugin,
  createSampleScriptPlugin,
  createSampleWorkflowPlugin,
  createSamplePythonPlugin,
  ensureUserDataDirs,
  exportPluginPackage,
  getUserDataDir,
  installGalleryPlugin,
  installPluginToUserDir,
  isDesktopRuntime,
  migrateLegacyLocalStorageToUserData,
  openSampleScriptPluginDir,
  openUserDataDir,
  openPluginDir,
  openPluginDevDir,
  openGalleryPluginDir,
  openPluginDevelopmentDocs,
  openPluginManifestDir,
  readUserText,
  resolveUserDataPath,
  openUserDataSubdir,
  uninstallPluginFromUserDir,
  USER_DATA_PATHS,
  writeUserJson,
  type PluginDiagnosticFixResult,
} from '../features/storage/userDataStorage';
import type {
  MindmapNode,
  MindmapNodeStyle,
  MindmapNodeType,
  MindmapProject,
} from '../features/mindmap/types';

const createCenterNode = (): MindmapNode => ({
  id: 'root',
  text: '中心主题',
  remark: '',
  children: [],
});

const CANVAS_GUIDE_DISMISSED_KEY = 'local-mindmap.canvasGuideDismissed';

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

type ToastKind = 'info' | 'success' | 'warning' | 'error';
type FileSaveStatus =
  | 'saved'
  | 'dirty'
  | 'autosaving'
  | 'autosaved'
  | 'autosave-failed'
  | 'save-failed'
  | 'draft';

const inferToastKind = (text: string): ToastKind => {
  if (/失败|错误|异常|无效/.test(text)) {
    return 'error';
  }

  if (/取消|暂无|没有|未找到|不能|不支持|请先/.test(text)) {
    return 'warning';
  }

  if (/已|成功|完成|通过|找到 \d+ 项/.test(text)) {
    return 'success';
  }

  return 'info';
};

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

const countMindmapNodes = (node: MindmapNode): number =>
  1 + node.children.reduce((sum, child) => sum + countMindmapNodes(child), 0);

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

type PluginRunRecord = {
  status:
    | 'success'
    | 'failed'
    | 'validation_failed'
    | 'timeout'
    | 'runner_disabled';
  message: string;
  lastRunAt: string;
  actionCount?: number;
  appliedActionCount?: number;
  durationMs?: number;
  exitCode?: number | null;
  stdoutSize?: number;
  stderrPreview?: string;
  error?: string;
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
  const effectiveNodeStyle = getEffectiveNodeStyle(node, nodeType);
  const nodeStyle = getNodeStyleCssVariables(
    effectiveNodeStyle,
  ) as CSSProperties;

  return (
    <div
      className="mindmap-node-wrap positioned-node-wrap"
      style={{
        left: layoutNode.x,
        top: layoutNode.y,
        width: layoutNode.width,
        minHeight: layoutNode.height,
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
            nodeType || node.style ? 'has-node-type' : '',
            getNodeShapeClassName(effectiveNodeStyle),
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
          <span className="mindmap-node-shape" aria-hidden="true" />
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
            <span className="mindmap-node-content">
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
            </span>
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
  const [messageKind, setMessageKind] = useState<ToastKind>('info');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isDocumentDirty, setIsDocumentDirty] = useState(true);
  const [fileSaveStatus, setFileSaveStatus] = useState<FileSaveStatus>('draft');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(createDraftId);
  const [fileReliabilitySettings, setFileReliabilitySettings] =
    useState<FileReliabilitySettings>(DEFAULT_FILE_RELIABILITY_SETTINGS);
  const [recoveryDrafts, setRecoveryDrafts] = useState<RecoveryDraftEntry[]>([]);
  const [isRecoveryCenterVisible, setIsRecoveryCenterVisible] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryEntry[]>([]);
  const [isVersionHistoryVisible, setIsVersionHistoryVisible] = useState(false);
  const [versionPreview, setVersionPreview] = useState<{
    entry: VersionHistoryEntry;
    preview: VersionPreview;
  } | null>(null);
  const [isFileStatusVisible, setIsFileStatusVisible] = useState(false);
  const [recentFileHealth, setRecentFileHealth] = useState<
    Record<string, 'ok' | 'missing'>
  >({});
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [excelImportPreview, setExcelImportPreview] =
    useState<ExcelImportPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [searchHasRun, setSearchHasRun] = useState(false);
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
  const [lastPluginExport, setLastPluginExport] = useState<{
    pluginId: string;
    path: string;
  } | null>(null);
  const [recentDevProject, setRecentDevProject] =
    useState<DevPluginProjectResult | null>(null);
  const [recentDevValidation, setRecentDevValidation] =
    useState<DevPluginValidationResult | null>(null);
  const [recentDevPackage, setRecentDevPackage] =
    useState<DevPluginPackageResult | null>(null);
  const [pluginLogs, setPluginLogs] = useState<PluginLogEntry[]>([]);
  const [isScriptRunnerEnabled, setIsScriptRunnerEnabled] = useState(false);
  const [isExternalRunnerEnabled, setIsExternalRunnerEnabled] = useState(false);
  const [pythonPath, setPythonPath] = useState('python');
  const [scriptRunResults, setScriptRunResults] = useState<
    Record<string, PluginRunRecord>
  >({});
  const [workflowRunResults, setWorkflowRunResults] = useState<
    Record<string, PluginRunRecord>
  >({});
  const [externalRunResults, setExternalRunResults] = useState<
    Record<string, PluginRunRecord>
  >({});
  const [userDataDir, setUserDataDir] = useState('浏览器本地存储');
  const [isDesktopApp] = useState(isDesktopRuntime);
  const [isPluginManagerVisible, setIsPluginManagerVisible] = useState(false);
  const [performanceResult, setPerformanceResult] =
    useState<PerformanceBenchmarkResult | null>(null);
  const [activeDrawer, setActiveDrawer] =
    useState<ToolDrawer | null>('templates');
  const [isRemarkPanelCollapsed, setIsRemarkPanelCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const [openCentered, setOpenCentered] = useState(true);
  const [internalClipboard, setInternalClipboard] =
    useState<InternalClipboardState | null>(null);
  const [boxSelection, setBoxSelection] = useState<BoxSelectionState | null>(null);
  const [boxSelectionPreviewIds, setBoxSelectionPreviewIds] = useState<string[]>([]);
  const [isShortcutHelpVisible, setIsShortcutHelpVisible] = useState(false);
  const [isCanvasGuideDismissed, setIsCanvasGuideDismissed] = useState(() => {
    try {
      return localStorage.getItem(CANVAS_GUIDE_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [hasUsedShortcutCreation, setHasUsedShortcutCreation] = useState(false);
  const [hasEditedNode, setHasEditedNode] = useState(false);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const exportTreeRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const panLayerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const canvasPanStateRef = useRef<CanvasPanState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pluginReloadRequestRef = useRef(0);
  const autoSaveTimerRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const lastAutoSaveSignatureRef = useRef('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedNode = selectedNodeId
    ? findNodeById(mindmap, selectedNodeId) ?? mindmap
    : mindmap;
  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );
  const boxSelectionPreviewIdSet = useMemo(
    () => new Set(boxSelectionPreviewIds),
    [boxSelectionPreviewIds],
  );
  const allNodeIds = useMemo(() => Array.from(collectNodeIds(mindmap)), [mindmap]);
  const shouldShowCanvasGuide =
    !isCanvasGuideDismissed &&
    allNodeIds.length < 3 &&
    !hasUsedShortcutCreation &&
    !hasEditedNode;
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
  const mindmapLayout = useMemo(
    () => createMindmapLayout(mindmap, availableNodeTypes),
    [mindmap, availableNodeTypes],
  );
  const nodeHitboxes = useMemo(
    () =>
      mindmapLayout.nodes.map((layoutNode) => ({
        id: layoutNode.id,
        left: layoutNode.x,
        top: layoutNode.y,
        width: layoutNode.width,
        height: layoutNode.height,
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
  const currentDocumentTitle = currentFileName ?? mindmap.text ?? '未命名导图';
  const currentMaskedPath = maskUserDataPath(currentFilePath, userDataDir);
  const effectiveFileSaveStatus: FileSaveStatus = currentFilePath
    ? fileSaveStatus
    : fileSaveStatus === 'autosaved'
      ? 'autosaved'
      : isDocumentDirty
        ? 'draft'
        : fileSaveStatus;
  const fileStatusLabel: Record<FileSaveStatus, string> = {
    saved: '已保存',
    dirty: '未保存',
    autosaving: '自动保存中',
    autosaved: '已自动保存',
    'autosave-failed': '自动保存失败',
    'save-failed': '保存失败',
    draft: '草稿',
  };
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
  const searchRoot = useMemo(
    () =>
      searchScope === 'branch' && selectedNodeId
        ? findNodeById(mindmap, selectedNodeId) ?? mindmap
        : mindmap,
    [mindmap, searchScope, selectedNodeId],
  );
  const rawSearchMatches = useMemo(
    () => findMindmapMatches(searchRoot, searchQuery, searchScope),
    [searchRoot, searchQuery, searchScope],
  );
  const searchMatches = searchHasRun ? rawSearchMatches : [];
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
  const totalTemplateCount = availableOfficialTemplates.length + templates.length;
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
          fileReliabilitySettingsResult,
          recoveryDraftsResult,
          versionHistoryResult,
        ] = await Promise.allSettled([
            loadAllUserTemplates(),
            loadPluginRegistry({
              allowRegistryFallback: migration.migrated,
            }),
            loadAllUserNodeTypes(),
            getUserDataDir(),
            loadRecentFileEntries(),
            loadFileReliabilitySettings(),
            loadRecoveryDrafts(),
            loadVersionHistory(),
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
        if (fileReliabilitySettingsResult.status === 'fulfilled') {
          setFileReliabilitySettings(fileReliabilitySettingsResult.value);
        } else {
          loadFailures.push('fileReliabilitySettings');
          console.error(
            '[user-data][file-reliability] settings load failed',
            fileReliabilitySettingsResult.reason,
          );
        }
        if (recoveryDraftsResult.status === 'fulfilled') {
          setRecoveryDrafts(recoveryDraftsResult.value);
          if (recoveryDraftsResult.value.length > 0) {
            setIsRecoveryCenterVisible(true);
            showMessage('发现未恢复的自动保存草稿', 'warning');
          }
        } else {
          loadFailures.push('recoveryDrafts');
          console.error(
            '[user-data][file-reliability] recovery drafts load failed',
            recoveryDraftsResult.reason,
          );
        }
        if (versionHistoryResult.status === 'fulfilled') {
          setVersionHistory(versionHistoryResult.value);
        } else {
          loadFailures.push('versionHistory');
          console.error(
            '[user-data][file-reliability] version history load failed',
            versionHistoryResult.reason,
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
    let active = true;
    void loadPluginSettings()
      .then((settings) => {
        if (active) {
          setIsScriptRunnerEnabled(settings.scriptRunnerEnabled);
          setIsExternalRunnerEnabled(settings.externalRunnerEnabled);
          setPythonPath(settings.pythonPath);
        }
      })
      .catch(() => {
        if (active) {
          setIsScriptRunnerEnabled(false);
          setIsExternalRunnerEnabled(false);
          setPythonPath('python');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!availableThemes.some((theme) => theme.id === themeId)) {
      setThemeId('default-blue');
      showMessage('当前主题来自已禁用或未安装插件，已切回默认主题');
    }
  }, [availableThemes, themeId]);

  useEffect(() => {
    if (isDocumentDirty && ['saved', 'autosaved'].includes(fileSaveStatus)) {
      setFileSaveStatus(currentFilePath ? 'dirty' : 'draft');
    }
  }, [currentFilePath, fileSaveStatus, isDocumentDirty]);

  useEffect(() => {
    if (!isDesktopApp || recentFiles.length === 0) {
      return;
    }

    let active = true;
    void Promise.all(
      recentFiles.map(async (entry) => {
        try {
          const health = await checkLocalFileHealth(entry.path);
          return [entry.path, health.exists && health.isFile ? 'ok' : 'missing'] as const;
        } catch {
          return [entry.path, 'missing'] as const;
        }
      }),
    ).then((entries) => {
      if (active) {
        setRecentFileHealth(Object.fromEntries(entries));
      }
    });

    return () => {
      active = false;
    };
  }, [isDesktopApp, recentFiles]);

  useEffect(() => {
    setActiveMatchIndex(0);
    setSearchHasRun(false);
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
        isEditingNodeText: Boolean(editingNodeId),
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
        case 'find':
          setActiveDrawer('search');
          showMessage('已打开查找');
          return;
        case 'replace':
          setActiveDrawer('search');
          showMessage('已打开替换');
          return;
        case 'add-child':
          setHasUsedShortcutCreation(true);
          handleAddChild(childNodeTypeId, { startEditing: true });
          return;
        case 'add-sibling':
          setHasUsedShortcutCreation(true);
          handleAddSibling(childNodeTypeId, { startEditing: true });
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

  const showMessage = (text: string, kind: ToastKind = inferToastKind(text)) => {
    window.clearTimeout(messageTimerRef.current);
    setMessage(text);
    setMessageKind(kind);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage('');
      setMessageKind('info');
    }, 2400);
  };

  const dismissCanvasGuide = () => {
    setIsCanvasGuideDismissed(true);
    try {
      localStorage.setItem(CANVAS_GUIDE_DISMISSED_KEY, 'true');
    } catch {
      // localStorage can be unavailable in restricted WebViews.
    }
    showMessage('已关闭新手引导');
  };

  const recordHistory = () => {
    setHistory((currentHistory) => pushHistory(currentHistory, currentProject));
    setIsDocumentDirty(true);
    setFileSaveStatus(currentFilePath ? 'dirty' : 'draft');
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
    setFileSaveStatus('draft');
    setLastSavedAt(null);
    setLastAutoSavedAt(null);
    setDraftId(createDraftId());
    lastAutoSaveSignatureRef.current = '';
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

  const refreshVersionHistory = async () => {
    setVersionHistory(await loadVersionHistory());
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

  const saveMindmapReliable = async (saveAs: boolean) => {
    if (isSavingRef.current) {
      showMessage('正在保存，请稍候', 'warning');
      return;
    }

    isSavingRef.current = true;
    try {
      const documentText = serializeLmindDocument(mindmap, nodeTypes, themeId);
      if (
        currentFilePath &&
        fileReliabilitySettings.backupBeforeSaveEnabled &&
        !saveAs
      ) {
        await createVersionSnapshot({
          documentText,
          source: 'before-save',
          title: '保存前备份',
          currentFilePath,
          currentFileName,
        });
        await refreshVersionHistory();
      }

      const result = await saveLocalFile({
        content: documentText,
        defaultFileName: `${sanitizeFileName(mindmap.text)}.lmind`,
        mimeType: 'application/json;charset=utf-8',
        filterName: 'Local Mindmap 宸ョ▼鏂囦欢',
        extensions: ['lmind'],
        currentPath: currentFilePath,
        forceDialog: saveAs,
        backupOptions: {
          enabled: fileReliabilitySettings.backupBeforeSaveEnabled,
          maxBackupsPerFile: fileReliabilitySettings.maxBackupsPerFile,
        },
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
      const savedAt = new Date().toISOString();
      setIsDocumentDirty(false);
      setFileSaveStatus('saved');
      setLastSavedAt(savedAt);
      lastAutoSaveSignatureRef.current = documentText;
      if (!currentFilePath && result.kind === 'desktop') {
        await deleteRecoveryDraft(draftId);
        setRecoveryDrafts(await loadRecoveryDrafts());
      }
      showFileResult(result, saveAs ? '已另存为' : '已保存');
    } catch (error) {
      setFileSaveStatus('save-failed');
      setIsDocumentDirty(true);
      showMessage(`保存失败：${getErrorMessage(error, '未知错误')}`, 'error');
    } finally {
      isSavingRef.current = false;
    }
  };

  const runAutoSave = async () => {
    if (!fileReliabilitySettings.autoSaveEnabled || isSavingRef.current) {
      return;
    }

    const documentText = serializeLmindDocument(mindmap, nodeTypes, themeId);
    if (documentText === lastAutoSaveSignatureRef.current) {
      return;
    }

    isSavingRef.current = true;
    setFileSaveStatus('autosaving');
    try {
      if (currentFilePath) {
        const result = await saveLocalFile({
          content: documentText,
          defaultFileName: `${sanitizeFileName(mindmap.text)}.lmind`,
          mimeType: 'application/json;charset=utf-8',
          filterName: 'Local Mindmap 宸ョ▼鏂囦欢',
          extensions: ['lmind'],
          currentPath: currentFilePath,
          backupOptions: {
            enabled: fileReliabilitySettings.backupBeforeSaveEnabled,
            maxBackupsPerFile: fileReliabilitySettings.maxBackupsPerFile,
            throttleMs: 5 * 60 * 1000,
          },
        });
        if (result?.kind === 'desktop') {
          await rememberRecentFile(result.path, 'save');
        }
        setIsDocumentDirty(false);
      } else {
        await saveAutosaveDraft({
          draftId,
          documentText,
          title: mindmap.text,
          currentFileName,
          currentFilePath,
        });
        setRecoveryDrafts(await loadRecoveryDrafts());
      }

      await createVersionSnapshot({
        documentText,
        source: 'autosave',
        title: currentFilePath ? '自动保存快照' : '草稿自动保存',
        currentFilePath,
        currentFileName,
      });
      await refreshVersionHistory();

      const savedAt = new Date().toISOString();
      setLastAutoSavedAt(savedAt);
      setFileSaveStatus('autosaved');
      lastAutoSaveSignatureRef.current = documentText;
    } catch (error) {
      setFileSaveStatus('autosave-failed');
      setIsDocumentDirty(true);
      showMessage(`自动保存失败：${getErrorMessage(error, '未知错误')}`, 'error');
    } finally {
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    if (!fileReliabilitySettings.autoSaveEnabled || !isDocumentDirty) {
      return;
    }

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void runAutoSave();
    }, getAutoSaveDelayMs(fileReliabilitySettings));

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    currentFilePath,
    draftId,
    fileReliabilitySettings,
    isDocumentDirty,
    mindmap,
    nodeTypes,
    themeId,
  ]);

  const handleSaveMindmap = () => void saveMindmapReliable(false);
  const handleSaveMindmapAs = () => void saveMindmapReliable(true);

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
      setFileSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      setLastAutoSavedAt(null);
      setDraftId(createDraftId());
      lastAutoSaveSignatureRef.current = opened.content;
      if (openCentered) {
        setCanvasView(centerCanvasView());
      }
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
      const content = await readLocalTextFile(entry.path);
      const openedProject = parseLmindProject(content);
      recordHistory();
      applyProject(openedProject);
      setCurrentFilePath(entry.path);
      setCurrentFileName(entry.name);
      setIsDocumentDirty(false);
      setFileSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      setLastAutoSavedAt(null);
      setDraftId(createDraftId());
      lastAutoSaveSignatureRef.current = content;
      if (openCentered) {
        setCanvasView(centerCanvasView());
      }
      await rememberRecentFile(entry.path, 'open');
      showMessage(`已打开：${entry.path}`);
    } catch (error) {
      showMessage(
        `打开失败：${getErrorMessage(error, '文件不存在或格式不正确')}`,
      );
    }
  };

  const handleRemoveRecentFile = async (entry: RecentFileEntry) => {
    const next = recentFiles.filter((item) => item.path !== entry.path);
    setRecentFiles(next);
    setRecentFileHealth((current) => {
      const { [entry.path]: _removed, ...rest } = current;
      return rest;
    });
    await writeUserJson(USER_DATA_PATHS.recentFiles, next);
    showMessage('已从最近文件移除');
  };

  const handleRelocateRecentFile = async (entry: RecentFileEntry) => {
    try {
      const opened = await openLocalTextFile({
        accept: '.lmind,application/json',
        filterName: 'Local Mindmap 宸ョ▼鏂囦欢',
        extensions: ['lmind'],
      });
      if (!opened?.path) {
        return;
      }
      const openedProject = parseLmindProject(opened.content);
      recordHistory();
      applyProject(openedProject);
      setCurrentFilePath(opened.path);
      setCurrentFileName(opened.fileName);
      setIsDocumentDirty(false);
      setFileSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      lastAutoSaveSignatureRef.current = opened.content;
      const next = await updateRecentFile(
        recentFiles.filter((item) => item.path !== entry.path),
        opened.path,
        'open',
      );
      setRecentFiles(next);
      showMessage('已重新定位最近文件');
    } catch (error) {
      showMessage(`重新定位失败：${getErrorMessage(error, '无法打开文件')}`, 'error');
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

  const handleCreateVersionSnapshot = async () => {
    const note = window.prompt('快照备注（可选）', '手动快照')?.trim() || '手动快照';
    try {
      await createVersionSnapshot({
        documentText: serializeLmindDocument(mindmap, nodeTypes, themeId),
        source: 'manual',
        note,
        title: note,
        currentFilePath,
        currentFileName,
      });
      await refreshVersionHistory();
      showMessage('已创建版本快照', 'success');
    } catch (error) {
      showMessage(`创建版本快照失败：${getErrorMessage(error, '未知错误')}`, 'error');
    }
  };

  const handleOpenVersionHistory = async () => {
    await refreshVersionHistory();
    setIsVersionHistoryVisible(true);
  };

  const handlePreviewVersion = async (entry: VersionHistoryEntry) => {
    try {
      setVersionPreview({
        entry,
        preview: await previewVersionSnapshot(entry),
      });
    } catch (error) {
      showMessage(`预览历史版本失败：${getErrorMessage(error, '无法读取版本')}`, 'error');
    }
  };

  const handleRestoreVersion = async (entry: VersionHistoryEntry) => {
    const confirmed = window.confirm(
      '这会用所选历史版本替换当前导图内容。当前状态会先自动创建一个恢复前快照。是否继续？',
    );
    if (!confirmed) {
      return;
    }

    try {
      const currentDocumentText = serializeLmindDocument(mindmap, nodeTypes, themeId);
      await createVersionSnapshot({
        documentText: currentDocumentText,
        source: 'recovery-before-restore',
        title: '恢复前快照',
        currentFilePath,
        currentFileName,
      });
      const restoredProject = await readUserLmindProject(entry.path);
      recordHistory();
      applyProject(restoredProject);
      setIsDocumentDirty(true);
      setFileSaveStatus(currentFilePath ? 'dirty' : 'draft');
      await refreshVersionHistory();
      showMessage('已恢复历史版本，请保存以写入文件', 'success');
    } catch (error) {
      showMessage(`恢复历史版本失败：${getErrorMessage(error, '未知错误')}`, 'error');
    }
  };

  const handleSaveVersionAs = async (entry: VersionHistoryEntry) => {
    try {
      const content = await readUserText(entry.path);
      const result = await saveLocalFile({
        content,
        defaultFileName: `${sanitizeFileName(entry.rootText || entry.title)}.lmind`,
        mimeType: 'application/json;charset=utf-8',
        filterName: 'Local Mindmap 宸ョ▼鏂囦欢',
        extensions: ['lmind'],
        forceDialog: true,
      });
      if (result) {
        showFileResult(result, '已另存历史版本为');
      }
    } catch (error) {
      showMessage(`另存历史版本失败：${getErrorMessage(error, '未知错误')}`, 'error');
    }
  };

  const handleDeleteVersion = async (entry: VersionHistoryEntry) => {
    if (!window.confirm('删除该历史版本？此操作不会删除当前导图。')) {
      return;
    }
    await deleteVersionSnapshot(entry.id);
    await refreshVersionHistory();
    setVersionPreview(null);
    showMessage('已删除历史版本');
  };

  const handleRestoreDraft = async (draft: RecoveryDraftEntry) => {
    try {
      const project = await readUserLmindProject(draft.path);
      recordHistory();
      applyProject(project);
      setCurrentFilePath(null);
      setCurrentFileName(null);
      setDraftId(draft.draftId);
      setIsDocumentDirty(true);
      setFileSaveStatus('draft');
      setIsRecoveryCenterVisible(false);
      showMessage('已恢复自动保存草稿，请保存以写入文件', 'success');
    } catch (error) {
      showMessage(`恢复草稿失败：${getErrorMessage(error, '无法读取草稿')}`, 'error');
    }
  };

  const handleDeleteDraft = async (draft: RecoveryDraftEntry) => {
    if (!window.confirm('删除该自动保存草稿？')) {
      return;
    }
    await deleteRecoveryDraft(draft.draftId);
    const drafts = await loadRecoveryDrafts();
    setRecoveryDrafts(drafts);
    if (drafts.length === 0) {
      setIsRecoveryCenterVisible(false);
    }
    showMessage('已删除自动保存草稿');
  };

  const updateFileReliabilitySettings = async (
    patch: Partial<FileReliabilitySettings>,
  ) => {
    const next = {
      ...fileReliabilitySettings,
      ...patch,
    };
    setFileReliabilitySettings(next);
    await saveFileReliabilitySettings(next);
  };

  const handleCleanAutosaveDrafts = async () => {
    if (!window.confirm('清理当前列出的自动保存草稿？')) {
      return;
    }
    for (const draft of recoveryDrafts) {
      await deleteRecoveryDraft(draft.draftId);
    }
    setRecoveryDrafts(await loadRecoveryDrafts());
    showMessage('已清理自动保存草稿');
  };

  const isAutoSaveEnabled = fileReliabilitySettings.autoSaveEnabled;
  const setIsAutoSaveEnabled = (enabled: boolean) => {
    void updateFileReliabilitySettings({ autoSaveEnabled: enabled });
  };
  const setAutoSaveInterval = (intervalMs: number) => {
    void updateFileReliabilitySettings({ autoSaveIntervalMs: intervalMs });
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

  const handleInstallPlugin = async (
    source: 'manager' | 'dev-workbench' = 'manager',
  ) => {
    try {
      const pluginPackage = await readLocalPluginPackage();

      if (!pluginPackage) {
        return;
      }
      const { manifest } = pluginPackage;
      if (manifest.pluginType === 'script' && !pluginPackage.packagePath) {
        if (!manifest.entry || !pluginPackage.scriptEntry?.sourcePath) {
          throw new Error(
            `导入失败：脚本入口文件不存在：${manifest.entry ?? 'main.js'}。`,
          );
        }
      }
      if (
        manifest.pluginType === 'external-command' &&
        !pluginPackage.packagePath
      ) {
        if (!manifest.entry || !pluginPackage.externalEntry?.sourcePath) {
          throw new Error(
            `导入失败：外部命令入口文件不存在：${manifest.entry ?? 'entry'}。`,
          );
        }
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

      const installAssets = [
        ...(pluginPackage.scriptEntry
          ? [
              {
                relativePath: pluginPackage.scriptEntry.relativePath,
                sourcePath: pluginPackage.scriptEntry.sourcePath,
              },
            ]
          : pluginPackage.externalEntry
            ? [
                {
                  relativePath: pluginPackage.externalEntry.relativePath,
                  sourcePath: pluginPackage.externalEntry.sourcePath,
                },
              ]
            : []),
        ...(pluginPackage.readme
          ? [
              {
                relativePath: pluginPackage.readme.relativePath,
                sourcePath: pluginPackage.readme.sourcePath,
                optional: true,
              },
            ]
          : []),
      ];
      const {
        plugins: nextPlugins,
        manifest: installedManifest,
      } = await installPlugin(
        plugins,
        manifest,
        exists,
        installAssets,
        pluginPackage.manifestSourcePath,
        pluginPackage.packagePath,
      );
      setPlugins(nextPlugins);
      setLastPluginInstallError('');
      const installPaths =
        `已${exists ? '覆盖安装' : '安装'}插件：${installedManifest.name}。` +
        `pluginId：${installedManifest.pluginId}。` +
        `版本：${installedManifest.version}。` +
        `安装目录：plugins/installed/${installedManifest.pluginId}。` +
        '已更新插件注册表：plugins/plugin-registry.json。';
      const warningCount = installedManifest.validationWarnings?.length ?? 0;
      recordPluginLog(
        'info',
        installedManifest.pluginType === 'script'
          ? 'script-plugin-imported'
          : installedManifest.pluginType === 'external-command'
            ? 'external-plugin-imported'
          : installedManifest.pluginType === 'action-workflow'
            ? 'workflow-imported'
          : 'import-success',
        `${exists ? '覆盖安装' : '导入'}成功：${installedManifest.name}`,
        installedManifest.pluginId,
      );
      if (source === 'dev-workbench') {
        recordPluginLog(
          'info',
          'dev-package-import-verified',
          `dev package import verified；安装目录：plugins/installed/${installedManifest.pluginId}；trusted=${String(
            installedManifest.trusted,
          )}`,
          installedManifest.pluginId,
        );
      }
      for (const diagnostic of createPluginDiagnosticLogs([
        installedManifest,
      ])) {
        setPluginLogs((current) => appendPluginLog(current, diagnostic));
      }
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
      recordPluginLog('error', 'import-failure', errorMessage);
      showMessage(errorMessage);
    }
  };

  const handleInstallGalleryPlugin = async (item: PluginGalleryItem) => {
    if (!isDesktopApp) {
      showMessage('本地插件中心仅在桌面端可用。');
      return;
    }
    if (!item.installable || !item.manifest) {
      const errorMessage = item.error ?? '该 gallery 插件当前不可安装。';
      setLastPluginInstallError(errorMessage);
      showMessage(errorMessage);
      return;
    }
    const warning = getPluginGalleryInstallWarning(item.pluginType);
    if (warning && !window.confirm(`${warning}\n\n是否继续安装？`)) {
      return;
    }
    const existing = plugins.find(
      (plugin) => plugin.pluginId === item.id && !plugin.builtIn,
    );
    if (
      existing &&
      !window.confirm(
        `插件已安装：${existing.name}\n` +
          `当前版本：${existing.version}\n` +
          `示例版本：${item.manifest.version}\n` +
          '重新安装会保留 enabled / trusted。是否继续？',
      )
    ) {
      return;
    }

    try {
      const result = await installGalleryPlugin(item.id, Boolean(existing));
      const reloadedPlugins = await loadPluginRegistry();
      setPlugins(reloadedPlugins);
      setLastPluginInstallError('');
      recordPluginLog(
        'info',
        item.pluginType === 'script'
          ? 'script-plugin-imported'
          : item.pluginType === 'external-command'
            ? 'external-plugin-imported'
            : item.pluginType === 'action-workflow'
              ? 'workflow-imported'
              : 'import-success',
        `已从本地插件中心${existing ? '重新安装' : '安装'}：${result.name}`,
        result.pluginId,
      );
      showMessage(
        `已${existing ? '重新安装' : '安装'}插件：${result.name}。` +
          `版本：${result.version}。安装目录：${result.installedDir}。` +
          (existing
            ? '已保留 enabled / trusted。'
            : '新安装 trusted=false；运行器状态未改变。'),
      );
    } catch (error) {
      const errorMessage = `本地插件中心安装失败：${getErrorMessage(
        error,
        '未知错误',
      )}`;
      setLastPluginInstallError(errorMessage);
      recordPluginLog('error', 'import-failure', errorMessage, item.id);
      showMessage(errorMessage);
    }
  };

  const handleOpenGalleryPluginDir = async (catalogId: string) => {
    try {
      const opened = await openGalleryPluginDir(catalogId);
      showMessage(
        opened ? '已打开官方示例插件目录。' : 'Web 端不支持打开示例目录。',
      );
    } catch (error) {
      showMessage(
        `打开示例目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleOpenPluginDevelopmentDocs = async () => {
    try {
      const opened = await openPluginDevelopmentDocs();
      showMessage(
        opened ? '已打开插件开发文档。' : 'Web 端不支持打开本地文档。',
      );
    } catch (error) {
      showMessage(
        `打开插件开发文档失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    const nextPlugins = setPluginEnabled(plugins, pluginId, enabled);
    try {
      await savePluginRegistry(nextPlugins);
      setPlugins(nextPlugins);
      recordPluginLog(
        'info',
        enabled ? 'enabled' : 'disabled',
        enabled ? '插件已启用' : '插件已禁用',
        pluginId,
      );
      showMessage(enabled ? '插件已启用' : '插件已禁用');
    } catch (error) {
      showMessage(getErrorMessage(error, '插件状态保存失败'));
    }
  };

  const handleSetPluginTrusted = async (
    pluginId: string,
    trusted: boolean,
  ) => {
    const targetPlugin = plugins.find((plugin) => plugin.pluginId === pluginId);
    const isWorkflow = targetPlugin?.pluginType === 'action-workflow';
    const isExternal = targetPlugin?.pluginType === 'external-command';
    const nextPlugins = setPluginTrusted(plugins, pluginId, trusted);
    try {
      await savePluginRegistry(nextPlugins);
      setPlugins(nextPlugins);
      recordPluginLog(
        'info',
        isExternal
          ? trusted
            ? 'external-trust-granted'
            : 'external-trust-revoked'
          : isWorkflow
          ? trusted
            ? 'workflow-trust-granted'
            : 'workflow-trust-revoked'
          : trusted
            ? 'script-trust-granted'
            : 'script-trust-revoked',
        `${isExternal ? 'external' : isWorkflow ? 'workflow' : 'script'} trust ${trusted ? 'granted' : 'revoked'}`,
        pluginId,
      );
      showMessage(trusted ? '已信任此插件' : '已取消信任此插件');
    } catch (error) {
      showMessage(getErrorMessage(error, '插件信任状态保存失败'));
    }
  };

  const handleScriptRunnerEnabledChange = async (enabled: boolean) => {
    try {
      await savePluginSettings({
        scriptRunnerEnabled: enabled,
        externalRunnerEnabled: isExternalRunnerEnabled,
        pythonPath,
      });
      setIsScriptRunnerEnabled(enabled);
      recordPluginLog(
        'info',
        'script-runner-setting-saved',
        `script runner setting saved: ${enabled ? 'enabled' : 'disabled'}`,
      );
      showMessage(enabled ? '脚本插件运行器已启用' : '脚本插件运行器已关闭');
    } catch (error) {
      showMessage(getErrorMessage(error, '脚本运行器设置保存失败'));
    }
  };

  const handleExternalRunnerEnabledChange = async (enabled: boolean) => {
    try {
      await savePluginSettings({
        scriptRunnerEnabled: isScriptRunnerEnabled,
        externalRunnerEnabled: enabled,
        pythonPath,
      });
      setIsExternalRunnerEnabled(enabled);
      recordPluginLog(
        'info',
        enabled ? 'external-runner-enabled' : 'external-runner-disabled',
        `external runner ${enabled ? 'enabled' : 'disabled'}`,
      );
      showMessage(
        enabled ? '外部命令插件运行器已启用' : '外部命令插件运行器已关闭',
      );
    } catch (error) {
      showMessage(getErrorMessage(error, '外部命令运行器设置保存失败'));
    }
  };

  const handleSavePythonPath = async (nextPythonPath: string) => {
    const normalizedPath = nextPythonPath.trim() || 'python';
    try {
      await savePluginSettings({
        scriptRunnerEnabled: isScriptRunnerEnabled,
        externalRunnerEnabled: isExternalRunnerEnabled,
        pythonPath: normalizedPath,
      });
      setPythonPath(normalizedPath);
      recordPluginLog(
        'info',
        'python-path-saved',
        `python path saved: ${normalizedPath}`,
      );
      showMessage('Python 路径已保存。');
    } catch (error) {
      showMessage(getErrorMessage(error, 'Python 路径保存失败'));
    }
  };

  const handleTestPython = async (candidatePath: string) => {
    try {
      const result = await testPythonRuntime(candidatePath);
      if (!result.ok) {
        const reason = result.error ?? 'Python 测试失败。';
        recordPluginLog('error', 'python-test-failed', reason);
        showMessage(reason);
        return;
      }
      recordPluginLog(
        'info',
        'python-test-succeeded',
        `python test succeeded: ${result.version ?? 'unknown'}`,
      );
      showMessage(`Python 可用：${result.version ?? '版本未知'}`);
    } catch (error) {
      const reason = getErrorMessage(error, 'Python 测试失败。');
      recordPluginLog('error', 'python-test-failed', reason);
      showMessage(reason);
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
      recordPluginLog('info', 'uninstalled', '插件已卸载', pluginId);
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

  const recordPluginLog = (
    level: PluginLogLevel,
    event: PluginLogEvent,
    message: string,
    pluginId?: string,
    details: Pick<
      PluginLogEntry,
      'menuId' | 'actionCount' | 'durationMs'
    > = {},
  ) => {
    setPluginLogs((current) =>
      appendPluginLog(
        current,
        createPluginLog({ level, event, message, pluginId, ...details }),
      ),
    );
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

  const handleExportPluginPackage = async (pluginId: string) => {
    try {
      const path = await exportPluginPackage(pluginId);
      if (!path) return;
      setLastPluginExport({ pluginId, path });
      showMessage(`插件包导出成功：${path}`);
    } catch (error) {
      showMessage(`插件包导出失败：${getErrorMessage(error, '未知错误')}`);
    }
  };

  const handleCopyExportedPluginPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showMessage('插件包完整路径已复制');
    } catch {
      showMessage('复制插件包路径失败');
    }
  };

  const handleOpenExportedPluginLocation = async (path: string) => {
    try {
      await openFileLocation(path);
      showMessage('已打开插件包所在目录');
    } catch (error) {
      showMessage(`打开所在目录失败：${getErrorMessage(error, '未知错误')}`);
    }
  };

  const handleOpenPluginDir = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端打开本地目录');
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

  const handleOpenPluginDevDir = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端打开本地目录');
      return;
    }
    try {
      await openPluginDevDir();
      showMessage('已打开插件开发目录');
    } catch (error) {
      showMessage(
        `打开插件开发目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleDiagnosticFixResults = (
    results: PluginDiagnosticFixResult[],
  ) => {
    if (results.length === 0) {
      return;
    }
    setPluginLogs((currentLogs) =>
      results.reduce((logs, result) => {
        const level: PluginLogLevel =
          result.status === 'fixed' ? 'info' : 'error';
        return appendPluginLog(
          logs,
          createPluginLog({
            level,
            event: 'diagnostics-fix',
            pluginId: result.pluginId ?? undefined,
            message: `${result.action}: ${result.message}${
              result.backupPath ? ` backup=${result.backupPath}` : ''
            }`,
          }),
        );
      }, currentLogs),
    );
  };

  const handleCreateDevPluginProject = async (
    request: DevPluginProjectRequest,
  ) => {
    if (!isDesktopApp) {
      throw new Error('插件开发者工作台仅在桌面端可用。');
    }
    try {
      let result: DevPluginProjectResult;
      try {
        result = await createDevPluginProject({
          ...request,
          overwrite: false,
        });
      } catch (error) {
        const message = getErrorMessage(error, '创建插件项目失败。');
        if (
          message.includes('插件项目已存在') &&
          window.confirm(`${message}\n\n是否覆盖已有项目？`)
        ) {
          result = await createDevPluginProject({
            ...request,
            overwrite: true,
          });
        } else {
          throw error;
        }
      }
      setRecentDevProject(result);
      setRecentDevValidation(null);
      setRecentDevPackage(null);
      recordPluginLog(
        'info',
        'dev-project-created',
        `dev project created：${result.directoryPath}`,
        result.pluginId,
      );
      showMessage(
        `${result.overwritten ? '已覆盖并重新创建' : '插件项目已创建'}：${result.directoryPath}`,
      );
      return result;
    } catch (error) {
      const message = `创建插件项目失败：${getErrorMessage(
        error,
        '未知错误',
      )}`;
      showMessage(message);
      throw new Error(message);
    }
  };

  const handleValidateDevPluginProject = async (pluginId: string) => {
    if (!isDesktopApp) {
      throw new Error('插件开发者工作台仅在桌面端可用。');
    }
    try {
      const result: DevPluginValidationResult =
        await validateDevPluginProject(pluginId);
      setRecentDevValidation(result);
      recordPluginLog(
        result.valid ? 'info' : 'error',
        result.valid
          ? 'dev-manifest-validated'
          : 'dev-project-validation-failed',
        result.valid
          ? `dev manifest validated：${result.pluginId}`
          : `dev project validation failed：${result.errors
              .map((issue) => issue.message)
              .join('；')}`,
        result.pluginId ?? pluginId,
      );
      showMessage(
        result.valid
          ? `插件项目校验通过，可打包。warnings=${result.warnings.length}`
          : `插件项目校验失败：${result.errors.length} 个 errors，${result.warnings.length} 个 warnings。`,
      );
      return result;
    } catch (error) {
      const message = `校验插件项目失败：${getErrorMessage(
        error,
        '未知错误',
      )}`;
      recordPluginLog(
        'error',
        'dev-project-validation-failed',
        message,
        pluginId,
      );
      showMessage(message);
      throw new Error(message);
    }
  };

  const handleBuildDevPluginPackage = async (pluginId: string) => {
    if (!isDesktopApp) {
      throw new Error('插件开发者工作台仅在桌面端可用。');
    }
    try {
      const result = await buildDevPluginPackage(pluginId);
      if (!result) {
        return null;
      }
      setRecentDevValidation(result.validation);
      setRecentDevPackage(result);
      recordPluginLog(
        'info',
        'dev-package-built',
        `dev package built：${result.packagePath}`,
        result.pluginId,
      );
      showMessage(`插件包打包成功：${result.packagePath}`);
      return result;
    } catch (error) {
      const message = `插件包打包失败：${getErrorMessage(
        error,
        '未知错误',
      )}`;
      recordPluginLog(
        'error',
        'dev-package-build-failed',
        message,
        pluginId,
      );
      showMessage(message);
      throw new Error(message);
    }
  };

  const handleOpenDevPluginProjectDir = async (pluginId: string) => {
    try {
      await openDevPluginProjectDir(pluginId);
      showMessage('已打开插件项目目录。');
    } catch (error) {
      showMessage(
        `打开插件项目目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleOpenPluginExamplesDir = async () => {
    try {
      await openPluginExamplesDir();
      showMessage('已打开示例插件目录。');
    } catch (error) {
      showMessage(
        `打开示例插件目录失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCreateSamplePlugin = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端创建本地插件目录');
      return;
    }
    try {
      const result = await createSamplePlugin();
      if (!result) {
        showMessage('不支持在 Web 端创建本地插件目录');
        return;
      }
      showMessage(
        result.created
          ? `示例插件已创建：${result.directoryPath}`
          : '示例插件已存在，未覆盖用户文件；请打开插件开发目录查看。',
      );
    } catch (error) {
      showMessage(
        `创建示例插件失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCreateSampleScriptPlugin = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端创建本地脚本插件目录。');
      return;
    }
    try {
      const result = await createSampleScriptPlugin();
      if (!result) {
        showMessage('不支持在 Web 端创建本地脚本插件目录。');
        return;
      }
      showMessage(
        result.created
          ? `脚本插件示例已创建：${result.directoryPath}`
          : '脚本插件示例已存在，未覆盖用户文件。',
      );
    } catch (error) {
      showMessage(
        `创建脚本插件示例失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCreateSampleBatchScriptPlugin = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端创建本地批量脚本插件目录。');
      return;
    }
    try {
      const result = await createSampleBatchScriptPlugin();
      if (!result) {
        showMessage('不支持在 Web 端创建本地批量脚本插件目录。');
        return;
      }
      showMessage(
        result.created
          ? `批量脚本插件示例已创建：${result.directoryPath}`
          : '批量脚本插件示例已存在，未覆盖用户文件。',
      );
    } catch (error) {
      showMessage(
        `创建批量脚本插件示例失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleOpenSampleScriptPluginDir = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端打开本地脚本插件目录。');
      return;
    }
    try {
      await openSampleScriptPluginDir();
      showMessage('已打开脚本插件示例目录。');
    } catch (error) {
      showMessage(
        `打开脚本插件示例目录失败：${getErrorMessage(error, '未知错误')}`,
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
      recordPluginLog('info', 'reload-success', '插件已重新加载。');
      for (const diagnostic of createPluginDiagnosticLogs(reloadedPlugins)) {
        setPluginLogs((current) => appendPluginLog(current, diagnostic));
      }
      showMessage('插件已重新加载。');
    } catch (error) {
      if (requestId !== pluginReloadRequestRef.current) {
        return;
      }
      const errorMessage =
        `插件重新加载失败：${getErrorMessage(error, '未知错误')}`;
      recordPluginLog('error', 'reload-failure', errorMessage);
      showMessage(errorMessage);
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

  const applyTypedNodeCreation = (
    result: TypedNodeCreationResult,
    options: { startEditing?: boolean } = {},
  ) => {
    setMindmap(result.rootNode);
    setSelectedNodeId(result.selectedNodeId);
    setSelectedNodeIds(result.selectedNodeIds);
    setEditingNodeId(options.startEditing ? result.createdNode.id : null);
    setEditingText(options.startEditing ? result.createdNode.text : '');
  };

  const handleAddChild = (
    nodeTypeId = childNodeTypeId,
    options: { startEditing?: boolean } = {},
  ) => {
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
    applyTypedNodeCreation(result, options);
  };

  const handleAddSibling = (
    nodeTypeId = childNodeTypeId,
    options: { startEditing?: boolean } = {},
  ) => {
    if (!selectedNodeId) {
      showMessage('请先选择节点');
      return;
    }

    if (selectedNodeId === mindmap.id) {
      showMessage('中心主题不能新建同级节点，请使用 Tab 新建子节点');
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
    applyTypedNodeCreation(result, options);
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
    setHasEditedNode(true);
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

  const handleRunSearch = () => {
    setSearchHasRun(true);
    setActiveMatchIndex(0);
    if (!searchQuery.trim()) {
      showMessage('请输入关键词');
      return;
    }
    showMessage(
      rawSearchMatches.length > 0
        ? `找到 ${rawSearchMatches.length} 项`
        : '未找到匹配项',
    );
  };

  const jumpToMatch = (nextIndex: number) => {
    const currentMatches = searchHasRun ? searchMatches : rawSearchMatches;

    if (!searchHasRun) {
      setSearchHasRun(true);
    }

    if (currentMatches.length === 0) {
      showMessage(
        rawSearchMatches.length > 0
          ? `找到 ${rawSearchMatches.length} 项`
          : '没有匹配结果',
      );
      return;
    }

    const normalizedIndex =
      (nextIndex + currentMatches.length) % currentMatches.length;
    setActiveMatchIndex(normalizedIndex);
    setSelectedNodeId(currentMatches[normalizedIndex].nodeId);
    setSelectedNodeIds([currentMatches[normalizedIndex].nodeId]);
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
    const currentMatches = searchHasRun ? searchMatches : rawSearchMatches;

    if (!query || currentMatches.length === 0) {
      showMessage('没有可替换的匹配项');
      return;
    }

    const confirmed = window.confirm(
      `将替换 ${currentMatches.length} 处匹配内容，是否继续？`,
    );

    if (!confirmed) {
      return;
    }

    recordHistory();
    setMindmap((currentMindmap) =>
      searchScope === 'branch' && selectedNodeId
        ? updateNodeById(currentMindmap, selectedNodeId, (node) =>
            replaceAllInMindmap(node, query, replacementText, 'all'),
          )
        : replaceAllInMindmap(currentMindmap, query, replacementText, searchScope),
    );
    setSearchHasRun(true);
    showMessage(`全部替换完成：${currentMatches.length} 处`);
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

  const handleSelectedNodeStyleChange = (style: MindmapNodeStyle) => {
    if (!selectedNodeId) {
      showMessage('请先选择节点');
      return;
    }

    recordHistory();
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNodeId, (node) => ({
        ...node,
        style: mergeNodeStyle(node.style, style),
      })),
    );
    showMessage('已修改节点样式');
  };

  const handleSaveSelectedStyleAsNodeType = async (name: string) => {
    if (!selectedNodeId) {
      showMessage('请先选择节点');
      return;
    }

    const selectedNodeType = findNodeTypeById(
      availableNodeTypes,
      selectedNode.nodeTypeId,
    );
    const nextNodeType = createNodeTypeFromStyle(
      name,
      getEffectiveNodeStyle(selectedNode, selectedNodeType),
      selectedNode,
    );

    if (!nextNodeType) {
      showMessage('请先填写节点类型名称');
      return;
    }

    recordHistory();
    const nextNodeTypes = [...nodeTypes, nextNodeType];
    try {
      await saveLocalNodeTypes(nextNodeTypes);
      setNodeTypes(nextNodeTypes);
      setUserNodeTypes(nextNodeTypes);
      showMessage('已保存为节点类型');
    } catch (error) {
      showMessage(getErrorMessage(error, '节点类型保存失败'));
    }
  };

  const handleApplySelectedStyleToNodeType = async () => {
    if (!selectedNode.nodeTypeId) {
      showMessage('当前节点未使用节点类型');
      return;
    }

    const targetNodeType = nodeTypes.find(
      (nodeType) => nodeType.id === selectedNode.nodeTypeId,
    );

    if (!targetNodeType) {
      showMessage('插件或文件内置节点类型不能在此处直接修改');
      return;
    }

    const confirmed = window.confirm(
      `这会更新「${targetNodeType.name}」的全局样式，并影响所有使用该节点类型的节点。是否继续？`,
    );

    if (!confirmed) {
      return;
    }

    const nextStyle = getEffectiveNodeStyle(selectedNode, targetNodeType);
    const nextNodeTypes = nodeTypes.map((nodeType) =>
      nodeType.id === targetNodeType.id
        ? applyStyleToNodeType(nodeType, nextStyle)
        : nodeType,
    );

    recordHistory();
    try {
      await saveLocalNodeTypes(nextNodeTypes);
      setNodeTypes(nextNodeTypes);
      setUserNodeTypes(nextNodeTypes);
      showMessage('已应用到当前节点类型');
    } catch (error) {
      showMessage(getErrorMessage(error, '节点类型保存失败'));
    }
  };

  const handleResetSelectedNodeStyle = () => {
    if (!selectedNodeId) {
      showMessage('请先选择节点');
      return;
    }

    recordHistory();
    setMindmap((currentMindmap) =>
      updateNodeById(currentMindmap, selectedNodeId, (node) => ({
        ...node,
        style: undefined,
      })),
    );
    showMessage('已重置节点样式');
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

  const showScriptMessages = (messages: ScriptShowMessageAction[]) => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      showMessage(lastMessage.message);
    }
  };

  const setScriptRunResult = (
    pluginId: string,
    result: (typeof scriptRunResults)[string],
  ) => {
    setScriptRunResults((current) => ({
      ...current,
      [pluginId]: result,
    }));
  };

  const handleRunScriptPlugin = async (
    pluginId?: string,
    contextNodeId?: string,
  ) => {
    if (!pluginId) {
      showMessage('脚本插件缺少 pluginId。');
      return;
    }
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin?.enabled) {
      showMessage(`插件已禁用：${pluginId}`);
      return;
    }
    if (plugin.manifestValid === false) {
      showMessage(`插件 manifest 无效：${pluginId}`);
      return;
    }
    if (plugin.pluginType !== 'script') {
      showMessage(`插件不是 script 类型：${pluginId}`);
      return;
    }
    if (!plugin.entry) {
      showMessage(`脚本插件缺少 entry：${pluginId}`);
      return;
    }
    if (!isScriptRunnerEnabled) {
      const messageText = '脚本插件运行器尚未启用。';
      setScriptRunResult(pluginId, {
        status: 'runner_disabled',
        message: messageText,
        lastRunAt: new Date().toISOString(),
        error: messageText,
      });
      recordPluginLog(
        'warning',
        'script-runner-disabled',
        messageText,
        pluginId,
      );
      showMessage(messageText);
      return;
    }

    const writePermissions = getScriptWritePermissions(plugin);
    if (shouldConfirmScriptPluginRun(plugin)) {
      recordPluginLog(
        'warning',
        'script-trust-requested',
        `script trust requested permissions=${writePermissions.join(', ')}`,
        pluginId,
      );
      const allowed = window.confirm(
        `该脚本插件请求修改当前导图：\n插件：${plugin.name}\n权限：${writePermissions.join(', ')}\n\n确定：允许本次执行\n取消：取消执行`,
      );
      if (!allowed) {
        showMessage('已取消脚本执行。');
        return;
      }
    }

    const scriptPath = `plugins/installed/${plugin.pluginId}/${plugin.entry}`;
    recordPluginLog(
      'info',
      'script-execution-started',
      `script execution started: ${plugin.entry}`,
      pluginId,
    );
    try {
      const source = await readUserText(scriptPath);
      const effectiveSelectedNodeId = contextNodeId ?? selectedNodeId;
      const context = createScriptPluginContext(
        mindmap,
        effectiveSelectedNodeId,
        contextNodeId ? [contextNodeId] : selectedNodeIds,
      );
      recordPluginLog(
        'info',
        'script-context-built',
        `script context built nodeCount=${context.nodes.length} truncated=${Boolean(context.truncated)}`,
        pluginId,
      );
      const runResult = await runScriptPlugin({ source, context });
      if (!runResult.ok) {
        const isTimeout = runResult.error.includes('执行超时');
        setScriptRunResult(pluginId, {
          status: isTimeout ? 'timeout' : 'failed',
          message: runResult.error,
          lastRunAt: new Date().toISOString(),
          durationMs: runResult.durationMs,
          error: runResult.error,
        });
        recordPluginLog(
          'error',
          'script-execution-failed',
          `${runResult.error} durationMs=${runResult.durationMs}`,
          pluginId,
        );
        showMessage(`脚本执行失败：${runResult.error}`);
        return;
      }

      const validation = validateScriptPluginActions(
        runResult.actions,
        mindmap,
      );
      if (!validation.valid) {
        setScriptRunResult(pluginId, {
          status: 'validation_failed',
          message: validation.error,
          lastRunAt: new Date().toISOString(),
          durationMs: runResult.durationMs,
          actionCount: Array.isArray(runResult.actions)
            ? runResult.actions.length
            : undefined,
          appliedActionCount: 0,
          error: validation.error,
        });
        recordPluginLog(
          'error',
          'script-action-validation-failed',
          `${validation.error} durationMs=${runResult.durationMs}`,
          pluginId,
        );
        showMessage(`脚本 action 校验失败：${validation.error}`);
        return;
      }
      const permissionValidation = validateScriptActionPermissions(
        validation.actions,
        plugin.permissions,
      );
      if (!permissionValidation.valid) {
        setScriptRunResult(pluginId, {
          status: 'validation_failed',
          message: permissionValidation.error,
          lastRunAt: new Date().toISOString(),
          durationMs: runResult.durationMs,
          actionCount: validation.actions.length,
          appliedActionCount: 0,
          error: permissionValidation.error,
        });
        recordPluginLog(
          'error',
          'script-action-validation-failed',
          permissionValidation.error,
          pluginId,
        );
        showMessage(`脚本权限校验失败：${permissionValidation.error}`);
        return;
      }
      recordPluginLog(
        'info',
        'script-action-batch-validated',
        `script action batch validated actionCount=${validation.actions.length}`,
        pluginId,
      );

      const mutatesMindmap = validation.actions.some(
        (action) => action.type !== 'showMessage',
      );
      const applied = applyScriptPluginActions(mindmap, validation.actions);
      if (mutatesMindmap) {
        recordHistory();
        setMindmap(applied.rootNode);
        setIsDocumentDirty(true);
        recordPluginLog(
          'info',
          'script-undo-batch-created',
          `script undo batch created mutationCount=${applied.mutationCount}`,
          pluginId,
        );
      }
      showScriptMessages(applied.messages);
      setScriptRunResult(pluginId, {
        status: 'success',
        message: `已执行 ${applied.appliedCount} 个 actions。`,
        lastRunAt: new Date().toISOString(),
        actionCount: validation.actions.length,
        appliedActionCount: applied.appliedCount,
        durationMs: runResult.durationMs,
      });
      recordPluginLog(
        'info',
        'script-action-applied',
        `script action applied actionCount=${validation.actions.length} durationMs=${runResult.durationMs}`,
        pluginId,
      );
      recordPluginLog(
        'info',
        'script-execution-succeeded',
        `script execution succeeded actionCount=${validation.actions.length} durationMs=${runResult.durationMs}`,
        pluginId,
      );
      if (applied.messages.length === 0) {
        showMessage('脚本插件执行完成。');
      }
    } catch (error) {
      const reason = getErrorMessage(error, '脚本执行失败。');
      setScriptRunResult(pluginId, {
        status: 'failed',
        message: reason,
        lastRunAt: new Date().toISOString(),
        error: reason,
      });
      recordPluginLog(
        'error',
        'script-execution-failed',
        reason,
        pluginId,
      );
      showMessage(`脚本执行失败：${reason}`);
    }
  };

  const handleCreateSampleWorkflowPlugin = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端创建本地 JSON Action 工作流目录。');
      return;
    }
    try {
      const result = await createSampleWorkflowPlugin();
      if (!result) {
        showMessage('不支持在 Web 端创建本地 JSON Action 工作流目录。');
        return;
      }
      showMessage(
        result.created
          ? `JSON Action 工作流示例已创建：${result.directoryPath}`
          : 'JSON Action 工作流示例已存在，未覆盖用户文件。',
      );
    } catch (error) {
      showMessage(
        `创建 JSON Action 工作流示例失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const handleCreateSamplePythonPlugin = async () => {
    if (!isDesktopApp) {
      showMessage('不支持在 Web 端创建 Python 插件目录。');
      return;
    }
    try {
      const result = await createSamplePythonPlugin();
      if (!result) {
        showMessage('不支持在 Web 端创建 Python 插件目录。');
        return;
      }
      showMessage(
        result.created
          ? `Python 插件示例已创建：${result.directoryPath}`
          : 'Python 插件示例已存在，未覆盖用户文件。',
      );
    } catch (error) {
      showMessage(
        `创建 Python 插件示例失败：${getErrorMessage(error, '未知错误')}`,
      );
    }
  };

  const setWorkflowRunResult = (
    pluginId: string,
    result: PluginRunRecord,
  ) => {
    setWorkflowRunResults((current) => ({
      ...current,
      [pluginId]: result,
    }));
  };

  const handleRunWorkflowPlugin = async (
    pluginId?: string,
    contextNodeId?: string,
    menuId?: string,
  ) => {
    if (!pluginId) {
      showMessage('工作流插件缺少 pluginId。');
      return;
    }
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin?.enabled) {
      showMessage(`插件已禁用：${pluginId}`);
      return;
    }
    if (plugin.manifestValid === false) {
      showMessage(`插件 manifest 无效：${pluginId}`);
      return;
    }
    if (plugin.pluginType !== 'action-workflow' || !plugin.workflow) {
      showMessage(`插件不是有效的 action-workflow：${pluginId}`);
      return;
    }

    const startedAt = performance.now();
    const duration = () => Math.round(performance.now() - startedAt);
    recordPluginLog(
      'info',
      'workflow-execution-started',
      'workflow execution started',
      pluginId,
      { menuId, actionCount: plugin.workflow.actions.length },
    );

    try {
      const effectiveSelectedNodeId = contextNodeId ?? selectedNodeId;
      const context = createScriptPluginContext(
        mindmap,
        effectiveSelectedNodeId,
        contextNodeId ? [contextNodeId] : selectedNodeIds,
      );
      const resolution = resolveWorkflowActions(
        plugin.workflow.actions,
        context,
      );
      if (!resolution.ok) {
        const durationMs = duration();
        setWorkflowRunResult(pluginId, {
          status: 'failed',
          message: resolution.error,
          lastRunAt: new Date().toISOString(),
          durationMs,
          actionCount: plugin.workflow.actions.length,
          appliedActionCount: 0,
          error: resolution.error,
        });
        recordPluginLog(
          'error',
          'workflow-execution-failed',
          resolution.error,
          pluginId,
          { menuId, actionCount: plugin.workflow.actions.length, durationMs },
        );
        showMessage(`工作流变量解析失败：${resolution.error}`);
        return;
      }
      recordPluginLog(
        'info',
        'workflow-variables-resolved',
        'workflow variables resolved',
        pluginId,
        { menuId, actionCount: resolution.actions.length, durationMs: duration() },
      );

      const validation = validateScriptPluginActions(
        resolution.actions,
        mindmap,
      );
      if (!validation.valid) {
        const durationMs = duration();
        setWorkflowRunResult(pluginId, {
          status: 'validation_failed',
          message: validation.error,
          lastRunAt: new Date().toISOString(),
          durationMs,
          actionCount: resolution.actions.length,
          appliedActionCount: 0,
          error: validation.error,
        });
        recordPluginLog(
          'error',
          'workflow-action-validation-failed',
          validation.error,
          pluginId,
          { menuId, actionCount: resolution.actions.length, durationMs },
        );
        showMessage(`工作流 action 校验失败：${validation.error}`);
        return;
      }

      const permissionValidation = validateScriptActionPermissions(
        validation.actions,
        plugin.permissions,
        '工作流',
      );
      if (!permissionValidation.valid) {
        const durationMs = duration();
        setWorkflowRunResult(pluginId, {
          status: 'validation_failed',
          message: permissionValidation.error,
          lastRunAt: new Date().toISOString(),
          durationMs,
          actionCount: validation.actions.length,
          appliedActionCount: 0,
          error: permissionValidation.error,
        });
        recordPluginLog(
          'error',
          'workflow-action-validation-failed',
          permissionValidation.error,
          pluginId,
          { menuId, actionCount: validation.actions.length, durationMs },
        );
        showMessage(`工作流权限校验失败：${permissionValidation.error}`);
        return;
      }
      recordPluginLog(
        'info',
        'workflow-action-batch-validated',
        'workflow action batch validated',
        pluginId,
        { menuId, actionCount: validation.actions.length, durationMs: duration() },
      );

      if (shouldConfirmWorkflowPluginRun(plugin)) {
        const writePermissions = getPluginWritePermissions(plugin);
        recordPluginLog(
          'warning',
          'workflow-trust-requested',
          `workflow trust requested permissions=${writePermissions.join(', ')}`,
          pluginId,
          { menuId, actionCount: validation.actions.length },
        );
        const trustDecision = requestWorkflowTrustDecision(
          plugin.name,
          writePermissions,
          (message) => window.confirm(message),
        );
        if (trustDecision === 'cancel') {
          showMessage('已取消工作流执行。');
          return;
        }
        if (trustDecision === 'trust') {
          await handleSetPluginTrusted(pluginId, true);
        }
      }

      const mutatesMindmap = workflowHasWriteActions(resolution.actions);
      const applied = applyScriptPluginActions(mindmap, validation.actions);
      if (mutatesMindmap) {
        recordHistory();
        setMindmap(applied.rootNode);
        setIsDocumentDirty(true);
        recordPluginLog(
          'info',
          'workflow-undo-batch-created',
          `workflow undo batch created mutationCount=${applied.mutationCount}`,
          pluginId,
          { menuId, actionCount: validation.actions.length, durationMs: duration() },
        );
      }
      showScriptMessages(applied.messages);
      const durationMs = duration();
      setWorkflowRunResult(pluginId, {
        status: 'success',
        message: `已执行 ${applied.appliedCount} 个 actions。`,
        lastRunAt: new Date().toISOString(),
        durationMs,
        actionCount: validation.actions.length,
        appliedActionCount: applied.appliedCount,
      });
      recordPluginLog(
        'info',
        'workflow-action-applied',
        'workflow action applied',
        pluginId,
        { menuId, actionCount: validation.actions.length, durationMs },
      );
      recordPluginLog(
        'info',
        'workflow-execution-succeeded',
        'workflow execution succeeded',
        pluginId,
        { menuId, actionCount: validation.actions.length, durationMs },
      );
      if (applied.messages.length === 0) {
        showMessage('JSON Action 工作流执行完成。');
      }
    } catch (error) {
      const reason = getErrorMessage(error, '工作流执行失败。');
      const durationMs = duration();
      setWorkflowRunResult(pluginId, {
        status: 'failed',
        message: reason,
        lastRunAt: new Date().toISOString(),
        durationMs,
        actionCount: plugin.workflow.actions.length,
        appliedActionCount: 0,
        error: reason,
      });
      recordPluginLog(
        'error',
        'workflow-execution-failed',
        reason,
        pluginId,
        { menuId, actionCount: plugin.workflow.actions.length, durationMs },
      );
      showMessage(`工作流执行失败：${reason}`);
    }
  };

  const setExternalRunResult = (
    pluginId: string,
    result: PluginRunRecord,
  ) => {
    setExternalRunResults((current) => ({
      ...current,
      [pluginId]: result,
    }));
  };

  const handleRunExternalPlugin = async (
    pluginId?: string,
    contextNodeId?: string,
    menuId?: string,
  ) => {
    if (!pluginId) {
      showMessage('外部命令插件缺少 pluginId。');
      return;
    }
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin?.enabled) {
      showMessage(`插件已禁用：${pluginId}`);
      return;
    }
    if (plugin.manifestValid === false) {
      showMessage(`插件 manifest 无效：${pluginId}`);
      return;
    }
    if (
      plugin.pluginType !== 'external-command' ||
      !plugin.runtime ||
      !plugin.entry
    ) {
      showMessage(`插件不是有效的 external-command：${pluginId}`);
      return;
    }
    if (!isExternalRunnerEnabled) {
      const reason = '外部命令插件运行器未启用。';
      setExternalRunResult(pluginId, {
        status: 'runner_disabled',
        message: reason,
        lastRunAt: new Date().toISOString(),
        error: reason,
      });
      recordPluginLog('warning', 'external-runner-disabled', reason, pluginId, {
        menuId,
      });
      showMessage(reason);
      return;
    }

    const writePermissions = getPluginWritePermissions(plugin);
    let trustConfirmedForRun = false;
    if (shouldConfirmExternalPluginRun(plugin)) {
      recordPluginLog(
        'warning',
        'external-trust-requested',
        `external trust requested permissions=${writePermissions.join(', ')}`,
        pluginId,
        { menuId },
      );
      const allowed = window.confirm(
        `高风险实验功能：该外部命令插件会启动本地进程并请求修改当前导图。\n插件：${plugin.name}\n权限：${writePermissions.join(', ')}\n\n确定：继续选择“仅本次”或“信任”\n取消：取消执行`,
      );
      if (!allowed) {
        showMessage('已取消外部命令插件执行。');
        return;
      }
      trustConfirmedForRun = true;
      const trust = window.confirm(
        `是否信任插件“${plugin.name}”？\n\n确定：信任此插件，后续不再提示\n取消：仅允许本次执行`,
      );
      if (trust) {
        await handleSetPluginTrusted(pluginId, true);
      }
    }

    const effectiveSelectedNodeId = contextNodeId ?? selectedNodeId;
    const context = createScriptPluginContext(
      mindmap,
      effectiveSelectedNodeId,
      contextNodeId ? [contextNodeId] : selectedNodeIds,
    );
    recordPluginLog(
      'info',
      'external-execution-started',
      `external execution started runtime=${plugin.runtime} entry=${plugin.entry}`,
      pluginId,
      { menuId },
    );
    recordPluginLog(
      'info',
      'external-stdin-sent',
      `external stdin sent nodeCount=${context.nodes.length} truncated=${Boolean(context.truncated)}`,
      pluginId,
      { menuId },
    );

    try {
      const processResult = await runExternalCommandPlugin({
        pluginId,
        context,
        pythonPath,
      });
      const stderrPreview = processResult.stderr.slice(0, 2000);
      recordPluginLog(
        'info',
        'external-stdout-received',
        `external stdout received size=${processResult.stdoutSize}`,
        pluginId,
        { menuId, durationMs: processResult.durationMs },
      );
      if (processResult.stderrSize > 0) {
        recordPluginLog(
          'warning',
          'external-stderr-received',
          `external stderr received size=${processResult.stderrSize}: ${stderrPreview}`,
          pluginId,
          { menuId, durationMs: processResult.durationMs },
        );
      }
      recordPluginLog(
        processResult.status === 'success' ? 'info' : 'error',
        processResult.status === 'timeout'
          ? 'external-process-timeout'
          : 'external-process-exited',
        `external process ${processResult.status} exitCode=${String(processResult.exitCode)}`,
        pluginId,
        { menuId, durationMs: processResult.durationMs },
      );
      if (processResult.status !== 'success') {
        const reason = processResult.error ?? '外部进程执行失败。';
        setExternalRunResult(pluginId, {
          status:
            processResult.status === 'timeout' ? 'timeout' : 'failed',
          message: reason,
          lastRunAt: new Date().toISOString(),
          durationMs: processResult.durationMs,
          exitCode: processResult.exitCode,
          stdoutSize: processResult.stdoutSize,
          stderrPreview,
          appliedActionCount: 0,
          error: reason,
        });
        recordPluginLog(
          'error',
          'external-execution-failed',
          reason,
          pluginId,
          { menuId, durationMs: processResult.durationMs },
        );
        showMessage(`外部命令执行失败：${reason}`);
        return;
      }

      let outputActions: unknown[];
      try {
        outputActions = parseExternalActionsOutput(processResult.stdout);
      } catch (error) {
        const reason = getErrorMessage(error, 'stdout 不是合法 JSON。');
        setExternalRunResult(pluginId, {
          status: 'failed',
          message: reason,
          lastRunAt: new Date().toISOString(),
          durationMs: processResult.durationMs,
          exitCode: processResult.exitCode,
          stdoutSize: processResult.stdoutSize,
          stderrPreview,
          appliedActionCount: 0,
          error: reason,
        });
        recordPluginLog(
          'error',
          'external-execution-failed',
          reason,
          pluginId,
          { menuId, durationMs: processResult.durationMs },
        );
        showMessage(`外部命令输出无效：${reason}`);
        return;
      }

      const validation = validateScriptPluginActions(outputActions, mindmap);
      if (!validation.valid) {
        setExternalRunResult(pluginId, {
          status: 'validation_failed',
          message: validation.error,
          lastRunAt: new Date().toISOString(),
          durationMs: processResult.durationMs,
          exitCode: processResult.exitCode,
          stdoutSize: processResult.stdoutSize,
          stderrPreview,
          actionCount: outputActions.length,
          appliedActionCount: 0,
          error: validation.error,
        });
        recordPluginLog(
          'error',
          'external-action-validation-failed',
          validation.error,
          pluginId,
          {
            menuId,
            durationMs: processResult.durationMs,
            actionCount: outputActions.length,
          },
        );
        showMessage(`外部命令 action 校验失败：${validation.error}`);
        return;
      }
      const mutatesMindmap = validation.actions.some(
        (action) => action.type !== 'showMessage',
      );
      if (mutatesMindmap && !plugin.trusted && !trustConfirmedForRun) {
        recordPluginLog(
          'warning',
          'external-trust-requested',
          'external trust requested after write actions were returned',
          pluginId,
          { menuId, actionCount: validation.actions.length },
        );
        const allowed = window.confirm(
          `该外部命令插件返回了导图修改 actions，但 manifest 未声明写权限。\n插件：${plugin.name}\n\n确定：继续进行权限校验\n取消：不执行 actions`,
        );
        if (!allowed) {
          showMessage('已取消外部命令 actions 执行。');
          return;
        }
      }
      const permissionValidation = validateScriptActionPermissions(
        validation.actions,
        plugin.permissions,
        '外部命令插件',
      );
      if (!permissionValidation.valid) {
        setExternalRunResult(pluginId, {
          status: 'validation_failed',
          message: permissionValidation.error,
          lastRunAt: new Date().toISOString(),
          durationMs: processResult.durationMs,
          exitCode: processResult.exitCode,
          stdoutSize: processResult.stdoutSize,
          stderrPreview,
          actionCount: validation.actions.length,
          appliedActionCount: 0,
          error: permissionValidation.error,
        });
        recordPluginLog(
          'error',
          'external-action-validation-failed',
          permissionValidation.error,
          pluginId,
          { menuId, actionCount: validation.actions.length },
        );
        showMessage(`外部命令权限校验失败：${permissionValidation.error}`);
        return;
      }

      const applied = applyScriptPluginActions(mindmap, validation.actions);
      if (mutatesMindmap) {
        recordHistory();
        setMindmap(applied.rootNode);
        setIsDocumentDirty(true);
        recordPluginLog(
          'info',
          'external-undo-batch-created',
          `external undo batch created mutationCount=${applied.mutationCount}`,
          pluginId,
          { menuId, actionCount: validation.actions.length },
        );
      }
      showScriptMessages(applied.messages);
      setExternalRunResult(pluginId, {
        status: 'success',
        message: `已执行 ${applied.appliedCount} 个 actions。`,
        lastRunAt: new Date().toISOString(),
        durationMs: processResult.durationMs,
        exitCode: processResult.exitCode,
        stdoutSize: processResult.stdoutSize,
        stderrPreview,
        actionCount: validation.actions.length,
        appliedActionCount: applied.appliedCount,
      });
      recordPluginLog(
        'info',
        'external-action-applied',
        `external action applied count=${applied.appliedCount}`,
        pluginId,
        {
          menuId,
          actionCount: validation.actions.length,
          durationMs: processResult.durationMs,
        },
      );
      recordPluginLog(
        'info',
        'external-execution-succeeded',
        'external execution succeeded',
        pluginId,
        {
          menuId,
          actionCount: validation.actions.length,
          durationMs: processResult.durationMs,
        },
      );
      if (applied.messages.length === 0) {
        showMessage('外部命令插件执行完成。');
      }
    } catch (error) {
      const reason = getErrorMessage(error, '外部命令执行失败。');
      setExternalRunResult(pluginId, {
        status: 'failed',
        message: reason,
        lastRunAt: new Date().toISOString(),
        error: reason,
      });
      recordPluginLog(
        'error',
        'external-execution-failed',
        reason,
        pluginId,
        { menuId },
      );
      showMessage(`外部命令执行失败：${reason}`);
    }
  };

  const pluginCommandHandlers: PluginCommandHandlers = {
    'builtin.openPluginManager': () => setIsPluginManagerVisible(true),
    'builtin.reloadPlugins': handleReloadPlugins,
    'builtin.openPluginDirectory': handleOpenPluginDir,
    'builtin.exportText': handleExportTxt,
  };

  const runPluginCommand = async (
    commandId: string,
    pluginId?: string,
    contextNodeId?: string,
    menuId?: string,
  ) => {
    try {
      if (commandId === 'plugin.runScript') {
        await handleRunScriptPlugin(pluginId, contextNodeId);
        return;
      }
      if (commandId === 'plugin.runWorkflow') {
        await handleRunWorkflowPlugin(pluginId, contextNodeId, menuId);
        return;
      }
      if (commandId === 'plugin.runExternal') {
        await handleRunExternalPlugin(pluginId, contextNodeId, menuId);
        return;
      }
      await executePluginCommand({
        commandId,
        pluginId,
        plugins,
        handlers: pluginCommandHandlers,
      });
    } catch (error) {
      const reason = getErrorMessage(error, '未知错误');
      if (
        reason.includes('插件命令不存在') ||
        reason.includes('manifest 无效')
      ) {
        recordPluginLog(
          'warning',
          'command-invalid',
          reason,
          pluginId,
        );
      }
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
    location: 'plugins',
  });
  const nodeContextPluginMenuGroups = getPluginMenuGroups(plugins, {
    hasMindmap: Boolean(mindmap),
    hasSelectedNode: contextMenu?.type === 'node',
    location: 'node-context',
  });
  const missingRecentFiles = recentFiles.filter(
    (entry) => recentFileHealth[entry.path] === 'missing',
  );

  const topMenus: TopMenuGroup[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        {
          label:
            missingRecentFiles.length > 0
              ? `最近文件健康检查（${missingRecentFiles.length} 个异常）`
              : '最近文件健康检查',
          disabled: missingRecentFiles.length === 0,
          children: missingRecentFiles.flatMap((entry) => [
            {
              label: `${entry.name}：重新定位文件`,
              onSelect: () => void handleRelocateRecentFile(entry),
            },
            {
              label: `${entry.name}：从最近文件移除`,
              onSelect: () => void handleRemoveRecentFile(entry),
            },
          ]),
        },
        {
          label: '创建版本快照',
          onSelect: () => void handleCreateVersionSnapshot(),
        },
        {
          label: '版本历史',
          onSelect: () => void handleOpenVersionHistory(),
        },
        {
          label: '恢复自动保存草稿',
          onSelect: () => setIsRecoveryCenterVisible(true),
          disabled: recoveryDrafts.length === 0,
          dividerBefore: true,
        },
        { label: '新建思维导图', onSelect: handleCreateMindmap },
        {
          label: '打开 .lmind',
          onSelect: () => void handleOpenMindmap(),
        },
        { label: '保存', onSelect: handleSaveMindmap },
        { label: '另存为 .lmind', onSelect: handleSaveMindmapAs },
        {
          label: '导入',
          dividerBefore: true,
          children: [
            { label: '导入 Markdown', onSelect: () => void handleImportMarkdown() },
            { label: '导入 Excel', onSelect: () => void handleImportExcel() },
            { label: '导入 JSON', onSelect: () => void handleImportJson() },
            {
              label: '导入节点类型包',
              onSelect: () => void handleImportNodeTypePack(),
            },
            { label: '导入模板包', onSelect: () => void handleImportTemplatePack() },
          ],
        },
        {
          label: '导出',
          children: [
            { label: '导出 Markdown', onSelect: handleExportMarkdown },
            { label: '导出 Excel', onSelect: handleExportExcel },
            { label: '导出 JSON', onSelect: handleExportJson },
            { label: '导出 PNG', onSelect: () => void handleExportImage('png') },
            { label: '导出 JPG', onSelect: () => void handleExportImage('jpg') },
            {
              label: canExportTxt ? '导出 TXT' : '导出 TXT（需启用插件）',
              onSelect: handleExportTxt,
              disabled: !canExportTxt,
            },
            { label: '导出节点类型包', onSelect: handleExportNodeTypePack },
            { label: '导出模板包', onSelect: handleExportTemplatePack },
          ],
        },
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
          label: '查找',
          onSelect: () => setActiveDrawer('search'),
          dividerBefore: true,
        },
        {
          label: '替换',
          onSelect: () => setActiveDrawer('search'),
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
        {
          label: '性能测试',
          onSelect: () => setActiveDrawer('performance'),
        },
      ],
    },
    {
      id: 'plugins',
      label: '插件',
      items: [
        {
          label: '插件管理',
          onSelect: () => setIsPluginManagerVisible(true),
        },
        {
          label: '本地插件中心',
          onSelect: () => setIsPluginManagerVisible(true),
        },
        {
          label: '插件开发者工作台',
          onSelect: () => setIsPluginManagerVisible(true),
        },
        {
          label: '插件诊断中心',
          onSelect: () => setIsPluginManagerVisible(true),
        },
        {
          label: '重新加载插件',
          onSelect: () => void runPluginCommand('builtin.reloadPlugins'),
          dividerBefore: true,
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
              void runPluginCommand(
                menu.command,
                group.pluginId,
                undefined,
                menu.id,
              ),
          })),
        })),
      ],
    },
    {
      id: 'help',
      label: '帮助',
      items: [
        {
          label: '快捷键',
          onSelect: () => setIsShortcutHelpVisible(true),
        },
        {
          label: '使用指南',
          onSelect: () =>
            showMessage('使用指南：从模板开始，双击编辑节点，Tab 添加子节点，Enter 添加同级节点。'),
        },
        {
          label: '插件开发文档',
          onSelect: () => void handleOpenPluginDevelopmentDocs(),
        },
        {
          label: '关于 Local Mindmap',
          onSelect: () =>
            showMessage('Local Mindmap：纯本地、离线运行的思维导图工具。'),
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
          messageKind={messageKind}
          isDirty={isDocumentDirty}
          saveStatus={effectiveFileSaveStatus}
          saveStatusLabel={fileStatusLabel[effectiveFileSaveStatus]}
          onOpenFileStatus={() => setIsFileStatusVisible(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onQuickSave={handleSaveMindmap}
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
            title={activeDrawer ? drawerTitle[activeDrawer] : '工作区'}
            onViewChange={(view) => {
              if (view === 'plugins') {
                setIsPluginManagerVisible(true);
                setActiveDrawer(null);
                return;
              }
              setActiveDrawer(view);
            }}
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
                    placeholder="搜索模板"
                    onChange={(event) => setTemplateKeyword(event.target.value)}
                  />
                </label>
                <div className="panel-heading">
                  <h2>保存当前导图为模板</h2>
                  <button
                    type="button"
                    className="primary-action"
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
                  {totalTemplateCount > 10 ? (
                  <div className="compact-form template-filter-row">
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
                  ) : (
                    <p className="panel-note muted-note">模板较少，已简化筛选排序。</p>
                  )}

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
                              {template.description ? (
                                <p className="template-description">
                                  {template.description}
                                </p>
                              ) : (
                                <p className="template-description">
                                  用于快速创建常用思维导图结构。
                                </p>
                              )}
                              <span>
                                共 {countMindmapNodes(template.rootNode)} 个节点 · {template.category}
                              </span>
                              {template.description ? (
                                null
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => handleCreateFromTemplate(template)}
                            >
                              使用模板
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
                              {template.description ? (
                                <p className="template-description">
                                  {template.description}
                                </p>
                              ) : (
                                <p className="template-description">
                                  自定义模板。
                                </p>
                              )}
                              <span>
                                共 {countMindmapNodes(template.rootNode)} 个节点 · {template.category}
                              </span>
                              <span>
                                {new Date(template.createTime).toLocaleString()}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => handleCreateFromTemplate(template)}
                            >
                              使用模板
                            </button>
                            <button
                              type="button"
                              className="danger-action"
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
                <div className="aligned-form node-type-form">
              <label>
                <span>类型名称</span>
                <input
                  type="text"
                  value={nodeTypeDraft.name}
                  placeholder="例如：任务节点"
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>图标</span>
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
              <label>
                <span>形状</span>
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
              <label>
                <span>背景色</span>
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
              <label>
                <span>边框色</span>
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
              <label>
                <span>文本色</span>
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
              <label>
                <span>字号</span>
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
              <label>
                <span>加粗</span>
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
              <label>
                <span>默认文本</span>
                <input
                  type="text"
                  value={nodeTypeDraft.defaultText}
                  placeholder="新节点"
                  onChange={(event) =>
                    setNodeTypeDraft((draft) => ({
                      ...draft,
                      defaultText: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>默认备注</span>
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
              </label>
              <div className="panel-action-row">
              <button
                type="button"
                className="primary-action"
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
                </div>
                <div className="node-type-list">
              {nodeTypes.length === 0 ? (
                <p className="empty-note">暂无自定义节点类型，可创建一个常用样式。</p>
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
                    {getSearchPanelStatusText({
                      query: searchQuery,
                      hasRun: searchHasRun,
                      matchCount: searchMatches.length,
                      activeIndex: activeMatchIndex,
                    })}
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
                    {Object.entries(SEARCH_SCOPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={handleRunSearch}
                  >
                    查找
                  </button>
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
              <section className="feature-panel settings-panel" aria-label="系统设置">
                <div className="panel-heading">
                  <h2>系统设置</h2>
                </div>
                <section className="settings-group">
                  <h3>界面设置</h3>
                  <label className="stacked-control">
                    <span>当前画布主题</span>
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
                  <label className="toggle-control">
                    <input
                      type="checkbox"
                      checked={showCanvasGrid}
                      onChange={(event) => setShowCanvasGrid(event.target.checked)}
                    />
                    <span>显示网格</span>
                  </label>
                </section>
                <section className="settings-group">
                  <h3>编辑设置</h3>
                  <label className="toggle-control">
                    <input
                      type="checkbox"
                      checked={openCentered}
                      onChange={(event) => setOpenCentered(event.target.checked)}
                    />
                    <span>打开文件后居中画布</span>
                  </label>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setIsShortcutHelpVisible(true)}
                  >
                    查看快捷键
                  </button>
                </section>
                <section className="settings-group">
                  <h3>文件设置</h3>
                  <label className="toggle-control">
                    <input
                      type="checkbox"
                      checked={isAutoSaveEnabled}
                      onChange={(event) => setIsAutoSaveEnabled(event.target.checked)}
                    />
                    <span>自动保存</span>
                  </label>
                  <label className="stacked-control">
                    <span>自动保存间隔</span>
                    <select
                      value={fileReliabilitySettings.autoSaveIntervalMs}
                      disabled={!isAutoSaveEnabled}
                      onChange={(event) =>
                        setAutoSaveInterval(Number(event.target.value))
                      }
                    >
                      {AUTO_SAVE_INTERVAL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="toggle-control">
                    <input
                      type="checkbox"
                      checked={fileReliabilitySettings.backupBeforeSaveEnabled}
                      onChange={(event) =>
                        void updateFileReliabilitySettings({
                          backupBeforeSaveEnabled: event.target.checked,
                        })
                      }
                    />
                    <span>保存前自动备份</span>
                  </label>
                  <label className="stacked-control">
                    <span>每个文件最大备份数</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={fileReliabilitySettings.maxBackupsPerFile}
                      onChange={(event) =>
                        void updateFileReliabilitySettings({
                          maxBackupsPerFile: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="settings-actions">
                    <button type="button" className="secondary-action" onClick={() => void handleOpenVersionHistory()}>
                      打开版本历史
                    </button>
                    <button type="button" className="secondary-action" onClick={() => setIsRecoveryCenterVisible(true)}>
                      打开恢复中心
                    </button>
                    <button type="button" className="secondary-action" onClick={() => void openUserDataSubdir(USER_DATA_PATHS.fileBackups)}>
                      打开备份目录
                    </button>
                    <button type="button" className="ghost-action" onClick={() => void handleCleanAutosaveDrafts()}>
                      清理自动保存草稿
                    </button>
                  </div>
                </section>
                <section className="settings-group">
                  <h3>插件设置</h3>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setIsPluginManagerVisible(true)}
                  >
                    插件运行器状态
                  </button>
                </section>
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
          {showCanvasGrid ? <div className="canvas-grid" aria-hidden="true" /> : null}
          {shouldShowCanvasGuide ? (
            <aside className="canvas-guide" aria-label="画布新手引导">
              <span>双击节点编辑内容</span>
              <span>Tab 新建子节点</span>
              <span>Enter 新建同级节点</span>
              <span>拖拽节点调整结构</span>
              <span>Ctrl+F 查找节点</span>
              <button
                type="button"
                className="ghost-action"
                onClick={dismissCanvasGuide}
              >
                不再提示
              </button>
            </aside>
          ) : null}
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
                aria-label="打开右侧属性面板"
                title="打开右侧属性面板"
              >
                ‹ {selectedNodeId ? '当前节点' : '属性'}
              </button>
            </aside>
          ) : (
            <RightInspectorPanel
              selectedNode={selectedNode}
              selectedCount={selectedNodeIds.length}
              nodeTypes={availableNodeTypes}
              editableNodeTypeIds={nodeTypes.map((nodeType) => nodeType.id)}
              childNodeTypeId={childNodeTypeId}
              themeId={themeId}
              themes={availableThemes}
              remarkMode={remarkMode}
              activeRemarkMatch={
                activeMatch?.field === 'remark' ? activeMatch : null
              }
              onChildNodeTypeChange={setChildNodeTypeId}
              onSelectedNodeTypeChange={handleSelectedNodeTypeChange}
              onNodeStyleChange={handleSelectedNodeStyleChange}
              onSaveStyleAsNodeType={handleSaveSelectedStyleAsNodeType}
              onApplyStyleToNodeType={handleApplySelectedStyleToNodeType}
              onResetNodeStyle={handleResetSelectedNodeStyle}
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

      {isFileStatusVisible ? (
        <div className="file-reliability-backdrop" role="presentation">
          <section className="file-reliability-dialog" role="dialog" aria-modal="true">
            <header className="file-reliability-header">
              <div>
                <p className="eyebrow">File</p>
                <h2>文件状态</h2>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIsFileStatusVisible(false)}>
                关闭
              </button>
            </header>
            <dl className="file-status-grid">
              <div><dt>当前文件名</dt><dd>{currentDocumentTitle}</dd></div>
              <div><dt>文件路径</dt><dd>{currentMaskedPath}</dd></div>
              <div><dt>保存状态</dt><dd>{fileStatusLabel[effectiveFileSaveStatus]}</dd></div>
              <div><dt>最近保存时间</dt><dd>{formatRelativeLocalTime(lastSavedAt)}</dd></div>
              <div><dt>最近自动保存时间</dt><dd>{formatRelativeLocalTime(lastAutoSavedAt)}</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary-action" onClick={() => void handleOpenVersionHistory()}>
                版本历史
              </button>
              <button type="button" className="primary-action" onClick={() => void handleCreateVersionSnapshot()}>
                创建快照
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isRecoveryCenterVisible ? (
        <div className="file-reliability-backdrop" role="presentation">
          <section className="file-reliability-dialog" role="dialog" aria-modal="true">
            <header className="file-reliability-header">
              <div>
                <p className="eyebrow">Recovery</p>
                <h2>恢复自动保存草稿</h2>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIsRecoveryCenterVisible(false)}>
                忽略
              </button>
            </header>
            <div className="version-list">
              {recoveryDrafts.length === 0 ? (
                <p className="empty-state">暂无未恢复草稿。</p>
              ) : recoveryDrafts.map((draft) => (
                <article className="version-item" key={draft.draftId}>
                  <div>
                    <strong>{draft.title}</strong>
                    <p>{formatRelativeLocalTime(draft.updatedAt)} · {draft.rootText} · {draft.nodeCount} 节点</p>
                  </div>
                  <div className="version-actions">
                    <button type="button" className="primary-action" onClick={() => void handleRestoreDraft(draft)}>
                      恢复
                    </button>
                    <button type="button" className="danger-action" onClick={() => void handleDeleteDraft(draft)}>
                      删除草稿
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isVersionHistoryVisible ? (
        <div className="file-reliability-backdrop" role="presentation">
          <section className="file-reliability-dialog is-wide" role="dialog" aria-modal="true">
            <header className="file-reliability-header">
              <div>
                <p className="eyebrow">{currentDocumentTitle}</p>
                <h2>版本历史</h2>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIsVersionHistoryVisible(false)}>
                关闭
              </button>
            </header>
            <div className="version-history-layout">
              <div className="version-list">
                {versionHistory.length === 0 ? (
                  <p className="empty-state">暂无历史版本。</p>
                ) : versionHistory.map((entry) => (
                  <article className="version-item" key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <p>{formatLocalDateTime(entry.createdAt)} · {versionSourceLabel(entry.source)} · {entry.rootText} · {entry.nodeCount} 节点 · {Math.ceil(entry.sizeBytes / 1024)} KB</p>
                      {entry.note ? <p>{entry.note}</p> : null}
                    </div>
                    <div className="version-actions">
                      <button type="button" className="secondary-action" onClick={() => void handlePreviewVersion(entry)}>预览</button>
                      <button type="button" className="primary-action" onClick={() => void handleRestoreVersion(entry)}>恢复为当前导图</button>
                      <button type="button" className="secondary-action" onClick={() => void handleSaveVersionAs(entry)}>另存为</button>
                      <button type="button" className="danger-action" onClick={() => void handleDeleteVersion(entry)}>删除</button>
                    </div>
                  </article>
                ))}
              </div>
              <aside className="version-preview">
                <h3>预览</h3>
                {versionPreview ? (
                  <>
                    <p>{formatLocalDateTime(versionPreview.entry.createdAt)} · {versionPreview.preview.nodeCount} 节点</p>
                    <pre>{versionPreview.preview.treeText}</pre>
                  </>
                ) : (
                  <p className="empty-state">选择一个历史版本预览。</p>
                )}
              </aside>
            </div>
          </section>
        </div>
      ) : null}

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
          onInstall={() => void handleInstallPlugin()}
          onInstallGallery={(item) => void handleInstallGalleryPlugin(item)}
          onOpenGalleryPluginDir={(catalogId) =>
            void handleOpenGalleryPluginDir(catalogId)
          }
          onOpenPluginDevelopmentDocs={() =>
            void handleOpenPluginDevelopmentDocs()
          }
          onToggle={(pluginId, enabled) =>
            void handleTogglePlugin(pluginId, enabled)
          }
          onUninstall={(pluginId) => void handleUninstallPlugin(pluginId)}
          onCopyUserDataDir={() => void handleCopyUserDataDir()}
          onOpenUserDataDir={() => void handleOpenUserDataDir()}
          onOpenPluginDir={() => void handleOpenPluginDir()}
          onOpenPluginDevDir={() => void handleOpenPluginDevDir()}
          onCreateDevProject={handleCreateDevPluginProject}
          onValidateDevProject={handleValidateDevPluginProject}
          onBuildDevPackage={handleBuildDevPluginPackage}
          onOpenDevProjectDir={(pluginId) =>
            void handleOpenDevPluginProjectDir(pluginId)
          }
          onOpenPluginExamplesDir={() =>
            void handleOpenPluginExamplesDir()
          }
          onImportDevPackage={() =>
            void handleInstallPlugin('dev-workbench')
          }
          recentDevProject={recentDevProject}
          recentDevValidation={recentDevValidation}
          recentDevPackage={recentDevPackage}
          onCreateSamplePlugin={() => void handleCreateSamplePlugin()}
          onCreateSampleScriptPlugin={() =>
            void handleCreateSampleScriptPlugin()
          }
          onCreateSampleBatchScriptPlugin={() =>
            void handleCreateSampleBatchScriptPlugin()
          }
          onCreateSampleWorkflowPlugin={() =>
            void handleCreateSampleWorkflowPlugin()
          }
          onCreateSamplePythonPlugin={() =>
            void handleCreateSamplePythonPlugin()
          }
          onOpenSampleScriptPluginDir={() =>
            void handleOpenSampleScriptPluginDir()
          }
          isScriptRunnerEnabled={isScriptRunnerEnabled}
          onScriptRunnerEnabledChange={(enabled) =>
            void handleScriptRunnerEnabledChange(enabled)
          }
          scriptRunResults={scriptRunResults}
          workflowRunResults={workflowRunResults}
          isExternalRunnerEnabled={isExternalRunnerEnabled}
          onExternalRunnerEnabledChange={(enabled) =>
            void handleExternalRunnerEnabledChange(enabled)
          }
          pythonPath={pythonPath}
          onSavePythonPath={(path) => void handleSavePythonPath(path)}
          onTestPython={(path) => void handleTestPython(path)}
          externalRunResults={externalRunResults}
          onSetPluginTrusted={(pluginId, trusted) =>
            void handleSetPluginTrusted(pluginId, trusted)
          }
          onCopyPluginId={(pluginId) => void handleCopyPluginId(pluginId)}
          onExportPackage={(pluginId) =>
            void handleExportPluginPackage(pluginId)
          }
          lastPluginExport={lastPluginExport}
          onCopyExportPath={(path) =>
            void handleCopyExportedPluginPath(path)
          }
          onOpenExportLocation={(path) =>
            void handleOpenExportedPluginLocation(path)
          }
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
          onDiagnosticFixResults={handleDiagnosticFixResults}
          logs={pluginLogs}
          onClearLogs={() => setPluginLogs(clearPluginLogs())}
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
                <span title="使用快捷键或按钮新建子节点时，默认应用的节点类型。">
                  新建子节点默认类型
                </span>
                <div>
                  <select
                    value={childNodeTypeId}
                    aria-label="新建子节点默认类型"
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
              {nodeContextPluginMenuGroups.map((group) => (
                <div
                  className="context-menu-plugin-section"
                  key={`node-context-${group.pluginId}`}
                >
                  <span>{group.pluginName}</span>
                  {group.items.map((menu) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={menu.id}
                      onClick={() =>
                        runContextMenuAction(() => {
                          recordPluginLog(
                            'info',
                            menu.command === 'plugin.runExternal'
                              ? 'external-context-menu-invoked'
                              : menu.command === 'plugin.runWorkflow'
                              ? 'workflow-context-menu-invoked'
                              : 'script-context-menu-invoked',
                            `${menu.command === 'plugin.runExternal' ? 'external' : menu.command === 'plugin.runWorkflow' ? 'workflow' : 'script'} context menu invoked menu=${menu.id} nodeId=${contextMenu.nodeId}`,
                            group.pluginId,
                            { menuId: menu.id },
                          );
                          void runPluginCommand(
                            menu.command,
                            group.pluginId,
                            contextMenu.nodeId,
                            menu.id,
                          );
                        })
                      }
                    >
                      {menu.label}
                    </button>
                  ))}
                </div>
              ))}
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
