# Local Mindmap 插件开发

## 1. 插件系统现状

Local Mindmap 保留 v1.7 纯本地声明式 JSON 插件，并在 v1.8 增加默认关闭的
实验性脚本插件。脚本仅在用户显式启用 runner 后通过 Web Worker 执行。

## 2. manifest 格式

插件入口是 `manifest.json` 或 `.lmplugin` JSON 文件。核心字段包括：

| 字段 | 说明 |
|---|---|
| `manifestVersion` | 当前仅支持 `1` |
| `pluginId` | 全局唯一标识 |
| `name` / `version` / `author` | 插件元数据 |
| `pluginType` | 插件类型 |
| `capabilities` | 声明的能力 |
| `enabled` | 初始启用状态 |
| `contributions` | 声明式贡献点 |

外部插件安装后的真实 manifest 位于
`plugins/installed/<pluginId>/manifest.json`。registry 仅保存安装和启用
元数据，运行时能力以 installed manifest 为准。

## 3. contributions 支持范围

- `menus`
- `exporters`
- `themes`
- `icons`
- `nodeTypes` / `nodeTypePacks`
- `templatePacks`
- `tools`

无效贡献点会显示 `invalidReason`，不会进入运行时菜单或能力列表。

## 4. menus contribution

```json
{
  "id": "sampleExportText",
  "label": "示例 TXT 导出",
  "location": "plugins",
  "command": "builtin.exportText",
  "when": "hasMindmap"
}
```

`location` 支持顶部菜单 `plugins`；脚本插件还可使用节点右键菜单
`node-context`。`when` 支持 `always`、
`hasMindmap`、`hasSelectedNode`。

## 5. command registry

command 必须来自宿主白名单。v1.7 已接入的通用入口包括
`builtin.openPluginManager`、`builtin.reloadPlugins`、
`builtin.openPluginDirectory` 和 `builtin.exportText`。声明 command
不等于执行任意程序；所有 handler 都由宿主内置。

## 6. 权限规划

权限采用显式声明和宿主校验。读取权限为 `mindmap:read`、`node:read`，
写入权限为 `mindmap:write`、`node:write`，实验权限为 `script`。未知权限会
显示 warning。插件不会直接获得网络、任意文件、进程或系统 API 访问权。

## 7. Plugin Context API 草案

未来受控上下文可能提供只读选择信息、当前文档摘要和受限能力请求。具体接口
将在 v1.8 设计中冻结。v1.7 不向外部插件暴露可执行 Context API。

## 8. Action Protocol 草案

未来插件返回结构化 action，宿主先校验再决定是否执行。当前类型草案包括：

- `addNode`
- `addChildNode`
- `updateNode`
- `deleteNode`
- `setNodeRemark`
- `showMessage`
- `exportData`（预留）
- `applyTemplate`（预留）

v1.7 只提供 TypeScript 类型和校验函数，不执行 action。

## 9. 安全限制

- 声明式插件不执行 JavaScript；脚本插件仅通过受限 Worker 执行。
- 不执行 Shell 或系统命令。
- 不加载 DLL。
- 不访问网络或远程市场。
- 不读取或写入任意文件。
- 仅由宿主写入受控的插件用户目录。

## 10. 示例插件

模板位于 `docs/examples/sample-json-plugin/`。桌面端也可在插件管理器的
“开发者模式”中创建到：

`plugins/dev/sample-json-plugin/`

## 11. 调试方法

1. 打开插件目录或插件开发目录。
2. 导入示例 `manifest.json`。
3. 点击“重新加载插件”重新读取磁盘 manifest。
4. 在插件详情检查 Schema errors、Schema warnings 和 `invalidReason`。
5. 在开发者模式查看最近插件日志。
## v1.8 脚本插件实验能力

脚本插件是实验功能，默认关闭。用户需要在插件管理器的开发者模式中显式启用“实验性脚本插件运行器”后，顶部“插件”菜单中的脚本插件才会执行。未启用时，点击脚本菜单只会提示“脚本插件运行器尚未启用。”，不会读取或执行脚本。

### Manifest

脚本插件使用 `pluginType: "script"`，并且必须声明 `entry`：

```json
{
  "manifestVersion": 1,
  "pluginId": "localmindmap.script.append-check",
  "name": "脚本插件：节点追加标记",
  "version": "1.0.0",
  "author": "Local Mindmap Dev",
  "description": "给当前选中节点标题追加标记。",
  "pluginType": "script",
  "capabilities": ["script", "mindmap:read", "mindmap:write"],
  "enabled": true,
  "entry": "main.js",
  "permissions": ["script", "mindmap:read", "mindmap:write", "node:read", "node:write"],
  "contributions": {
    "menus": [
      {
        "id": "appendCheckToSelectedNode",
        "label": "给当前节点追加 ✅",
        "location": "plugins",
        "command": "plugin.runScript",
        "when": "hasSelectedNode"
      }
    ]
  }
}
```

`entry` 只能是插件目录内的相对 `.js` 文件路径，不允许绝对路径、`.`、`..` 或空路径片段。`pluginType=script` 的菜单命令必须是 `plugin.runScript`。

### 安装

导入脚本插件时，选择插件目录内的 `manifest.json`。宿主会复制 `manifest.json` 和同目录下的 `entry` 文件到：

```text
plugins/installed/<pluginId>/
  manifest.json
  main.js
```

如果 `entry` 指向的文件不存在，导入失败，并提示脚本入口文件不存在。

### Context Snapshot

脚本收到的是 JSON 可序列化快照，不是 React state、DOM、Tauri API 或文件路径：

```json
{
  "mindmap": { "title": "中心主题", "nodeCount": 5 },
  "selectedNode": { "id": "node-1", "text": "节点标题", "remark": "备注" },
  "nodes": [
    { "id": "node-1", "text": "节点标题", "parentId": null, "remark": "备注" }
  ]
}
```

### 脚本入口

当前支持全局 `run(context)`，也支持简单的 `export async function run(context)` 形式：

```js
async function run(context) {
  const node = context.selectedNode;

  if (!node) {
    return [{ type: "showMessage", level: "warning", message: "请先选择一个节点。" }];
  }

  return [
    {
      type: "updateNode",
      nodeId: node.id,
      patch: { text: node.text + " ✅" }
    },
    { type: "showMessage", level: "info", message: "已更新当前节点。" }
  ];
}
```

### Action Protocol

本批只执行以下 actions：

- `showMessage`: `level` 支持 `info`、`warning`、`error`。
- `updateNode`: 只允许 `patch.text` 和 `patch.remark`。
- `setNodeRemark`: 修改指定节点备注。
- `addChildNode`: 给指定父节点新增子节点。

`addNode` 和 `deleteNode` 本批不执行，会返回明确的不支持错误。

Action 校验采用整批拒绝策略：任一 action 非法时，本批 actions 全部不执行。单次最多 20 个 actions；`text` 最大 500 字符；`remark` 最大 5000 字符；`nodeId` 和 `parentId` 必须存在。

### 安全边界与限制

脚本运行在 Web Worker 中，只接收 context JSON，只返回 actions JSON，并设置超时。宿主不会把内部函数、React state、DOM、Tauri API、用户数据目录绝对路径或文件路径传入脚本。

当前限制：

- 实验性能力，默认关闭。
- 不支持 Shell。
- 不支持 DLL。
- 不支持文件系统访问。
- 不支持网络访问或远程模块。
- 不支持 Tauri API。
- 当前不保证第三方脚本已经完全强隔离。

开发者模式提供“创建脚本插件示例”，会生成：

```text
plugins/dev/sample-script-plugin/
  manifest.json
  main.js
  README.md
```

## v1.8 第二批：脚本 API、权限和批量操作

### Runner 设置

脚本 runner 仍默认关闭。开关保存到 `config/plugin-settings.json`，重启后
保持；配置缺失、损坏或字段类型非法时回退为关闭。runner 未启用时，顶部和
右键脚本菜单都只显示提示，不读取或执行 `main.js`。

### 完整 Context Snapshot

```json
{
  "app": { "version": "1.8.0", "platform": "desktop" },
  "mindmap": {
    "title": "中心主题",
    "nodeCount": 5,
    "selectedNodeId": "node-1",
    "rootNodeId": "root"
  },
  "selectedNode": {
    "id": "node-1",
    "text": "节点标题",
    "remark": "备注",
    "parentId": "root",
    "childrenIds": ["node-2"],
    "type": "default"
  },
  "nodes": [
    {
      "id": "root",
      "text": "中心主题",
      "remark": "",
      "parentId": null,
      "childrenIds": ["node-1"],
      "type": "default"
    }
  ],
  "selection": { "nodeIds": ["node-1"] }
}
```

`nodes` 最多包含 1000 个节点，只提供上例必要字段。超过限制时
`mindmap.nodeCount` 仍是实际总数，并增加 `truncated: true` 与 `warning`。
快照是深拷贝的 JSON，不包含函数、DOM、Tauri API、文件路径、用户数据目录
或 React state 引用。

### 新增 Actions

- `updateNodes`：`updates` 单次最多 50 条；每条只允许修改 `text` /
  `remark`，所有 `nodeId` 必须存在，任一非法则整批拒绝。
- `addChildNodes`：给同一 `parentId` 一次新增最多 20 个子节点；只接受
  `text` / `remark`，不接受插件指定 ID、position、children 或内部字段。
- `appendNodeText` / `prependNodeText`：片段最多 100 字符，拼接后标题最多
  500 字符。
- `appendNodeRemark`：片段最多 1000 字符，拼接后备注最多 5000 字符。

原有 `showMessage`、`updateNode`、`setNodeRemark`、`addChildNode` 保持兼容。
单次脚本返回最多 20 个顶层 actions。`deleteNode` 明确拒绝并提示防止误删；
`applyTemplate` 仅保留类型并提示当前不支持；未知 action 一律拒绝。

批量新增示例：

```js
async function run(context) {
  if (!context.selectedNode) {
    return [{ type: "showMessage", level: "warning", message: "请先选择节点。" }];
  }
  return [{
    type: "addChildNodes",
    parentId: context.selectedNode.id,
    nodes: [
      { text: "插件生成子节点 1", remark: "由批量脚本插件生成" },
      { text: "插件生成子节点 2", remark: "由批量脚本插件生成" },
      { text: "插件生成子节点 3", remark: "由批量脚本插件生成" }
    ]
  }];
}
```

### 节点右键菜单

```json
{
  "id": "appendCheckFromContextMenu",
  "label": "脚本：给节点追加 ✅",
  "location": "node-context",
  "command": "plugin.runScript",
  "when": "hasSelectedNode"
}
```

`location=plugins` 继续进入顶部插件菜单，`location=node-context` 进入节点
右键菜单。只有 `enabled=true`、manifest 有效且 contribution 有效的项会显示。
点击右键项时，宿主把右键菜单保存的 `nodeId` 显式传入运行链路，所以
`context.selectedNode` 对应被右键点击的节点。未知 location 会标记
`invalidReason`；非 script 插件使用 `plugin.runScript` 会使 manifest 无效。

### 权限、信任与执行确认

权限分为读取（`mindmap:read`、`node:read`）、写入（`mindmap:write`、
`node:write`）、实验（`script`）和未知权限。未知权限显示 warning，但不阻止
安装；script 插件未声明 permissions 也显示 warning。

script 插件默认 `trusted=false`。声明写权限的未信任插件在运行前显示
“允许本次 / 取消”确认。详情页可选择“信任此插件”或“取消信任”；状态保存到
`plugins/plugin-registry.json`。覆盖安装保留 trusted，卸载随 registry 记录
一并清理。manifest 缺失或损坏时，即使 registry 中 trusted 为 true 也不运行。
脚本返回修改 action 却未声明 `node:write` 或 `mindmap:write` 时，整批按权限
校验失败拒绝执行。

### 撤销、重做、运行结果与日志

一次脚本运行的全部有效修改 actions 作为一个历史步骤。只有实际修改导图时
才压入 undo stack；纯 `showMessage`、Worker 失败、超时或 action 校验失败都
不产生历史步骤。Ctrl+Z 一次撤销整批，重做恢复整批结果。

详情页最近运行显示 `lastRunAt`、`lastRunStatus`、`durationMs`、
`actionCount`、`appliedActionCount` 和错误信息。日志增加：

- `script trust requested` / `granted` / `revoked`
- `script runner setting saved`
- `script context built`
- `script action batch validated`
- `script undo batch created`
- `script context menu invoked`

开发者模式中的“创建批量脚本插件示例”生成：

```text
plugins/dev/sample-batch-script-plugin/
  manifest.json
  main.js
  README.md
```

仓库内对应源码为 `docs/examples/sample-batch-script-plugin/`。

### 安全边界

脚本仍只在 Web Worker 中接收 JSON snapshot 并返回 actions；所有 actions
必须经宿主整批校验。继续不支持 Shell、DLL、Python、外部命令、远程插件
市场、任意文件系统访问、网络、DOM、Tauri API 或 React state。超时机制和
runner 默认关闭策略保持不变。
