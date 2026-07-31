export type MindmapNodeStyle = {
  icon?: string;
  shape?: MindmapNodeType['shape'];
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
  icon: string;
  shape: 'rounded' | 'rectangle' | 'pill' | 'diamond';
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
