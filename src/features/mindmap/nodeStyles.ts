import type {
  MindmapNode,
  MindmapNodeStyle,
  MindmapNodeType,
} from './types';

export type EffectiveNodeStyle = Required<Omit<MindmapNodeStyle, 'icon'>>;

export type NodeStyleCssVariables = {
  '--node-bg': string;
  '--node-border': string;
  '--node-text': string;
  '--node-font-size': string;
  '--node-font-weight': number;
};

export const DEFAULT_NODE_STYLE: EffectiveNodeStyle = {
  shape: 'rounded',
  backgroundColor: '#edf4f7',
  borderColor: '#8ab3ca',
  textColor: '#23333f',
  fontSize: 16,
  bold: false,
};

export const DEFAULT_ROOT_NODE_STYLE: EffectiveNodeStyle = {
  shape: 'rounded',
  backgroundColor: '#70a4c3',
  borderColor: '#6297b7',
  textColor: '#ffffff',
  fontSize: 17,
  bold: true,
};

export function getEffectiveNodeStyle(
  node: MindmapNode,
  nodeType?: MindmapNodeType | null,
  isRoot = false,
): EffectiveNodeStyle {
  const defaultStyle = isRoot ? DEFAULT_ROOT_NODE_STYLE : DEFAULT_NODE_STYLE;

  return {
    shape: node.style?.shape ?? nodeType?.shape ?? defaultStyle.shape,
    backgroundColor:
      node.style?.backgroundColor ??
      nodeType?.backgroundColor ??
      defaultStyle.backgroundColor,
    borderColor:
      node.style?.borderColor ??
      nodeType?.borderColor ??
      defaultStyle.borderColor,
    textColor:
      node.style?.textColor ??
      nodeType?.textColor ??
      defaultStyle.textColor,
    fontSize:
      node.style?.fontSize ?? nodeType?.fontSize ?? defaultStyle.fontSize,
    bold: node.style?.bold ?? nodeType?.bold ?? defaultStyle.bold,
  };
}

export function getEffectiveNodeIcon(
  node: MindmapNode,
  nodeType?: MindmapNodeType | null,
): string {
  return node.style?.icon ?? nodeType?.icon ?? '';
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
  icon = '✅',
): MindmapNodeType | null {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    icon,
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
