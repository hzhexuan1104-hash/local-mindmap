async function run(context) {
  const node = context.selectedNode;

  if (!node) {
    return [
      {
        type: "showMessage",
        level: "warning",
        message: "请先选择一个节点。"
      }
    ];
  }

  return [
    {
      type: "addChildNodes",
      parentId: node.id,
      nodes: [
        { "text": "插件生成子节点 1", "remark": "由批量脚本插件生成" },
        { "text": "插件生成子节点 2", "remark": "由批量脚本插件生成" },
        { "text": "插件生成子节点 3", "remark": "由批量脚本插件生成" }
      ]
    },
    {
      type: "showMessage",
      level: "info",
      message: "已生成 3 个子节点。"
    }
  ];
}
