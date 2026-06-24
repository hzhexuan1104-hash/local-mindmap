export type MindmapNode = {
  id: string;
  text: string;
  remark: string;
  nodeTypeId?: string;
  collapsed?: boolean;
  children: MindmapNode[];
};

export type MindmapNodeType = {
  id: string;
  name: string;
  backgroundColor: string;
  borderColor: string;
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
