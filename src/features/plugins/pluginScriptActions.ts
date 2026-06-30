import type { MindmapNode } from '../mindmap/types';

export const SCRIPT_ACTION_LIMIT = 20;
export const SCRIPT_TEXT_MAX_LENGTH = 500;
export const SCRIPT_REMARK_MAX_LENGTH = 5000;

export type ScriptShowMessageAction = {
  type: 'showMessage';
  level?: 'info' | 'warning' | 'error';
  message: string;
};

export type ScriptUpdateNodeAction = {
  type: 'updateNode';
  nodeId: string;
  patch: {
    text?: string;
    remark?: string;
  };
};

export type ScriptSetNodeRemarkAction = {
  type: 'setNodeRemark';
  nodeId: string;
  remark: string;
};

export type ScriptAddChildNodeAction = {
  type: 'addChildNode';
  parentId: string;
  node: {
    text: string;
    remark?: string;
  };
};

export type ScriptPluginAction =
  | ScriptShowMessageAction
  | ScriptUpdateNodeAction
  | ScriptSetNodeRemarkAction
  | ScriptAddChildNodeAction;

export type ScriptContextNode = {
  id: string;
  text: string;
  parentId: string | null;
  remark: string;
};

export type ScriptPluginContext = {
  mindmap: {
    title: string;
    nodeCount: number;
  };
  selectedNode: Omit<ScriptContextNode, 'parentId'> | null;
  nodes: ScriptContextNode[];
};

export type ScriptActionValidationResult =
  | { valid: true; actions: ScriptPluginAction[]; error: null }
  | { valid: false; actions: []; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function collectNodes(
  node: MindmapNode,
  parentId: string | null,
  nodes: ScriptContextNode[],
) {
  nodes.push({
    id: node.id,
    text: node.text,
    parentId,
    remark: node.remark ?? '',
  });
  for (const child of node.children) {
    collectNodes(child, node.id, nodes);
  }
}

export function createScriptPluginContext(
  rootNode: MindmapNode,
  selectedNodeId: string | null,
): ScriptPluginContext {
  const nodes: ScriptContextNode[] = [];
  collectNodes(rootNode, null, nodes);
  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const snapshot: ScriptPluginContext = {
    mindmap: {
      title: rootNode.text,
      nodeCount: nodes.length,
    },
    selectedNode: selectedNode
      ? {
          id: selectedNode.id,
          text: selectedNode.text,
          remark: selectedNode.remark,
        }
      : null,
    nodes,
  };

  return JSON.parse(JSON.stringify(snapshot)) as ScriptPluginContext;
}

function actionError(index: number, message: string) {
  return `第 ${index + 1} 个 action 出错：${message}`;
}

function validateText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') {
    return `${field} 必须是字符串。`;
  }
  if (value.length > maxLength) {
    return `${field} 长度不能超过 ${maxLength}。`;
  }
  return null;
}

function validateKnownNode(
  value: unknown,
  field: string,
  nodeIds: Set<string>,
) {
  if (!isNonEmptyString(value)) {
    return `${field} 必须是已存在节点 ID。`;
  }
  if (!nodeIds.has(value)) {
    return `${field} 不存在：${value}`;
  }
  return null;
}

function validateSingleAction(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
): ScriptActionValidationResult {
  if (!isRecord(value)) {
    return { valid: false, actions: [], error: actionError(index, 'action 必须是对象。') };
  }
  if (!isNonEmptyString(value.type)) {
    return { valid: false, actions: [], error: actionError(index, 'type 必须是字符串。') };
  }

  switch (value.type) {
    case 'showMessage': {
      const messageError = validateText(value.message, 'message', 1000);
      if (messageError) {
        return { valid: false, actions: [], error: actionError(index, messageError) };
      }
      if (
        value.level !== undefined &&
        value.level !== 'info' &&
        value.level !== 'warning' &&
        value.level !== 'error'
      ) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, 'level 仅支持 info / warning / error。'),
        };
      }
      return {
        valid: true,
        actions: [
          {
            type: 'showMessage',
            level: value.level as ScriptShowMessageAction['level'],
            message: value.message as string,
          },
        ],
        error: null,
      };
    }
    case 'updateNode': {
      const nodeError = validateKnownNode(value.nodeId, 'nodeId', nodeIds);
      if (nodeError) {
        return { valid: false, actions: [], error: actionError(index, nodeError) };
      }
      if (!isRecord(value.patch)) {
        return { valid: false, actions: [], error: actionError(index, 'patch 必须是对象。') };
      }
      const patchKeys = Object.keys(value.patch);
      const illegalKey = patchKeys.find((key) => key !== 'text' && key !== 'remark');
      if (illegalKey) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, `patch 不允许修改 ${illegalKey}。`),
        };
      }
      if (!patchKeys.includes('text') && !patchKeys.includes('remark')) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, 'patch 至少包含 text 或 remark。'),
        };
      }
      const textError =
        value.patch.text === undefined
          ? null
          : validateText(value.patch.text, 'patch.text', SCRIPT_TEXT_MAX_LENGTH);
      const remarkError =
        value.patch.remark === undefined
          ? null
          : validateText(
              value.patch.remark,
              'patch.remark',
              SCRIPT_REMARK_MAX_LENGTH,
            );
      if (textError || remarkError) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, textError ?? remarkError ?? 'patch 无效。'),
        };
      }
      return {
        valid: true,
        actions: [
          {
            type: 'updateNode',
            nodeId: value.nodeId as string,
            patch: value.patch as ScriptUpdateNodeAction['patch'],
          },
        ],
        error: null,
      };
    }
    case 'setNodeRemark': {
      const nodeError = validateKnownNode(value.nodeId, 'nodeId', nodeIds);
      const remarkError = validateText(
        value.remark,
        'remark',
        SCRIPT_REMARK_MAX_LENGTH,
      );
      if (nodeError || remarkError) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, nodeError ?? remarkError ?? 'remark 无效。'),
        };
      }
      return {
        valid: true,
        actions: [
          {
            type: 'setNodeRemark',
            nodeId: value.nodeId as string,
            remark: value.remark as string,
          },
        ],
        error: null,
      };
    }
    case 'addChildNode': {
      const parentError = validateKnownNode(value.parentId, 'parentId', nodeIds);
      if (parentError) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, parentError),
        };
      }
      if (!isRecord(value.node)) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, 'node 必须是对象。'),
        };
      }
      const textError = validateText(
        value.node.text,
        'node.text',
        SCRIPT_TEXT_MAX_LENGTH,
      );
      const remarkError =
        value.node.remark === undefined
          ? null
          : validateText(value.node.remark, 'node.remark', SCRIPT_REMARK_MAX_LENGTH);
      if (textError || remarkError) {
        return {
          valid: false,
          actions: [],
          error: actionError(index, textError ?? remarkError ?? 'node 无效。'),
        };
      }
      return {
        valid: true,
        actions: [
          {
            type: 'addChildNode',
            parentId: value.parentId as string,
            node: {
              text: value.node.text as string,
              remark: value.node.remark as string | undefined,
            },
          },
        ],
        error: null,
      };
    }
    case 'addNode':
      return {
        valid: false,
        actions: [],
        error: actionError(index, 'addNode 本批暂不支持执行。'),
      };
    case 'deleteNode':
      return {
        valid: false,
        actions: [],
        error: actionError(index, 'deleteNode 本批暂不支持执行。'),
      };
    default:
      return {
        valid: false,
        actions: [],
        error: actionError(index, `不支持的 action type：${String(value.type)}`),
      };
  }
}

export function validateScriptPluginActions(
  value: unknown,
  rootNode: MindmapNode,
): ScriptActionValidationResult {
  if (!Array.isArray(value)) {
    return { valid: false, actions: [], error: '脚本必须返回 actions 数组。' };
  }
  if (value.length > SCRIPT_ACTION_LIMIT) {
    return {
      valid: false,
      actions: [],
      error: `单次最多执行 ${SCRIPT_ACTION_LIMIT} 个 actions。`,
    };
  }

  const nodes: ScriptContextNode[] = [];
  collectNodes(rootNode, null, nodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const actions: ScriptPluginAction[] = [];

  for (const [index, action] of value.entries()) {
    const result = validateSingleAction(action, index, nodeIds);
    if (!result.valid) {
      return result;
    }
    actions.push(...result.actions);
  }

  return { valid: true, actions, error: null };
}

function updateNode(
  node: MindmapNode,
  nodeId: string,
  updater: (node: MindmapNode) => MindmapNode,
): MindmapNode {
  if (node.id === nodeId) {
    return updater(node);
  }
  return {
    ...node,
    children: node.children.map((child) => updateNode(child, nodeId, updater)),
  };
}

function nextScriptNodeId(rootNode: MindmapNode, index: number) {
  const nodes: ScriptContextNode[] = [];
  collectNodes(rootNode, null, nodes);
  const ids = new Set(nodes.map((node) => node.id));
  let suffix = 1;
  let candidate = `script-node-${Date.now()}-${index}-${suffix}`;
  while (ids.has(candidate)) {
    suffix += 1;
    candidate = `script-node-${Date.now()}-${index}-${suffix}`;
  }
  return candidate;
}

export function applyScriptPluginActions(
  rootNode: MindmapNode,
  actions: ScriptPluginAction[],
) {
  let nextRoot = rootNode;
  const messages: ScriptShowMessageAction[] = [];
  let appliedCount = 0;

  actions.forEach((action, index) => {
    if (action.type === 'showMessage') {
      messages.push(action);
      appliedCount += 1;
      return;
    }
    if (action.type === 'updateNode') {
      nextRoot = updateNode(nextRoot, action.nodeId, (node) => ({
        ...node,
        text: action.patch.text ?? node.text,
        remark: action.patch.remark ?? node.remark,
      }));
      appliedCount += 1;
      return;
    }
    if (action.type === 'setNodeRemark') {
      nextRoot = updateNode(nextRoot, action.nodeId, (node) => ({
        ...node,
        remark: action.remark,
      }));
      appliedCount += 1;
      return;
    }
    if (action.type === 'addChildNode') {
      nextRoot = updateNode(nextRoot, action.parentId, (node) => ({
        ...node,
        collapsed: false,
        children: [
          ...node.children,
          {
            id: nextScriptNodeId(nextRoot, index),
            text: action.node.text,
            remark: action.node.remark ?? '',
            children: [],
          },
        ],
      }));
      appliedCount += 1;
    }
  });

  return { rootNode: nextRoot, messages, appliedCount };
}
