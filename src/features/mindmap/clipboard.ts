import type { MindmapNode } from './types';

type NodePosition = NonNullable<MindmapNode['position']>;

type IdGenerator = () => string;

type CloneOptions = {
  generateId?: IdGenerator;
  rootPosition?: NodePosition;
  preservePositions?: boolean;
};

type PasteOptions = {
  generateId?: IdGenerator;
  getRootPosition?: (input: {
    node: MindmapNode;
    targetNode: MindmapNode;
    index: number;
    existingChildCount: number;
  }) => NodePosition | undefined;
};

type DuplicateOptions = PasteOptions;

function createFallbackId() {
  return `node-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function defaultGenerateId() {
  return globalThis.crypto?.randomUUID?.() ?? createFallbackId();
}

function cloneNodeSubtree(node: MindmapNode): MindmapNode {
  return {
    ...node,
    position: node.position ? { ...node.position } : undefined,
    children: node.children.map(cloneNodeSubtree),
  };
}

function offsetPosition(
  position: MindmapNode['position'],
  offset: NodePosition | null,
) {
  if (!position) {
    return undefined;
  }

  if (!offset) {
    return { ...position };
  }

  return {
    x: position.x + offset.x,
    y: position.y + offset.y,
  };
}

function cloneNodeSubtreeWithNewIdsInternal(
  node: MindmapNode,
  generateId: IdGenerator,
  offset: NodePosition | null,
  preservePositions: boolean,
  rootPosition?: NodePosition,
): MindmapNode {
  return {
    ...node,
    id: generateId(),
    position: rootPosition
      ? { ...rootPosition }
      : preservePositions
        ? offsetPosition(node.position, offset)
        : undefined,
    children: node.children.map((child) =>
      cloneNodeSubtreeWithNewIdsInternal(
        child,
        generateId,
        offset,
        preservePositions,
      ),
    ),
  };
}

export function cloneNodeSubtreeWithNewIds(
  node: MindmapNode,
  options: CloneOptions = {},
): MindmapNode {
  const generateId = options.generateId ?? defaultGenerateId;
  const preservePositions = options.preservePositions ?? true;
  const offset =
    options.rootPosition && node.position
      ? {
          x: options.rootPosition.x - node.position.x,
          y: options.rootPosition.y - node.position.y,
        }
      : null;

  return cloneNodeSubtreeWithNewIdsInternal(
    node,
    generateId,
    offset,
    preservePositions,
    options.rootPosition,
  );
}

export function collectNodeIds(node: MindmapNode, ids = new Set<string>()) {
  ids.add(node.id);
  node.children.forEach((child) => collectNodeIds(child, ids));
  return ids;
}

export function collectSelectedSubtrees(
  rootNode: MindmapNode,
  selectedNodeIds: Iterable<string>,
): MindmapNode[] {
  const selectedIdSet = new Set(selectedNodeIds);
  const selectedNodes: MindmapNode[] = [];

  const visit = (node: MindmapNode, hasSelectedAncestor: boolean) => {
    const isSelected = selectedIdSet.has(node.id);

    if (isSelected && !hasSelectedAncestor) {
      selectedNodes.push(cloneNodeSubtree(node));
    }

    node.children.forEach((child) =>
      visit(child, hasSelectedAncestor || isSelected),
    );
  };

  visit(rootNode, false);
  return selectedNodes;
}

function updateNodeById(
  node: MindmapNode,
  nodeId: string,
  updater: (node: MindmapNode) => MindmapNode,
): MindmapNode {
  if (node.id === nodeId) {
    return updater(node);
  }

  return {
    ...node,
    children: node.children.map((child) => updateNodeById(child, nodeId, updater)),
  };
}

function findNodeById(node: MindmapNode, nodeId: string): MindmapNode | null {
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
}

function findParentIdByNodeId(
  node: MindmapNode,
  nodeId: string,
): string | null {
  if (node.children.some((child) => child.id === nodeId)) {
    return node.id;
  }

  for (const child of node.children) {
    const parentId = findParentIdByNodeId(child, nodeId);

    if (parentId) {
      return parentId;
    }
  }

  return null;
}

export function pasteNodesAsChildren(
  rootNode: MindmapNode,
  targetNodeId: string,
  nodesToPaste: MindmapNode[],
  options: PasteOptions = {},
) {
  const targetNode = findNodeById(rootNode, targetNodeId) ?? rootNode;
  const generateId = options.generateId ?? defaultGenerateId;
  const pastedNodes = nodesToPaste.map((node, index) => {
    const rootPosition = options.getRootPosition?.({
      node,
      targetNode,
      index,
      existingChildCount: targetNode.children.length,
    });

    return cloneNodeSubtreeWithNewIds(node, {
      generateId,
      rootPosition,
      preservePositions: Boolean(rootPosition),
    });
  });
  const pastedNodeIds = pastedNodes.map((node) => node.id);

  return {
    rootNode: updateNodeById(rootNode, targetNode.id, (node) => ({
      ...node,
      children: [...node.children, ...pastedNodes],
    })),
    pastedNodeIds,
  };
}

export function duplicateNodeAsSibling(
  rootNode: MindmapNode,
  nodeId: string,
  options: DuplicateOptions = {},
) {
  const sourceNode = findNodeById(rootNode, nodeId);

  if (!sourceNode) {
    return null;
  }

  const parentId = nodeId === rootNode.id ? rootNode.id : findParentIdByNodeId(rootNode, nodeId);
  const targetNodeId = parentId ?? rootNode.id;

  return pasteNodesAsChildren(rootNode, targetNodeId, [sourceNode], options);
}

export function cutNodesSafely(
  rootNode: MindmapNode,
  selectedNodeIds: Iterable<string>,
  rootNodeId = rootNode.id,
) {
  const selectedWithoutRoot = [...new Set(selectedNodeIds)].filter(
    (nodeId) => nodeId !== rootNodeId,
  );
  const cutNodes = collectSelectedSubtrees(rootNode, selectedWithoutRoot);
  const cutNodeIds = cutNodes.map((node) => node.id);

  return {
    cutNodes,
    cutNodeIds,
    skippedRoot: [...selectedNodeIds].some((nodeId) => nodeId === rootNodeId),
  };
}

export function hasDuplicateIds(rootNode: MindmapNode) {
  const ids = new Set<string>();
  const visitedNodes = new Set<MindmapNode>();
  let hasDuplicate = false;

  const visit = (node: MindmapNode) => {
    if (visitedNodes.has(node)) {
      hasDuplicate = true;
      return;
    }

    if (ids.has(node.id)) {
      hasDuplicate = true;
      return;
    }

    visitedNodes.add(node);
    ids.add(node.id);
    node.children.forEach(visit);
  };

  visit(rootNode);
  return hasDuplicate;
}

export function validateTreeIntegrity(rootNode: MindmapNode) {
  const ids = new Set<string>();
  const nodeObjects = new Set<MindmapNode>();
  const errors: string[] = [];

  const visit = (node: MindmapNode, path: Set<MindmapNode>) => {
    if (path.has(node)) {
      errors.push(`节点 ${node.id} 存在循环引用`);
      return;
    }

    if (nodeObjects.has(node)) {
      errors.push(`节点 ${node.id} 被多个父节点复用`);
      return;
    }

    if (ids.has(node.id)) {
      errors.push(`节点 ID 重复：${node.id}`);
      return;
    }

    ids.add(node.id);
    nodeObjects.add(node);

    const nextPath = new Set(path);
    nextPath.add(node);
    node.children.forEach((child) => visit(child, nextPath));
  };

  visit(rootNode, new Set());

  return {
    valid: errors.length === 0,
    errors,
  };
}
