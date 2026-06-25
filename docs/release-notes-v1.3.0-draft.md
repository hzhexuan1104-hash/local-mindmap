# v1.3.0 Draft Release Notes

## 节点类型共享基础版

- 新增节点类型包导出：在“节点类型”面板可将当前本地自定义节点类型导出为 `local-mindmap-node-types.json`。
- 新增节点类型包导入：可导入符合格式的 JSON 节点类型包，并持久化到 localStorage 本地节点类型库。
- 导入后节点类型可立即用于新建节点和切换已有节点类型。
- 节点类型包只用于分享自定义节点类型配置，不包含导图节点树，不包含 `rootNode`，不保存用户导图内容。
- `.lmind` 文件结构保持不变，仍可携带当前导图使用的 `nodeTypes`，保存 / 打开继续使用原有逻辑。

## 节点类型包格式

```json
{
  "version": "1.0",
  "kind": "local-mindmap-node-type-pack",
  "meta": {
    "name": "节点类型包名称",
    "description": "节点类型包说明",
    "createdAt": "ISO 时间",
    "source": "local-mindmap"
  },
  "nodeTypes": []
}
```

## 冲突处理

- ID 相同且内容相同：跳过。
- ID 相同但内容不同：自动生成 `原ID-imported-N`。
- name 相同但 ID 不同：允许导入，并在导入结果中提示同名数量。
- 缺少必要字段的节点类型：跳过，并计入无效条目数量。

## 不包含内容

- 不包含云同步。
- 不包含用户登录。
- 不包含远程节点类型市场。
- 不包含权限系统。
- 不执行第三方 JavaScript。
- 不改变 `.lmind` 基础结构。

## 模板包导入 / 导出基础版

- 新增模板包导出：在“模板库”面板可将当前本地自定义模板导出为 `local-mindmap-templates.json`。
- 新增模板包导入：可导入符合格式的 JSON 模板包，并持久化到 localStorage 本地模板库。
- 导入后模板可立即用于从模板库新建导图。
- 模板包用于分享自定义模板库，不等同于 `.lmind` 文件，也不用于分享当前打开的完整导图文件。
- 模板包保留模板已有的 `rootNode`、`nodeTypes`、`themeId` 等字段，以便模板新建导图时恢复结构、节点类型和主题。
- 节点类型包和模板包是两个独立共享能力：节点类型包分享自定义节点类型，模板包分享自定义模板。

## 模板包格式

```json
{
  "version": "1.0",
  "kind": "local-mindmap-template-pack",
  "meta": {
    "name": "模板包名称",
    "description": "模板包说明",
    "createdAt": "ISO 时间",
    "source": "local-mindmap"
  },
  "templates": []
}
```

## 模板包冲突处理

- ID 相同且内容相同：跳过。
- ID 相同但内容不同：自动生成 `原ID-imported-N`。
- name 相同但 ID 不同：允许导入，并在导入结果中提示同名数量。
- 缺少必要字段的模板：跳过，并计入无效条目数量。

## 模板包不包含内容

- 不包含云同步。
- 不包含用户登录。
- 不包含远程模板市场。
- 不包含权限系统。
- 不执行第三方 JavaScript。
- 不改变 `.lmind` 基础结构。
