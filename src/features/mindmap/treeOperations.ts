import type { MindmapNode } from './types';

export type TreeIntegrityResult = {
  valid: boolean;
  errors: string[];
};

export function findNodeById(
  node: MindmapNode,
  nodeId: string,
): MindmapNode | null {
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

export function findParentNode(
  node: MindmapNode,
  nodeId: string,
): MindmapNode | null {
  if (node.children.some((child) => child.id === nodeId)) {
    return node;
  }

  for (const child of node.children) {
    const parentNode = findParentNode(child, nodeId);

    if (parentNode) {
      return parentNode;
    }
  }

  return null;
}

export function isDescendant(
  rootNode: MindmapNode,
  ancestorNodeId: string,
  possibleDescendantNodeId: string,
): boolean {
  const ancestorNode = findNodeById(rootNode, ancestorNodeId);

  if (!ancestorNode) {
    return false;
  }

  return ancestorNode.children.some((child) => {
    if (child.id === possibleDescendantNodeId) {
      return true;
    }

    return isDescendant(child, child.id, possibleDescendantNodeId);
  });
}

export function collectNodeIds(
  node: MindmapNode,
  ids = new Set<string>(),
): Set<string> {
  ids.add(node.id);
  node.children.forEach((child) => collectNodeIds(child, ids));
  return ids;
}

export function removeNodeById(
  rootNode: MindmapNode,
  nodeId: string,
): { rootNode: MindmapNode; removedNode: MindmapNode } | null {
  if (rootNode.id === nodeId) {
    return null;
  }

  let removedNode: MindmapNode | null = null;

  const removeFromNode = (node: MindmapNode): MindmapNode => {
    const nextChildren: MindmapNode[] = [];

    node.children.forEach((child) => {
      if (child.id === nodeId) {
        removedNode = child;
        return;
      }

      nextChildren.push(removeFromNode(child));
    });

    return {
      ...node,
      children: nextChildren,
    };
  };

  const nextRootNode = removeFromNode(rootNode);

  if (!removedNode) {
    return null;
  }

  return {
    rootNode: nextRootNode,
    removedNode,
  };
}

export function insertNodeAsChild(
  rootNode: MindmapNode,
  targetNodeId: string,
  nodeToInsert: MindmapNode,
): MindmapNode | null {
  let inserted = false;

  const insertIntoNode = (node: MindmapNode): MindmapNode => {
    if (node.id === targetNodeId) {
      inserted = true;
      return {
        ...node,
        collapsed: false,
        children: [...node.children, nodeToInsert],
      };
    }

    return {
      ...node,
      children: node.children.map(insertIntoNode),
    };
  };

  const nextRootNode = insertIntoNode(rootNode);

  return inserted ? nextRootNode : null;
}

export function validateTreeIntegrity(rootNode: MindmapNode): TreeIntegrityResult {
  const ids = new Set<string>();
  const nodeObjects = new Set<MindmapNode>();
  const errors: string[] = [];

  const visit = (node: MindmapNode, path: Set<MindmapNode>) => {
    if (path.has(node)) {
      errors.push(`Node ${node.id} has a circular reference`);
      return;
    }

    if (nodeObjects.has(node)) {
      errors.push(`Node ${node.id} is reused by multiple parents`);
      return;
    }

    if (ids.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
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
    valid: errors.length === 0 && Boolean(rootNode.id),
    errors,
  };
}

export function moveNodeAsChild(
  rootNode: MindmapNode,
  movedNodeId: string,
  targetNodeId: string,
): { rootNode: MindmapNode; movedNode: MindmapNode } | null {
  if (movedNodeId === rootNode.id || movedNodeId === targetNodeId) {
    return null;
  }

  if (!findNodeById(rootNode, movedNodeId) || !findNodeById(rootNode, targetNodeId)) {
    return null;
  }

  if (isDescendant(rootNode, movedNodeId, targetNodeId)) {
    return null;
  }

  const removedResult = removeNodeById(rootNode, movedNodeId);

  if (!removedResult) {
    return null;
  }

  const nextRootNode = insertNodeAsChild(
    removedResult.rootNode,
    targetNodeId,
    removedResult.removedNode,
  );

  if (!nextRootNode) {
    return null;
  }

  const integrity = validateTreeIntegrity(nextRootNode);

  if (!integrity.valid) {
    return null;
  }

  return {
    rootNode: nextRootNode,
    movedNode: removedResult.removedNode,
  };
}
