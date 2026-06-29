# 声明式插件开发规范

适用范围：v1.7 插件平台基础版（兼容 v1.6 manifest）

## 设计边界

插件是本地 `.json` 或 `.lmplugin` 数据包。应用只解析声明，不执行插件中的 JavaScript、DLL、Shell 或远程代码。插件贡献只能映射到应用内置白名单中的 `builtin.*` handler/command。

## Manifest 示例

```json
{
  "manifestVersion": 1,
  "pluginId": "localmindmap.export.txt.example",
  "name": "TXT 导出插件",
  "version": "1.0.0",
  "author": "Local Mindmap",
  "description": "提供 TXT 导出能力",
  "pluginType": "import-export",
  "capabilities": ["export"],
  "enabled": true,
  "contributions": {
    "exporters": [
      {
        "id": "exportText",
        "label": "TXT 导出",
        "fileName": "mindmap.txt",
        "handler": "builtin.exportText"
      }
    ],
    "menus": [
      {
        "id": "exportTextMenu",
        "label": "导出为 TXT",
        "location": "plugins",
        "command": "builtin.exportText",
        "when": "hasMindmap"
      }
    ]
  }
}
```

必填字段：

- `manifestVersion`：当前为正整数 `1`。
- `pluginId`：只允许字母、数字、点、下划线和短横线。
- `name`、`version`、`pluginType`。
- `capabilities`：字符串数组，可在插件管理中查看。

可选字段：

- `author`、`description`、`enabled`、`config`、`contributions`。
- `installedAt` 由安装流程写入当前时间，不建议插件包自行伪造。

## 插件类型

- `theme-pack`
- `icon-pack`
- `import-export`
- `node-type-pack`
- `template-pack`
- `tool`

`exporter` 仅作为旧 registry 的兼容读取别名；新导入插件必须使用 `import-export`。

支持的 `capabilities`：

- `themes`
- `icons`
- `export`
- `nodeTypes`
- `templates`
- `tools`

`contributions` 不是必填字段，因此 v1.6 插件无需修改即可继续使用。用于验证安装与持久化底座的最小合法示例见
[`docs/examples/persistence-test-plugin.json`](examples/persistence-test-plugin.json)。

## 贡献点

### exporters

每项包含 `id`、`label`、`handler`，可选 `fileName`。第一批只提供 `builtin.exportText`；其他 handler 即使使用 `builtin.` 前缀，也只有应用已实现时才能产生实际功能。

### menus

每项包含：

- `id`：菜单项 ID，必填。
- `label`：显示文本，必填。
- `location`：当前只支持 `plugins`。
- `command`：必须是应用 command registry 中的固定命令 ID。
- `when`：可选，支持 `always`、`hasMindmap`、`hasSelectedNode`，默认 `always`。

有效菜单按插件名称分组显示在顶部“插件”菜单。只有插件已启用、manifest 有效且 `when` 条件满足时才显示。无效菜单不会执行，但会在插件管理器中显示具体原因。

可手动导入的完整测试插件见
[`docs/examples/menu-contribution-test-plugin.json`](examples/menu-contribution-test-plugin.json)。

当前 command registry：

- 已实现：`builtin.openPluginManager`、`builtin.reloadPlugins`、`builtin.openPluginDirectory`、`builtin.exportText`
- 已预留并返回明确“暂未实现”错误：`builtin.exportJson`、`builtin.applyTheme`、`builtin.insertNodeType`、`builtin.applyTemplate`

### nodeTypePacks

数组中的每项沿用现有节点类型包结构：

```text
version + kind + meta + nodeTypes
```

`kind` 必须为 `local-mindmap-node-type-pack`。启用插件后节点类型进入候选列表，禁用或卸载后隐藏。导图中已使用的节点类型数据不会因此从 `.lmind` 删除。

### templatePacks

数组中的每项沿用现有模板包结构：

```text
version + kind + meta + templates
```

`kind` 必须为 `local-mindmap-template-pack`。启用插件后模板进入候选列表，禁用或卸载后隐藏。

主题、图标和旧版 `nodeTypes` 数据贡献仍可兼容读取；新插件优先使用上述 v1 结构。

## 安全校验

manifest 任意层级出现以下字段都会被拒绝：

```text
script
eval
function
remoteUrl
code
shell
executable
```

此外：

- exporter handler 必须以 `builtin.` 开头。
- `menus.command` 只允许 command registry 中的固定 ID；未知 ID 会被标记为无效。
- `capabilities` 不是数组时拒绝安装。
- `pluginId` 含路径分隔符或 `..` 时拒绝安装。
- 非法贡献内容会被跳过并提示；非法 manifest 不会导致页面崩溃。

## Schema 校验报告

校验统一返回：

```text
valid + errors + warnings + normalizedManifest
```

- `errors` 阻止安装，例如 JSON 语法错误、缺少必填字段、不支持的
  `manifestVersion` / `pluginType`、非法 capabilities、危险 handler。
- `warnings` 不阻止安装，例如缺少 author/description、老插件未声明 menus、
  capability 与 contribution 不一致、未知菜单 command、未知 exporter handler。
- 无效 contribution 会保留在插件详情中并显示 `valid=false` 与
  `invalidReason`，但不会进入顶部插件菜单或运行时 exporter 列表。
- 当前只支持 `manifestVersion: 1`。JSON 语法错误会报告附近的行号与列号。

## 覆盖安装

重复导入相同 `pluginId` 时，应用显示插件名称、当前版本和导入版本并请求确认。
确认覆盖后：

- 保留用户当前的 enabled 状态。
- 事务替换 `installed/<pluginId>/manifest.json`。
- 同步更新 `plugin-registry.json`、安装时间与详情 UI。
- 覆盖失败时恢复旧 manifest 和 registry，不留下半安装目录。

测试数据：

- [`overwrite-test-plugin-v1.json`](examples/overwrite-test-plugin-v1.json)
- [`overwrite-test-plugin-v2.json`](examples/overwrite-test-plugin-v2.json)
- [`invalid-command-test-plugin.json`](examples/invalid-command-test-plugin.json)
- [`legacy-v16-export-plugin.json`](examples/legacy-v16-export-plugin.json)

## 存储

桌面端：

```text
plugins/
  plugin-registry.json
  installed/
    <pluginId>/
      manifest.json
```

Web 端继续使用 localStorage fallback，并保留旧 Web JSON 插件数据。插件不会写入安装目录。

安装失败时，插件管理面板会保留最近一次具体错误，包括 JSON 解析、必填字段、类型或 capability 不受支持、非法字段、重复 ID，以及用户目录写入失败。外部插件的 `installedAt` 由应用在安装时写入当前时间。

重新加载插件时会重新读取 `plugins/plugin-registry.json` 和每个
`plugins/installed/<pluginId>/manifest.json`。registry 中存在但 manifest 缺失或损坏的插件仍在管理器中显示，但不贡献菜单或其他运行时能力。

插件管理器还会扫描 registry 之外的 installed 子目录：

- manifest 存在但 registry 缺失：显示“registry 记录缺失”，可修复记录。
- registry 存在但 manifest 缺失：显示“插件文件缺失”，可清理。
- manifest JSON 损坏：显示具体解析错误，可卸载或清理。
- 异常插件始终禁用运行时贡献，不会进入顶部插件菜单。

## 当前限制

- 无插件市场和远程下载。
- 无任意 JS、DLL、WASM 或脚本执行。
- 无网络权限、文件系统任意路径权限或当前导图任意读取 API。
- 不执行插件提供的任意代码；本批菜单只路由到应用内置安全 command。
