# Local Mindmap 插件开发

## 1. 插件系统现状

Local Mindmap 保留 v1.7 纯本地声明式 JSON 插件，并在 v1.8 增加默认关闭的
实验性脚本插件。脚本仅在用户显式启用 runner 后通过 Web Worker 执行。

## 2. manifest 格式

插件入口是单独的 `manifest.json`，也可以是以 ZIP 为容器的 `.lmplugin`
插件包。`.lmplugin` 不是 JSON 文件；其根目录必须包含 `manifest.json`。

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

## JSON Action 插件 / 工作流插件

`pluginType: "action-workflow"` 允许开发者直接在 manifest 中声明一组
`workflow.actions`。宿主只读取 JSON、解析变量并执行 Action Protocol，
不会加载或执行 JavaScript。

### Manifest 与 workflow.actions

```json
{
  "manifestVersion": 1,
  "pluginId": "localmindmap.workflow.meeting-outline",
  "name": "会议纪要结构生成器",
  "version": "1.0.0",
  "pluginType": "action-workflow",
  "capabilities": ["workflow", "mindmap:read", "mindmap:write"],
  "permissions": ["mindmap:read", "mindmap:write", "node:read", "node:write"],
  "contributions": {
    "menus": [
      {
        "id": "createMeetingOutline",
        "label": "生成会议纪要结构",
        "location": "plugins",
        "command": "plugin.runWorkflow",
        "when": "hasSelectedNode"
      },
      {
        "id": "createMeetingOutlineFromContext",
        "label": "工作流：生成会议纪要结构",
        "location": "node-context",
        "command": "plugin.runWorkflow",
        "when": "hasSelectedNode"
      }
    ]
  },
  "workflow": {
    "name": "会议纪要结构",
    "description": "给当前节点生成会议纪要子节点。",
    "actions": [
      {
        "type": "addChildNodes",
        "parentId": "$selectedNode.id",
        "nodes": [
          { "text": "会议背景", "remark": "" },
          { "text": "关键议题", "remark": "" },
          { "text": "讨论结论", "remark": "" },
          { "text": "行动项", "remark": "生成时间：$date.now" }
        ]
      }
    ]
  }
}
```

`workflow` 必须是对象，`workflow.actions` 必须包含 1–20 个 action。
action-workflow 的菜单命令只能是 `plugin.runWorkflow`；script 插件仍只能
使用 `plugin.runScript`。workflow 不能声明 `entry`、`runtime`、
`commandLine`、`script` 或 `code` 等执行代码字段。

安装期会检查 workflow 结构，并对缺失权限、写入 action 和当前不支持的 action
给出诊断。节点是否存在、长度限制和最终 action 合法性在每次执行时使用当前
导图重新校验。

### 变量占位符

本批支持：

- `$selectedNode.id`
- `$selectedNode.text`
- `$selectedNode.remark`
- `$mindmap.title`
- `$date.today`（本地日期，`YYYY-MM-DD`）
- `$date.now`（ISO 时间）

`parentId` 和 `nodeId` 可直接使用 `$selectedNode.id`，`text`、`remark` 和
`message` 可在普通字符串中嵌入变量。未知变量会使整批执行失败；没有选中节点
却引用 `$selectedNode.*` 也会失败。工作流不支持复杂表达式、`eval` 或
JavaScript `${...}` 模板表达式。

节点右键菜单触发时，宿主使用右键菜单保存的 node ID 构建 context，因此变量
绑定被右键点击的节点，而不是依赖异步 UI selection state。

### Actions、权限与历史

工作流与脚本插件复用同一套 Action Protocol，支持：

- `showMessage`
- `updateNode` / `updateNodes`
- `setNodeRemark`
- `addChildNode` / `addChildNodes`
- `appendNodeText` / `prependNodeText`
- `appendNodeRemark`

`deleteNode`、`applyTemplate`、`addNode` 和未知 action 明确拒绝。变量解析后，
所有 actions 整批校验；任一失败则完全不执行。

action-workflow 默认 `trusted=false`。含写入 action 的未信任工作流运行时先
允许用户取消或继续；继续后可选择“信任此插件”或“仅允许本次”。trusted 状态
与脚本插件一样保存在 `plugins/plugin-registry.json`，覆盖安装保留，卸载清理，
详情页可取消信任。只包含 `showMessage` 的只读工作流不显示写权限确认。

工作流声明写入 action 却没有 `mindmap:write` 或 `node:write` 时，安装显示
warning，执行时权限校验拒绝修改。manifest 缺失或损坏时，即使 trusted=true
也不会运行。

一次成功运行产生的全部修改 actions 只压入一个 undo 快照；Ctrl+Z 一次撤销
整批，Ctrl+Y 一次恢复。纯 `showMessage`、变量失败、action 校验失败和权限失败
都不产生历史步骤。

### 示例、菜单与日志

开发者模式中的“创建 JSON Action 工作流示例”生成：

```text
plugins/dev/sample-json-workflow-plugin/
  manifest.json
  README.md
```

仓库示例位于 `docs/examples/sample-json-workflow-plugin/`。导入 manifest 后，
可从顶部插件菜单或节点右键菜单运行会议纪要结构生成器。

详情页显示 workflow 名称、描述、action 数量、action 类型、完整 action 明细、
是否包含写操作、trusted 和最近运行结果。日志记录 workflow 导入、执行开始、
变量解析、batch 校验、action 应用、undo batch、成功/失败、trust 和右键调用，
并可携带 `menuId`、`actionCount`、`durationMs`。

### 安全边界

JSON Action 工作流不执行 JS、Shell、DLL、Python 或外部命令，不访问文件系统、
网络、DOM、Tauri API 或 React state。它只能执行宿主解析并校验通过的结构化
actions；v1.7 声明式插件和 v1.8 script 插件沿用各自既有执行边界。

## v1.9 Python / 外部命令插件（实验）

### Manifest

外部命令插件使用 `pluginType: "external-command"`，`runtime` 必须是
`python` 或 `executable`，菜单命令必须是 `plugin.runExternal`。

```json
{
  "manifestVersion": 1,
  "pluginId": "localmindmap.external.python.demo",
  "name": "Python demo",
  "version": "1.0.0",
  "author": "Developer",
  "description": "Reads context and returns actions.",
  "pluginType": "external-command",
  "runtime": "python",
  "entry": "main.py",
  "capabilities": ["external-command", "mindmap:read", "mindmap:write"],
  "enabled": true,
  "permissions": [
    "external-command",
    "mindmap:read",
    "mindmap:write",
    "node:read",
    "node:write"
  ],
  "contributions": {
    "menus": [{
      "id": "run",
      "label": "运行 Python 插件",
      "location": "plugins",
      "command": "plugin.runExternal",
      "when": "hasSelectedNode"
    }]
  }
}
```

`entry` 必须是插件目录内的普通相对路径，不允许绝对路径、`.`、`..`、空路径
段或远程 URL。Python entry 必须以 `.py` 结尾；Windows executable entry
必须以 `.exe` 结尾，DLL 永远拒绝。`commandLine`、`args`、`shell`、`script`
和 `code` 字段属于 schema error。script、action-workflow 和 external-command
三种类型不能交叉使用彼此的运行命令。缺少 `external-command` permission 会
产生 warning。

导入时选择 `manifest.json`。宿主检查 entry 与 manifest 位于同一目录或其子目录，
然后以事务方式复制到：

```text
plugins/installed/<pluginId>/
  manifest.json
  main.py
```

entry 缺失或复制失败会终止导入并回滚。覆盖安装保留 registry 中的 enabled 和
trusted；运行时重新读取并校验 installed manifest，而不是信任导入时的内存对象。

### 启动与 Python 配置

开发者模式中的“启用外部命令插件运行器”默认关闭，状态保存到
`config/plugin-settings.json`。配置缺失或损坏时按关闭处理；runner 关闭时插件
仍可导入和显示菜单，但 Rust 层会在创建进程前再次拒绝执行。

Python 路径默认是 PATH 中的 `python`。也可保存 `python`、`python3`、
`python.exe` 或一个可执行文件绝对路径。“测试 Python”固定执行
`<python> --version`。应用不会搜索下载 Python，也不会安装依赖。

运行命令固定为：

```text
python <installed-entry>
```

或直接启动 installed executable entry。实现使用进程 API 和参数数组，不使用
Shell，不解析插件提供的命令行，也不接受自定义参数。

启动 Python 插件时，宿主只对该 Python 子进程设置：

```text
PYTHONIOENCODING=utf-8
PYTHONUTF8=1
```

这两个变量不会注入 `runtime=executable` 进程。Windows 下仍建议 Python
插件显式执行以下兼容设置，以兼容不同 Python 发行版和宿主终端配置：

```python
try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
```

### stdin context 协议

宿主将 context 明确序列化为 UTF-8 JSON 字节并写入 stdin，然后关闭 stdin。context 复用 v1.8
snapshot，新增显式 `contextVersion: 1`：

```json
{
  "contextVersion": 1,
  "app": { "version": "1.9.1", "platform": "desktop" },
  "mindmap": {
    "title": "中心主题",
    "nodeCount": 10,
    "selectedNodeId": "node-1",
    "rootNodeId": "root"
  },
  "selectedNode": {
    "id": "node-1",
    "text": "节点标题",
    "remark": "",
    "parentId": "root",
    "childrenIds": [],
    "type": "default"
  },
  "nodes": [],
  "selection": { "nodeIds": ["node-1"] }
}
```

context 不含函数、DOM、Tauri API、access token、文件路径、用户数据目录或插件
安装目录。`nodes` 最多 1000 个；超限时附加 `truncated: true` 和 `warning`。
node-context 菜单运行时，`selectedNode` 和 selection 绑定用户右键点击的节点。

### stdout actions 协议

stdout 必须是合法 UTF-8，且只包含一个 JSON 对象：

```json
{
  "actions": [
    {
      "type": "showMessage",
      "level": "info",
      "message": "完成"
    }
  ]
}
```

v1.9 不接受顶层 actions 数组。stdout 按 UTF-8 严格解码；非 UTF-8、非 JSON、
不是对象、缺少 actions 数组或超过 1MB 时整次失败，不执行任何 action，也不
产生 undo。actions 使用与 v1.8
相同的 Action Protocol 整批校验和权限校验；未知 action、`deleteNode` 和超限
批次会整批拒绝。

stderr 同样优先按 UTF-8 解码，不参与 JSON 解析，也不因非空而单独判失败；
解码失败时使用安全替换预览并标记“stderr 非合法 UTF-8”。stderr 最多保留
64KB，并写入插件日志和最近运行预览。exitCode 非 0 时，即使 stdout 合法也
不会执行 actions。进程默认 5000ms 超时，超时或 stdout 超限会 kill 并等待退出。

只有实际修改导图的成功 actions 才压入一次 undo batch。多个 `addChildNodes`
修改可用一次 Ctrl+Z 撤销、一次 Ctrl+Y 恢复；纯 `showMessage`、进程失败、
JSON/action 校验失败均不产生历史记录。

### 信任、详情与日志

external-command 插件默认 `trusted=false`。未信任且声明写权限的插件首次运行时
可选择取消、仅允许本次或信任此插件。trusted 保存到 registry，覆盖安装保留，
详情页可取消信任；manifest 损坏、插件禁用或 runner 关闭时，trusted=true 也
不能绕过校验。

详情页显示 runtime、entry、permissions、trusted、runner 状态、Python path，
以及最近一次运行的时间、状态、durationMs、exitCode、stdoutSize、stderr
preview、actionCount、appliedActionCount 和 error。日志覆盖 runner 开关、
Python 保存/测试、进程开始、stdin/stdout/stderr、退出/超时、action 校验和
应用、undo batch、成功/失败、trust 与 node-context 调用。

开发者模式中的“创建 Python 插件示例”生成：

```text
plugins/dev/sample-python-plugin/
  manifest.json
  main.py
  README.md
```

仓库副本位于 `docs/examples/sample-python-plugin/`。exe sidecar 应从 stdin
读取 context，只向 stdout 输出协议 JSON，并将诊断信息写到 stderr；不依赖
命令行参数。

### 安全边界

Local Mindmap 不提供 Shell、DLL、远程 URL、远程插件市场、网络 API、依赖下载
或自动安装 Python，也不向插件 context 暴露文件系统路径。外部程序仍是操作系统
进程，宿主无法把它等同于 Web Worker 沙箱：它可能凭当前用户的系统权限访问文件
或网络。因此此功能默认关闭并标记为高风险实验能力，只应运行用户信任的本地程序。
无论外部程序做什么，Local Mindmap 仅接受 stdout 中通过 Action Protocol 校验的
actions 来修改当前内存中的导图；插件不能要求宿主直接写 `.lmind` 文件。

## v1.9.1 `.lmplugin` 打包与 executable 插件

### 插件包格式

`.lmplugin` 是普通 ZIP 文件，推荐结构如下：

```text
sample-python-plugin.lmplugin
  manifest.json
  main.py
  README.md
```

```text
sample-exe-plugin.lmplugin
  manifest.json
  keyword-plugin.exe
  README.md
```

`manifest.json` 必须位于压缩包根目录并通过 manifest schema 校验。`entry`
必须是插件包内的相对路径；不允许绝对路径、盘符、URL、反斜杠、`.`、`..`
或空路径片段，且对应文件必须真实存在。安装器在写盘前检查压缩包内的每个路径，
拒绝 ZIP Slip、重复路径、过量文件和异常解压体积。所有文件只会解压到
`plugins/installed/<pluginId>/` 的临时目录，完整成功后才原子提交；失败会删除
临时目录，覆盖失败会恢复旧版本。

覆盖安装保留 registry 中的 `enabled`、`trusted` 和首次安装时间。新安装的
script、action-workflow、Python 或 executable 插件一律从 `trusted=false`
开始。运行时仍重新读取 installed manifest，registry 只保存生命周期状态。

### 打包与导出

Python 插件至少把以下文件放在 ZIP 根目录，然后把扩展名改为 `.lmplugin`：

```text
manifest.json
main.py
README.md          # 可选
```

executable 插件的打包方式相同，只需把 `entry` 改为实际可执行文件：

```text
manifest.json
keyword-plugin.exe
README.md          # 可选
```

也可在插件详情点击“导出插件包”。宿主导出的包只包含：

- 根目录 `manifest.json`
- manifest 声明的 `entry` 文件（如有）
- 根目录 `README.md`（如已安装且存在）

包中不包含 `plugins/plugin-registry.json`、`trusted`、安装时间、诊断字段或用户
隐私配置。内置插件没有独立安装目录，因此不可导出。导出完成后详情页提供完整
路径、复制路径和打开所在目录入口。

### executable manifest 示例

```json
{
  "manifestVersion": 1,
  "pluginId": "localmindmap.external.exe.echo-demo",
  "name": "示例 EXE 外部程序插件",
  "version": "1.0.0",
  "author": "Local Mindmap Dev",
  "description": "通过本地 exe 读取 stdin context 并输出 actions JSON。",
  "pluginType": "external-command",
  "runtime": "executable",
  "entry": "keyword-plugin.exe",
  "capabilities": ["external-command", "mindmap:read", "mindmap:write"],
  "enabled": true,
  "permissions": [
    "mindmap:read",
    "mindmap:write",
    "node:read",
    "node:write",
    "external-command"
  ],
  "contributions": {
    "menus": [{
      "id": "runExeKeywordDemo",
      "label": "EXE：生成关键词子节点",
      "location": "plugins",
      "command": "plugin.runExternal",
      "when": "hasSelectedNode"
    }]
  }
}
```

Windows 下 `runtime=executable` 的 entry 只允许 `.exe`。宿主直接启动 installed
entry，不使用 Shell，不传入插件自定义参数。程序从 stdin 读取一个 UTF-8
context JSON，并向 stdout 写出且只写出一个 UTF-8 JSON 对象：

```json
{
  "actions": [
    { "type": "showMessage", "level": "info", "message": "完成" }
  ]
}
```

调试信息必须写入 stderr；stderr 不参与协议解析。stdout 非 UTF-8、JSON 无效、
exit code 非 0 或执行超时都会使本次运行失败，超时进程会被 kill。成功返回的
actions 仍由宿主执行与 v1.8/v1.9 相同的整批 schema、权限和节点校验，并继续
使用单个 undo/redo batch。

完整示例说明位于 `docs/examples/sample-exe-plugin/`。仓库不附带预编译 EXE；
开发者应使用自己的本地工具链生成 `keyword-plugin.exe` 后再打包。

### 明确不支持

- Shell、批处理命令或插件自定义命令行参数
- DLL
- 远程 URL、远程插件市场或联网下载
- 自动安装 Python、运行时或第三方依赖

v1.9.1 不改变 v1.9 的 stdin/stdout 协议，也不改变 Python、script、
action-workflow 和 v1.7 声明式插件的运行方式。
