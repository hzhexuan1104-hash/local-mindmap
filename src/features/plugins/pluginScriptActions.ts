import type { MindmapNode, MindmapNodeType } from '../mindmap/types';

export const SCRIPT_ACTION_LIMIT = 1000;
export const SCRIPT_CONTEXT_NODE_LIMIT = 1000;
export const SCRIPT_UPDATE_NODES_LIMIT = 1000;
export const SCRIPT_ADD_CHILD_NODES_LIMIT = 1000;
const SCRIPT_NODE_DEPTH_LIMIT = 64;
const SCRIPT_BATCH_NODE_OPERATION_LIMIT = 10_000;
export const SCRIPT_TEXT_MAX_LENGTH = 500;
export const SCRIPT_REMARK_MAX_LENGTH = 5000;
export const SCRIPT_TEXT_FRAGMENT_MAX_LENGTH = 100;
export const SCRIPT_REMARK_FRAGMENT_MAX_LENGTH = 1000;

export type ScriptShowMessageAction = {
  type: 'showMessage';
  level?: 'info' | 'warning' | 'error';
  message: string;
  exportPath?: string;
};

export type ScriptNodePatch = {
  text?: string;
  remark?: string;
};

export type ScriptUpdateNodeAction = {
  type: 'updateNode';
  nodeId: string;
  patch: ScriptNodePatch;
};

export type ScriptUpdateNodesAction = {
  type: 'updateNodes';
  updates: Array<{
    nodeId: string;
    patch: ScriptNodePatch;
  }>;
};

export type ScriptSetNodeRemarkAction = {
  type: 'setNodeRemark';
  nodeId: string;
  remark: string;
};

export type ScriptAddChildNodeAction = {
  type: 'addChildNode';
  parentId: string;
  node: ImportedPluginNode;
};

export type ScriptAddChildNodesAction = {
  type: 'addChildNodes';
  parentId: string;
  nodes: ImportedPluginNode[];
};

export type ScriptAppendNodeTextAction = {
  type: 'appendNodeText' | 'prependNodeText';
  nodeId: string;
  text: string;
};

export type ScriptAppendNodeRemarkAction = {
  type: 'appendNodeRemark';
  nodeId: string;
  text: string;
};

export type ImportedPluginNode = {
  text: string;
  remark?: string;
  type?: string;
  nodeTypeId?: string;
  children?: ImportedPluginNode[];
};

export type ScriptPluginAction =
  | { type: "createMindmap"; rootNode: ImportedPluginNode }
  | ScriptShowMessageAction
  | ScriptUpdateNodeAction
  | ScriptUpdateNodesAction
  | ScriptSetNodeRemarkAction
  | ScriptAddChildNodeAction
  | ScriptAddChildNodesAction
  | ScriptAppendNodeTextAction
  | ScriptAppendNodeRemarkAction;

export type ScriptContextNode = {
  id: string;
  text: string;
  remark: string;
  parentId: string | null;
  childrenIds: string[];
  type: string;
  tags: string[];
};

export type ScriptPluginContext = {
  contextVersion: 1;
  inputFile?: { path: string; name: string; text?: string };
  app: {
    version: string;
    platform: 'desktop';
  };
  mindmap: {
    filePath: string;
    title: string;
    nodeCount: number;
    selectedNodeId: string | null;
    rootNodeId: string;
  };
  selectedNode: ScriptContextNode | null;
  nodes: ScriptContextNode[];
  selection: {
    nodeIds: string[];
  };
  truncated?: true;
  warning?: string;
};

export type ScriptActionValidationResult =
  | { valid: true; actions: ScriptPluginAction[]; error: null }
  | { valid: false; actions: []; error: string };

export type ScriptActionPermissionResult =
  | { valid: true; error: null }
  | { valid: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function collectNodes(
  node: MindmapNode,
  parentId: string | null,
  nodes: ScriptContextNode[],
  limit = Number.POSITIVE_INFINITY,
) {
  if (nodes.length >= limit) {
    return;
  }
  nodes.push({
    id: node.id,
    text: node.text,
    remark: node.remark ?? '',
    parentId,
    childrenIds: node.children.map((child) => child.id),
    type: node.nodeTypeId ?? 'default',
    tags: [...(node.tags ?? [])],
  });
  for (const child of node.children) {
    collectNodes(child, node.id, nodes, limit);
  }
}

function countNodes(node: MindmapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function findContextNode(
  node: MindmapNode,
  nodeId: string,
  parentId: string | null = null,
): ScriptContextNode | null {
  if (node.id === nodeId) {
    return {
      id: node.id,
      text: node.text,
      remark: node.remark ?? '',
      parentId,
      childrenIds: node.children.map((child) => child.id),
      type: node.nodeTypeId ?? 'default',
      tags: [...(node.tags ?? [])],
    };
  }
  for (const child of node.children) {
    const found = findContextNode(child, nodeId, node.id);
    if (found) return found;
  }
  return null;
}

export function createScriptPluginContext(
  rootNode: MindmapNode,
  selectedNodeId: string | null,
  selectedNodeIds: string[] = selectedNodeId ? [selectedNodeId] : [],
  filePath: string | null = null,
): ScriptPluginContext {
  const nodeCount = countNodes(rootNode);
  const nodes: ScriptContextNode[] = [];
  collectNodes(rootNode, null, nodes, SCRIPT_CONTEXT_NODE_LIMIT);
  const selectedNode = selectedNodeId
    ? findContextNode(rootNode, selectedNodeId)
    : null;
  const truncated = nodeCount > SCRIPT_CONTEXT_NODE_LIMIT;
  const snapshot: ScriptPluginContext = {
    contextVersion: 1,
    app: {
      version: '1.11.0',
      platform: 'desktop',
    },
    mindmap: {
      filePath: filePath ?? '',
      title: rootNode.text,
      nodeCount,
      selectedNodeId: selectedNode?.id ?? null,
      rootNodeId: rootNode.id,
    },
    selectedNode,
    nodes,
    selection: {
      nodeIds: Array.from(new Set(selectedNodeIds)).filter((id) =>
        Boolean(findContextNode(rootNode, id)),
      ),
    },
    ...(truncated
      ? {
          truncated: true as const,
          warning: `节点总数超过 ${SCRIPT_CONTEXT_NODE_LIMIT}，nodes 已截断。`,
        }
      : {}),
  };

  return JSON.parse(JSON.stringify(snapshot)) as ScriptPluginContext;
}

function actionError(index: number, message: string) {
  return `第 ${index + 1} 个 action 出错：${message}`;
}

function validateText(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
) {
  if (typeof value !== 'string') {
    return `${field} 必须是字符串。`;
  }
  if (required && value.trim().length === 0) {
    return `${field} 必填。`;
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

function validatePatch(value: unknown, field: string) {
  if (!isRecord(value)) {
    return `${field} 必须是对象。`;
  }
  const keys = Object.keys(value);
  const illegalKey = keys.find((key) => key !== 'text' && key !== 'remark');
  if (illegalKey) {
    return `${field} 不允许修改 ${illegalKey}。`;
  }
  if (!keys.includes('text') && !keys.includes('remark')) {
    return `${field} 至少包含 text 或 remark。`;
  }
  return (
    (value.text === undefined
      ? null
      : validateText(value.text, `${field}.text`, SCRIPT_TEXT_MAX_LENGTH)) ??
    (value.remark === undefined
      ? null
      : validateText(
          value.remark,
          `${field}.remark`,
          SCRIPT_REMARK_MAX_LENGTH,
        ))
  );
}

function validateNodeTrees(
  nodes: unknown[],
  field: string,
  budget: { remaining: number },
) {
  let count = 0;
  const check = (value: unknown, path: string, depth: number): string | null => {
    if (++count > SCRIPT_ADD_CHILD_NODES_LIMIT) {
      return `${field} 最多 ${SCRIPT_ADD_CHILD_NODES_LIMIT} 个节点（含后代）。`;
    }
    if (--budget.remaining < 0) return batchLimitError;
    if (depth > SCRIPT_NODE_DEPTH_LIMIT) return `${field} 最多 ${SCRIPT_NODE_DEPTH_LIMIT} 层。`;
    if (!isRecord(value)) return `${path} 必须是对象。`;
    const illegalKey = Object.keys(value).find(
      (key) => !['text', 'remark', 'type', 'nodeTypeId', 'children'].includes(key),
    );
    if (illegalKey) return `${path} 不允许字段 ${illegalKey}。`;
    const error = validateText(value.text, `${path}.text`, SCRIPT_TEXT_MAX_LENGTH, true) ??
      (value.remark === undefined ? null : validateText(value.remark, `${path}.remark`, SCRIPT_REMARK_MAX_LENGTH));
    if (error) return error;
    for (const key of ['type', 'nodeTypeId'] as const) {
      const id = value[key];
      if (id !== undefined && (!isNonEmptyString(id) || id.length > 200)) {
        return `${path}.${key} 必须是非空字符串且不超过 200 字符。`;
      }
    }
    if (value.children !== undefined) {
      if (!Array.isArray(value.children)) return `${path}.children 必须是数组。`;
      for (const [index, child] of value.children.entries()) {
        const childError = check(child, `${path}.children[${index}]`, depth + 1);
        if (childError) return childError;
      }
    }
    return null;
  };

  for (const [index, node] of nodes.entries()) {
    const error = check(node, field === 'nodes' ? `nodes[${index}]` : field, 1);
    if (error) return error;
  }
  return null;
}

type ShadowNode = { text: string; remark: string };
const batchLimitError = `单批最多修改或新增 ${SCRIPT_BATCH_NODE_OPERATION_LIMIT} 个节点条目。`;

function validateSingleAction(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  shadowNodes: Map<string, ShadowNode>,
  budget: { remaining: number },
): ScriptActionValidationResult {
  const fail = (message: string): ScriptActionValidationResult => ({
    valid: false,
    actions: [],
    error: actionError(index, message),
  });
  if (!isRecord(value)) {
    return fail('action 必须是对象。');
  }
  if (!isNonEmptyString(value.type)) {
    return fail('type 必须是字符串。');
  }
  if (!['showMessage', 'createMindmap', 'addChildNode', 'addChildNodes', 'updateNodes'].includes(value.type) && --budget.remaining < 0) {
    return fail(batchLimitError);
  }

  switch (value.type) {
    case 'createMindmap': {
      const error = validateNodeTrees([value.rootNode], 'rootNode', budget);
      return error ? fail(error) : { valid: true, actions: [{ type: 'createMindmap', rootNode: value.rootNode as ImportedPluginNode }], error: null };
    }

    case 'showMessage': {
      if (value.exportPath !== undefined && (typeof value.exportPath !== 'string' || value.exportPath.length > 4096 || /[\x00-\x1f]/.test(value.exportPath))) return fail('exportPath 无效。');
      const messageError = validateText(value.message, 'message', 1000);
      if (messageError) return fail(messageError);
      if (
        value.level !== undefined &&
        value.level !== 'info' &&
        value.level !== 'warning' &&
        value.level !== 'error'
      ) {
        return fail('level 仅支持 info / warning / error。');
      }
      return {
        valid: true,
        actions: [{
          type: 'showMessage',
          level: value.level as ScriptShowMessageAction['level'],
          message: value.message as string,
          exportPath: value.exportPath as string | undefined,
        }],
        error: null,
      };
    }
    case 'updateNode': {
      const nodeError = validateKnownNode(value.nodeId, 'nodeId', nodeIds);
      if (nodeError) return fail(nodeError);
      const patchError = validatePatch(value.patch, 'patch');
      if (patchError) return fail(patchError);
      const nodeId = value.nodeId as string;
      const patch = value.patch as ScriptNodePatch;
      const current = shadowNodes.get(nodeId)!;
      shadowNodes.set(nodeId, {
        text: patch.text ?? current.text,
        remark: patch.remark ?? current.remark,
      });
      return {
        valid: true,
        actions: [{ type: 'updateNode', nodeId, patch }],
        error: null,
      };
    }
    case 'updateNodes': {
      if (!Array.isArray(value.updates)) return fail('updates 必须是数组。');
      if (value.updates.length > SCRIPT_UPDATE_NODES_LIMIT) {
        return fail(`updates 单次最多 ${SCRIPT_UPDATE_NODES_LIMIT} 条。`);
      }
      if (value.updates.length === 0) return fail('updates 不能为空。');
      budget.remaining -= value.updates.length;
      if (budget.remaining < 0) return fail(batchLimitError);
      const updates: ScriptUpdateNodesAction['updates'] = [];
      for (const [updateIndex, update] of value.updates.entries()) {
        if (!isRecord(update)) {
          return fail(`updates[${updateIndex}] 必须是对象。`);
        }
        const illegalKey = Object.keys(update).find(
          (key) => key !== 'nodeId' && key !== 'patch',
        );
        if (illegalKey) {
          return fail(`updates[${updateIndex}] 不允许字段 ${illegalKey}。`);
        }
        const nodeError = validateKnownNode(
          update.nodeId,
          `updates[${updateIndex}].nodeId`,
          nodeIds,
        );
        if (nodeError) return fail(nodeError);
        const patchError = validatePatch(
          update.patch,
          `updates[${updateIndex}].patch`,
        );
        if (patchError) return fail(patchError);
        const nodeId = update.nodeId as string;
        const patch = update.patch as ScriptNodePatch;
        const current = shadowNodes.get(nodeId)!;
        shadowNodes.set(nodeId, {
          text: patch.text ?? current.text,
          remark: patch.remark ?? current.remark,
        });
        updates.push({ nodeId, patch });
      }
      return {
        valid: true,
        actions: [{ type: 'updateNodes', updates }],
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
      if (nodeError || remarkError) return fail(nodeError ?? remarkError!);
      const nodeId = value.nodeId as string;
      shadowNodes.set(nodeId, {
        ...shadowNodes.get(nodeId)!,
        remark: value.remark as string,
      });
      return {
        valid: true,
        actions: [{
          type: 'setNodeRemark',
          nodeId,
          remark: value.remark as string,
        }],
        error: null,
      };
    }
    case 'addChildNode': {
      const parentError = validateKnownNode(value.parentId, 'parentId', nodeIds);
      if (parentError) return fail(parentError);
      const nodeError = validateNodeTrees([value.node], 'node', budget);
      if (nodeError) return fail(nodeError);
      return {
        valid: true,
        actions: [{
          type: 'addChildNode',
          parentId: value.parentId as string,
          node: value.node as ImportedPluginNode,
        }],
        error: null,
      };
    }
    case 'addChildNodes': {
      const parentError = validateKnownNode(value.parentId, 'parentId', nodeIds);
      if (parentError) return fail(parentError);
      if (!Array.isArray(value.nodes)) return fail('nodes 必须是数组。');
      if (value.nodes.length === 0) return fail('nodes 不能为空。');
      const nodeError = validateNodeTrees(value.nodes, 'nodes', budget);
      if (nodeError) return fail(nodeError);
      return {
        valid: true,
        actions: [{
          type: 'addChildNodes',
          parentId: value.parentId as string,
          nodes: value.nodes as ImportedPluginNode[],
        }],
        error: null,
      };
    }
    case 'appendNodeText':
    case 'prependNodeText': {
      const nodeError = validateKnownNode(value.nodeId, 'nodeId', nodeIds);
      const textError = validateText(
        value.text,
        'text',
        SCRIPT_TEXT_FRAGMENT_MAX_LENGTH,
      );
      if (nodeError || textError) return fail(nodeError ?? textError!);
      const nodeId = value.nodeId as string;
      const current = shadowNodes.get(nodeId)!;
      const nextText =
        value.type === 'appendNodeText'
          ? `${current.text}${value.text as string}`
          : `${value.text as string}${current.text}`;
      if (nextText.length > SCRIPT_TEXT_MAX_LENGTH) {
        return fail(`拼接后 text 长度不能超过 ${SCRIPT_TEXT_MAX_LENGTH}。`);
      }
      shadowNodes.set(nodeId, { ...current, text: nextText });
      return {
        valid: true,
        actions: [{
          type: value.type,
          nodeId,
          text: value.text as string,
        }],
        error: null,
      };
    }
    case 'appendNodeRemark': {
      const nodeError = validateKnownNode(value.nodeId, 'nodeId', nodeIds);
      const textError = validateText(
        value.text,
        'text',
        SCRIPT_REMARK_FRAGMENT_MAX_LENGTH,
      );
      if (nodeError || textError) return fail(nodeError ?? textError!);
      const nodeId = value.nodeId as string;
      const current = shadowNodes.get(nodeId)!;
      const nextRemark = `${current.remark}${value.text as string}`;
      if (nextRemark.length > SCRIPT_REMARK_MAX_LENGTH) {
        return fail(`拼接后 remark 长度不能超过 ${SCRIPT_REMARK_MAX_LENGTH}。`);
      }
      shadowNodes.set(nodeId, { ...current, remark: nextRemark });
      return {
        valid: true,
        actions: [{
          type: 'appendNodeRemark',
          nodeId,
          text: value.text as string,
        }],
        error: null,
      };
    }
    case 'deleteNode':
      return fail('当前版本暂不支持 deleteNode，防止误删节点。');
    case 'applyTemplate':
      return fail('当前版本暂不支持 applyTemplate。');
    case 'addNode':
      return fail('addNode 本批暂不支持执行。');
    default:
      return fail(`不支持的 action type：${String(value.type)}`);
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
  const shadowNodes = new Map(
    nodes.map((node) => [node.id, { text: node.text, remark: node.remark }]),
  );
  const actions: ScriptPluginAction[] = [];
  const budget = { remaining: SCRIPT_BATCH_NODE_OPERATION_LIMIT };

  for (const [index, action] of value.entries()) {
    const result = validateSingleAction(action, index, nodeIds, shadowNodes, budget);
    if (!result.valid) {
      return result;
    }
    actions.push(...result.actions);
  }

  if (actions.some(action => action.type === 'createMindmap') && actions.filter(action => action.type !== 'showMessage').length !== 1) {
    return { valid: false, actions: [], error: 'createMindmap 必须为本批唯一的修改操作。' };
  }
  return { valid: true, actions, error: null };
}

export function validateScriptActionPermissions(
  actions: ScriptPluginAction[],
  permissions: string[] = [],
  subject = '脚本',
): ScriptActionPermissionResult {
  const mutatesMindmap = actions.some((action) => action.type !== 'showMessage');
  if (
    mutatesMindmap &&
    !permissions.includes('node:write') &&
    !permissions.includes('mindmap:write')
  ) {
    return {
      valid: false,
      error: `${subject}返回了导图修改 action，但未声明 node:write 或 mindmap:write 权限。`,
    };
  }
  return { valid: true, error: null };
}

export function applyScriptPluginActions(
  rootNode: MindmapNode,
  actions: ScriptPluginAction[],
  nodeTypes: readonly MindmapNodeType[] = [],
) {
  let nextRoot = rootNode;
  const messages: ScriptShowMessageAction[] = [];
  const originalNodes = new Map<string, MindmapNode>();
  const indexNode = (node: MindmapNode) => {
    originalNodes.set(node.id, node);
    node.children.forEach(indexNode);
  };
  indexNode(rootNode);
  const typesById = new Map(nodeTypes.map((type) => [type.id, type]));
  const generatedIds = new Set<string>();
  const create = (node: ImportedPluginNode): MindmapNode => {
    let id: string;
    do {
      id = crypto.randomUUID();
    } while (originalNodes.has(id) || generatedIds.has(id));
    generatedIds.add(id);
    const type = typesById.get(node.type ?? node.nodeTypeId ?? '');
    return {
      id,
      text: node.text,
      remark: node.remark ?? type?.defaultRemark ?? '',
      ...(type ? { nodeTypeId: type.id } : {}),
      children: (node.children ?? []).map(create),
    };
  };
  const patches = new Map<string, ScriptNodePatch>();
  const additions = new Map<string, MindmapNode[]>();
  const patchNode = (id: string, patch: ScriptNodePatch) => {
    const previous = patches.get(id);
    patches.set(id, {
      text: patch.text ?? previous?.text,
      remark: patch.remark ?? previous?.remark,
    });
  };

  for (const action of actions) {
    switch (action.type) {
      case 'showMessage':
        messages.push(action);
        break;
      case 'updateNode':
        patchNode(action.nodeId, action.patch);
        break;
      case 'updateNodes':
        action.updates.forEach((update) => patchNode(update.nodeId, update.patch));
        break;
      case 'setNodeRemark':
        patchNode(action.nodeId, { remark: action.remark });
        break;
      case 'appendNodeText':
      case 'prependNodeText': {
        const text = patches.get(action.nodeId)?.text ?? originalNodes.get(action.nodeId)!.text;
        patchNode(action.nodeId, { text:
          action.type === 'appendNodeText'
            ? `${text}${action.text}`
            : `${action.text}${text}`,
        });
        break;
      }
      case 'appendNodeRemark': {
        const remark = patches.get(action.nodeId)?.remark ?? originalNodes.get(action.nodeId)!.remark;
        patchNode(action.nodeId, { remark: `${remark}${action.text}` });
        break;
      }
      case 'addChildNode':
      case 'addChildNodes': {
        const children = additions.get(action.parentId) ?? [];
        const inputs = action.type === 'addChildNode' ? [action.node] : action.nodes;
        children.push(...inputs.map(create));
        additions.set(action.parentId, children);
        break;
      }
      case 'createMindmap':
        nextRoot = create(action.rootNode);
        break;
    }
  }

  if (patches.size || additions.size) {
    const apply = (node: MindmapNode): MindmapNode => {
      const patch = patches.get(node.id);
      const added = additions.get(node.id);
      const children = node.children.map(apply);
      if (!patch && !added && children.every((child, index) => child === node.children[index])) {
        return node;
      }
      return {
        ...node,
        text: patch?.text ?? node.text,
        remark: patch?.remark ?? node.remark,
        ...(added ? { collapsed: false } : {}),
        children: added ? [...children, ...added] : children,
      };
    };
    nextRoot = apply(rootNode);
  }
  return {
    rootNode: nextRoot,
    messages,
    appliedCount: actions.length,
    mutationCount: actions.length - messages.length,
  };
}
