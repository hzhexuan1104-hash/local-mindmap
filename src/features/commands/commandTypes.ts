import type { MindmapIndex } from '../mindmap/mindmapIndex';
import type { MindmapNode, MindmapNodeType } from '../mindmap/types';

export type CommandCategory =
  | 'file'
  | 'edit'
  | 'node'
  | 'view'
  | 'navigation'
  | 'template'
  | 'node-type'
  | 'plugin'
  | 'history'
  | 'developer'
  | 'help';

export type CommandRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CommandContext = {
  mindmap: MindmapNode;
  currentFilePath: string | null;
  isDocumentDirty: boolean;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  editingNodeId: string | null;
  focusedRootId: string | null;
  mindmapIndex: MindmapIndex;
  nodeTypes: MindmapNodeType[];
  isScriptRunnerEnabled: boolean;
  isExternalRunnerEnabled: boolean;
  actions: Record<string, (() => void | Promise<void>) | undefined>;
  showMessage: (message: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
};

export type CommandDefinition = {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  icon?: string;
  source: 'builtin' | 'plugin' | 'dynamic';
  pluginId?: string;
  pluginName?: string;
  riskLevel?: CommandRiskLevel;
  when?: (context: CommandContext) => boolean;
  disabledReason?: (context: CommandContext) => string | undefined;
  execute: (context: CommandContext) => void | Promise<void>;
};

export type PaletteResultType =
  | 'command'
  | 'plugin-command'
  | 'node'
  | 'recent-file'
  | 'template'
  | 'node-type';

export type PaletteResult = {
  id: string;
  type: PaletteResultType;
  title: string;
  description?: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  icon?: string;
  commandId?: string;
  pluginId?: string;
  pluginName?: string;
  riskLevel?: CommandRiskLevel;
  disabledReason?: string;
  searchText?: string;
  execute: () => void | Promise<void>;
};

export type CommandUsage = {
  commandId: string;
  lastUsedAt: string;
  useCount: number;
};
