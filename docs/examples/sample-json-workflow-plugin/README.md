# JSON Action 工作流示例

JSON Action 插件使用 manifest 的 `workflow.actions` 描述一组安全操作，不执行
JavaScript、Shell、DLL、Python 或外部命令。

本示例通过 `$selectedNode.id` 将四个会议纪要节点添加到当前节点，并在备注中
演示 `$selectedNode.text` 和 `$date.now`。导入本目录的 `manifest.json` 后，
可从顶部“插件”菜单或节点右键菜单运行。

工作流声明写权限且默认不受信任，首次运行时可取消、仅允许本次，或信任插件。
受信任状态保存在插件 registry 中，可在插件详情取消信任。

当前支持：

- `showMessage`
- `updateNode` / `updateNodes`
- `setNodeRemark`
- `addChildNode` / `addChildNodes`
- `appendNodeText` / `prependNodeText`
- `appendNodeRemark`

当前明确拒绝 `deleteNode`、`applyTemplate`、`addNode` 和未知 action。所有 actions
都会先解析变量，再由宿主整批校验；任一失败则不修改导图，也不产生 undo 记录。
