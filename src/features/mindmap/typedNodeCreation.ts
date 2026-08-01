import { createNodeFromType, findNodeTypeById } from './nodeTypes';
import { findNodeById } from './treeOperations';
import type { MindmapNode, MindmapNodeType } from './types';

export type NodeTypeCreationOption = {
  value: string;
  label: string;
};

export type TypedNodeCreationResult = {
  rootNode: MindmapNode;
  createdNode: MindmapNode;
  selectedNodeId: string;
  selectedNodeIds: string[];
};

export type TypedNodeBatchCreationResult = {
  rootNode: MindmapNode;
  createdNodes: MindmapNode[];
  selectedNodeId: string;
  selectedNodeIds: string[];
};

export function getNodeTypeCreationOptions(
  nodeTypes: MindmapNodeType[],
): NodeTypeCreationOption[] {
  const seenIds = new Set<string>();
  const options: NodeTypeCreationOption[] = [
    { value: '', label: '普通节点' },
  ];

  nodeTypes.forEach((nodeType) => {
    if (!nodeType.id || seenIds.has(nodeType.id)) {
      return;
    }

    seenIds.add(nodeType.id);
    options.push({
      value: nodeType.id,
      label: nodeType.name,
    });
  });

  return options;
}

function createUniqueTypedNode(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  position?: MindmapNode['position'],
) {
  const nodeType = findNodeTypeById(nodeTypes, nodeTypeId);
  let node = createNodeFromType(nodeType);

  while (findNodeById(rootNode, node.id)) {
    node = createNodeFromType(nodeType);
  }

  return {
    ...node,
    ...(position ? { position } : {}),
  };
}

function createResult(
  rootNode: MindmapNode,
  createdNode: MindmapNode,
): TypedNodeCreationResult {
  return {
    rootNode,
    createdNode,
    selectedNodeId: createdNode.id,
    selectedNodeIds: [createdNode.id],
  };
}

function createBatchResult(
  rootNode: MindmapNode,
  createdNodes: MindmapNode[],
): TypedNodeBatchCreationResult | null {
  const selectedNodeIds = createdNodes.map((node) => node.id);
  const selectedNodeId = selectedNodeIds[selectedNodeIds.length - 1];

  if (!selectedNodeId) {
    return null;
  }

  return {
    rootNode,
    createdNodes,
    selectedNodeId,
    selectedNodeIds,
  };
}

function findNodeDepth(
  node: MindmapNode,
  targetNodeId: string,
  depth = 0,
): number | null {
  if (node.id === targetNodeId) {
    return depth;
  }

  for (const child of node.children) {
    const childDepth = findNodeDepth(child, targetNodeId, depth + 1);

    if (childDepth !== null) {
      return childDepth;
    }
  }

  return null;
}

export function addTypedChildNode(
  rootNode: MindmapNode,
  parentNodeId: string,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  position?: MindmapNode['position'],
): TypedNodeCreationResult | null {
  if (!findNodeById(rootNode, parentNodeId)) {
    return null;
  }

  const createdNode = createUniqueTypedNode(
    rootNode,
    nodeTypes,
    nodeTypeId,
    position,
  );
  let inserted = false;

  const insertChild = (node: MindmapNode): MindmapNode => {
    if (node.id === parentNodeId) {
      inserted = true;
      return {
        ...node,
        children: [...node.children, createdNode],
      };
    }

    return {
      ...node,
      children: node.children.map(insertChild),
    };
  };

  const nextRootNode = insertChild(rootNode);

  return inserted ? createResult(nextRootNode, createdNode) : null;
}

/** Creates one child under every existing, selected parent node. */
export function addTypedChildNodes(
  rootNode: MindmapNode,
  parentNodeIds: Iterable<string>,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  getPosition?: (
    parentNode: MindmapNode,
    childIndex: number,
  ) => MindmapNode['position'] | undefined,
): TypedNodeBatchCreationResult | null {
  let nextRootNode = rootNode;
  const createdNodes: MindmapNode[] = [];
  const uniqueParentNodeIds = [...new Set(parentNodeIds)];

  for (const parentNodeId of uniqueParentNodeIds) {
    const parentNode = findNodeById(nextRootNode, parentNodeId);

    if (!parentNode) {
      continue;
    }

    const result = addTypedChildNode(
      nextRootNode,
      parentNodeId,
      nodeTypes,
      nodeTypeId,
      getPosition?.(parentNode, parentNode.children.length),
    );

    if (result) {
      nextRootNode = result.rootNode;
      createdNodes.push(result.createdNode);
    }
  }

  return createBatchResult(nextRootNode, createdNodes);
}

export function addTypedSiblingNode(
  rootNode: MindmapNode,
  siblingNodeId: string,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  position?: MindmapNode['position'],
): TypedNodeCreationResult | null {
  if (siblingNodeId === rootNode.id || !findNodeById(rootNode, siblingNodeId)) {
    return null;
  }

  const createdNode = createUniqueTypedNode(
    rootNode,
    nodeTypes,
    nodeTypeId,
    position,
  );
  let inserted = false;

  const insertSibling = (node: MindmapNode): MindmapNode => ({
    ...node,
    children: node.children.flatMap((child) => {
      if (child.id === siblingNodeId) {
        inserted = true;
        return [child, createdNode];
      }

      return [insertSibling(child)];
    }),
  });

  const nextRootNode = insertSibling(rootNode);

  return inserted ? createResult(nextRootNode, createdNode) : null;
}

/**
 * Creates one sibling after every selected non-root node. The root node is
 * intentionally skipped because a mind map can only have one root.
 */
export function addTypedSiblingNodes(
  rootNode: MindmapNode,
  siblingNodeIds: Iterable<string>,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  getPosition?: (
    siblingNode: MindmapNode,
    index: number,
  ) => MindmapNode['position'] | undefined,
): TypedNodeBatchCreationResult | null {
  let nextRootNode = rootNode;
  const createdNodes: MindmapNode[] = [];
  const uniqueSiblingNodeIds = [...new Set(siblingNodeIds)];

  for (const [index, siblingNodeId] of uniqueSiblingNodeIds.entries()) {
    if (siblingNodeId === rootNode.id) {
      continue;
    }

    const siblingNode = findNodeById(nextRootNode, siblingNodeId);

    if (!siblingNode) {
      continue;
    }

    const result = addTypedSiblingNode(
      nextRootNode,
      siblingNodeId,
      nodeTypes,
      nodeTypeId,
      getPosition?.(siblingNode, index),
    );

    if (result) {
      nextRootNode = result.rootNode;
      createdNodes.push(result.createdNode);
    }
  }

  return createBatchResult(nextRootNode, createdNodes);
}

/** Inserts a new node between a non-root node and its current parent. */
export function addTypedParentNode(
  rootNode: MindmapNode,
  childNodeId: string,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  position?: MindmapNode['position'],
): TypedNodeCreationResult | null {
  if (childNodeId === rootNode.id || !findNodeById(rootNode, childNodeId)) {
    return null;
  }

  const createdNode = createUniqueTypedNode(
    rootNode,
    nodeTypes,
    nodeTypeId,
    position,
  );
  let inserted = false;

  const insertParent = (node: MindmapNode): MindmapNode => ({
    ...node,
    children: node.children.map((child) => {
      if (child.id === childNodeId) {
        inserted = true;
        return {
          ...createdNode,
          children: [child],
        };
      }

      return insertParent(child);
    }),
  });

  const nextRootNode = insertParent(rootNode);

  return inserted ? createResult(nextRootNode, createdNode) : null;
}

/**
 * Inserts one parent above every selected non-root node. Descendants are
 * processed first so selecting both a node and its descendant remains stable.
 */
export function addTypedParentNodes(
  rootNode: MindmapNode,
  childNodeIds: Iterable<string>,
  nodeTypes: MindmapNodeType[],
  nodeTypeId: string,
  getPosition?: (
    childNode: MindmapNode,
    index: number,
  ) => MindmapNode['position'] | undefined,
): TypedNodeBatchCreationResult | null {
  const targetNodeIds = [...new Set(childNodeIds)]
    .filter((nodeId) => nodeId !== rootNode.id)
    .map((nodeId) => ({ nodeId, depth: findNodeDepth(rootNode, nodeId) }))
    .filter(
      (target): target is { nodeId: string; depth: number } =>
        target.depth !== null,
    )
    .sort((left, right) => right.depth - left.depth)
    .map((target) => target.nodeId);

  let nextRootNode = rootNode;
  const createdNodes: MindmapNode[] = [];

  for (const [index, childNodeId] of targetNodeIds.entries()) {
    const childNode = findNodeById(nextRootNode, childNodeId);

    if (!childNode) {
      continue;
    }

    const result = addTypedParentNode(
      nextRootNode,
      childNodeId,
      nodeTypes,
      nodeTypeId,
      getPosition?.(childNode, index),
    );

    if (result) {
      nextRootNode = result.rootNode;
      createdNodes.push(result.createdNode);
    }
  }

  return createBatchResult(nextRootNode, createdNodes);
}
