export type MindmapNode = {
  id: string;
  text: string;
  remark: string;
  nodeTypeId?: string;
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
