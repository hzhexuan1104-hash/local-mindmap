# 示例脚本插件

这是 Local Mindmap 的实验性脚本插件示例。

## 使用方式

1. 在插件管理器的开发者模式中点击“创建脚本插件示例”。
2. 导入 `plugins/dev/sample-script-plugin/manifest.json`。
3. 在开发者模式中启用“实验性脚本插件运行器”。
4. 选择一个节点。
5. 从顶部“插件”菜单运行“给当前节点追加 ✅”。

## Context Snapshot

脚本收到的是 JSON 快照，不是应用内部状态引用：

```json
{
  "mindmap": { "title": "中心主题", "nodeCount": 5 },
  "selectedNode": { "id": "node-1", "text": "节点标题", "remark": "" },
  "nodes": [
    { "id": "node-1", "text": "节点标题", "parentId": null, "remark": "" }
  ]
}
```

## Actions

脚本只能返回 actions 数组，由宿主校验后执行：

```js
async function run(context) {
  return [
    {
      type: "updateNode",
      nodeId: context.selectedNode.id,
      patch: { text: context.selectedNode.text + " ✅" }
    }
  ];
}
```

当前支持 `showMessage`、`updateNode`、`setNodeRemark`、`addChildNode`。

## 安全限制

脚本运行器默认关闭，需要开发者显式启用。当前不支持 Shell、DLL、文件系统、网络、远程模块和 Tauri API。脚本插件是实验能力，不保证第三方脚本已经完全强隔离。
