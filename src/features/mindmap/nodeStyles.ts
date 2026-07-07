import type {
  MindmapNode,
  MindmapNodeStyle,
  MindmapNodeType,
} from './types';

export type EffectiveNodeStyle = Required<MindmapNodeStyle>;

export type NodeStyleCssVariables = {
  '--node-bg': string;
  '--node-border': string;
  '--node-text': string;
  '--node-font-size': string;
  '--node-font-weight': number;
};

export const DEFAULT_NODE_STYLE: EffectiveNodeStyle = {
  shape: 'rounded',
  backgroundColor: '#ffffff',
  borderColor: '#c9d8f0',
  textColor: '#14315f',
  fontSize: 16,
  bold: false,
};

export function getEffectiveNodeStyle(
  node: MindmapNode,
  nodeType?: MindmapNodeType | null,
): EffectiveNodeStyle {
  return {
    shape: node.style?.shape ?? nodeType?.shape ?? DEFAULT_NODE_STYLE.shape,
    backgroundColor:
      node.style?.backgroundColor ??
      nodeType?.backgroundColor ??
      DEFAULT_NODE_STYLE.backgroundColor,
    borderColor:
      node.style?.borderColor ??
      nodeType?.borderColor ??
      DEFAULT_NODE_STYLE.borderColor,
    textColor:
      node.style?.textColor ??
      nodeType?.textColor ??
      DEFAULT_NODE_STYLE.textColor,
    fontSize:
      node.style?.fontSize ?? nodeType?.fontSize ?? DEFAULT_NODE_STYLE.fontSize,
    bold: node.style?.bold ?? nodeType?.bold ?? DEFAULT_NODE_STYLE.bold,
  };
}

export function mergeNodeStyle(
  currentStyle: MindmapNodeStyle | undefined,
  patch: MindmapNodeStyle,
): MindmapNodeStyle {
  return {
    ...(currentStyle ?? {}),
    ...patch,
  };
}

export function getNodeStyleCssVariables(
  style: EffectiveNodeStyle,
): NodeStyleCssVariables {
  return {
    '--node-bg': style.backgroundColor,
    '--node-border': style.borderColor,
    '--node-text': style.textColor,
    '--node-font-size': `${style.fontSize}px`,
    '--node-font-weight': style.bold ? 700 : 500,
  };
}

export function getNodeShapeClassName(style: EffectiveNodeStyle): string {
  return `shape-${style.shape}`;
}

export function applyStyleToNodeType(
  nodeType: MindmapNodeType,
  style: EffectiveNodeStyle,
): MindmapNodeType {
  return {
    ...nodeType,
    shape: style.shape,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    fontSize: style.fontSize,
    bold: style.bold,
  };
}

export function createNodeTypeFromStyle(
  name: string,
  style: EffectiveNodeStyle,
  node: MindmapNode,
): MindmapNodeType | null {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    icon: '✅',
    shape: style.shape,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    fontSize: style.fontSize,
    bold: style.bold,
    defaultText: node.text.trim() || '新节点',
    defaultRemark: node.remark,
  };
}
