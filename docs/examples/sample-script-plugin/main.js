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
      type: "updateNode",
      nodeId: node.id,
      patch: {
        text: node.text + " ✅"
      }
    },
    {
      type: "showMessage",
      level: "info",
      message: "已更新当前节点。"
    }
  ];
}
