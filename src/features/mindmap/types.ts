export type MindmapNode = {
  id: string;
  text: string;
  remark: string;
  children: MindmapNode[];
};

export type LmindDocument = {
  version: string;
  meta: {
    createTime: string;
    updateTime: string;
    theme: string;
  };
  rootNode: MindmapNode;
};
