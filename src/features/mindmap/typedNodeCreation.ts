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
