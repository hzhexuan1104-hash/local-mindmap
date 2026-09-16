export type MindmapNodeStyle = {
  /** `null` explicitly suppresses a node-type icon; omitted keeps type fallback. */
  icon?: string | null;
  shape?: MindmapNodeType['shape'];
  /** Optional override. Ordinary nodes default to left alignment; the root stays centered. */
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
};

export type MindmapNodeProgress = 0 | 25 | 50 | 75 | 100;
export type MindmapNodePriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type MindmapNode = {
  id: string;
  text: string;
  remark: string;
  /** Compact node metadata. `remark` remains the canonical note field. */
  priority?: MindmapNodePriority;
  progress?: MindmapNodeProgress;
  tags?: string[];
  nodeTypeId?: string;
  style?: MindmapNodeStyle;
  collapsed?: boolean;
  position?: {
    x: number;
    y: number;
  };
  children: MindmapNode[];
};

export type MindmapNodeType = {
  id: string;
  name: string;
  /** `null` is the single serialized representation for a type without an icon. */
  icon: string | null;
  shape: 'rounded' | 'rectangle' | 'pill' | 'diamond';
  /** Kept optional so existing .lmind files remain unchanged and compatible. */
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  defaultText: string;
  defaultRemark: string;
};

export type MindmapProject = {
  rootNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
  themeId: string;
};

export type LmindDocument = {
  version: string;
  meta: {
    createTime: string;
    updateTime: string;
    theme: string;
  };
  nodeTypes: MindmapNodeType[];
  rootNode: MindmapNode;
};
