import type { MindmapNodeType } from './types';

export const NODE_TYPE_PACK_KIND = 'local-mindmap-node-type-pack';
export const NODE_TYPE_PACK_VERSION = '1.0';

export type NodeTypePack = {
  version: string;
  kind: typeof NODE_TYPE_PACK_KIND;
  meta: {
    name: string;
    description: string;
    createdAt: string;
    source: string;
  };
  nodeTypes: MindmapNodeType[];
};

export type NodeTypePackImportResult = {
  nodeTypes: MindmapNodeType[];
  importedCount: number;
  skippedDuplicateCount: number;
  renamedConflictCount: number;
  invalidCount: number;
  nameConflictCount: number;
};

const NODE_TYPE_SHAPES: MindmapNodeType['shape'][] = [
  'rounded',
  'rectangle',
  'pill',
  'diamond',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

export function normalizeImportedNodeType(
  value: unknown,
): MindmapNodeType | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  const shapeValue = asString(value.shape, 'rounded') as MindmapNodeType['shape'];
  const fontSize = Number(value.fontSize);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    icon: asString(value.icon),
    shape: NODE_TYPE_SHAPES.includes(shapeValue) ? shapeValue : 'rounded',
    backgroundColor: asString(value.backgroundColor, '#eef5ff'),
    borderColor: asString(value.borderColor, '#1f6feb'),
    textColor: asString(value.textColor, '#14315f'),
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18,
    bold: typeof value.bold === 'boolean' ? value.bold : Boolean(value.bold),
    defaultText: asString(value.defaultText, '新节点'),
    defaultRemark: asString(value.defaultRemark),
  };
}

export function isSameNodeType(
  firstNodeType: MindmapNodeType,
  secondNodeType: MindmapNodeType,
) {
  return (
    firstNodeType.id === secondNodeType.id &&
    firstNodeType.name === secondNodeType.name &&
    firstNodeType.icon === secondNodeType.icon &&
    firstNodeType.shape === secondNodeType.shape &&
    firstNodeType.backgroundColor === secondNodeType.backgroundColor &&
    firstNodeType.borderColor === secondNodeType.borderColor &&
    firstNodeType.textColor === secondNodeType.textColor &&
    firstNodeType.fontSize === secondNodeType.fontSize &&
    firstNodeType.bold === secondNodeType.bold &&
    firstNodeType.defaultText === secondNodeType.defaultText &&
    firstNodeType.defaultRemark === secondNodeType.defaultRemark
  );
}

export function resolveNodeTypeIdConflict(
  nodeTypeId: string,
  existingNodeTypes: MindmapNodeType[],
) {
  const usedIds = new Set(existingNodeTypes.map((nodeType) => nodeType.id));
  let nextIndex = 1;
  let nextId = `${nodeTypeId}-imported-${nextIndex}`;

  while (usedIds.has(nextId)) {
    nextIndex += 1;
    nextId = `${nodeTypeId}-imported-${nextIndex}`;
  }

  return nextId;
}

export function createNodeTypePack(
  nodeTypes: MindmapNodeType[],
  meta?: Partial<NodeTypePack['meta']>,
): NodeTypePack {
  return {
    version: NODE_TYPE_PACK_VERSION,
    kind: NODE_TYPE_PACK_KIND,
    meta: {
      name: meta?.name ?? '节点类型包',
      description: meta?.description ?? 'Local Mindmap 自定义节点类型包',
      createdAt: meta?.createdAt ?? new Date().toISOString(),
      source: meta?.source ?? 'local-mindmap',
    },
    nodeTypes: nodeTypes.map((nodeType) => ({ ...nodeType })),
  };
}

export function validateNodeTypePack(value: unknown): value is NodeTypePack {
  return (
    isRecord(value) &&
    value.kind === NODE_TYPE_PACK_KIND &&
    typeof value.version === 'string' &&
    isRecord(value.meta) &&
    Array.isArray(value.nodeTypes)
  );
}

export function parseNodeTypePack(fileContent: string): NodeTypePack {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!validateNodeTypePack(parsedContent)) {
    throw new Error('Invalid node type pack');
  }

  return {
    version: parsedContent.version,
    kind: NODE_TYPE_PACK_KIND,
    meta: {
      name: asString(parsedContent.meta.name, '节点类型包'),
      description: asString(parsedContent.meta.description),
      createdAt: asString(parsedContent.meta.createdAt, new Date().toISOString()),
      source: asString(parsedContent.meta.source, 'local-mindmap'),
    },
    nodeTypes: parsedContent.nodeTypes as MindmapNodeType[],
  };
}

export function exportNodeTypesToPack(
  nodeTypes: MindmapNodeType[],
  meta?: Partial<NodeTypePack['meta']>,
) {
  return JSON.stringify(createNodeTypePack(nodeTypes, meta), null, 2);
}

export function importNodeTypesFromPack(
  existingNodeTypes: MindmapNodeType[],
  pack: NodeTypePack,
): NodeTypePackImportResult {
  const nextNodeTypes = existingNodeTypes.map((nodeType) => ({ ...nodeType }));
  let importedCount = 0;
  let skippedDuplicateCount = 0;
  let renamedConflictCount = 0;
  let invalidCount = 0;
  let nameConflictCount = 0;

  if (!validateNodeTypePack(pack)) {
    throw new Error('Invalid node type pack');
  }

  for (const rawNodeType of pack.nodeTypes) {
    const normalizedNodeType = normalizeImportedNodeType(rawNodeType);

    if (!normalizedNodeType) {
      invalidCount += 1;
      continue;
    }

    const matchedById = nextNodeTypes.find(
      (nodeType) => nodeType.id === normalizedNodeType.id,
    );

    if (matchedById) {
      if (isSameNodeType(matchedById, normalizedNodeType)) {
        skippedDuplicateCount += 1;
        continue;
      }

      nextNodeTypes.push({
        ...normalizedNodeType,
        id: resolveNodeTypeIdConflict(normalizedNodeType.id, nextNodeTypes),
      });
      renamedConflictCount += 1;
      importedCount += 1;
      continue;
    }

    if (
      nextNodeTypes.some(
        (nodeType) =>
          nodeType.name === normalizedNodeType.name &&
          nodeType.id !== normalizedNodeType.id,
      )
    ) {
      nameConflictCount += 1;
    }

    nextNodeTypes.push(normalizedNodeType);
    importedCount += 1;
  }

  return {
    nodeTypes: nextNodeTypes,
    importedCount,
    skippedDuplicateCount,
    renamedConflictCount,
    invalidCount,
    nameConflictCount,
  };
}
