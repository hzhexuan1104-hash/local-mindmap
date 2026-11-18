function run(context) {
  const file = context.inputFile;
  if (typeof file?.text !== 'string') throw new Error('请从「文件 → 导入」选择 UTF-8 JSON 文件。');

  let nodes;
  try {
    nodes = JSON.parse(file.text);
  } catch {
    throw new Error('文件不是有效的 JSON，请检查引号、逗号和括号。');
  }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('JSON 最外层必须是非空节点数组。');
  }

  return [
    { type: 'addChildNodes', parentId: context.selectedNode?.id ?? context.mindmap.rootNodeId, nodes },
    { type: 'showMessage', message: `已从 ${file.name} 导入 ${nodes.length} 个分支及其下级节点。` },
  ];
}
