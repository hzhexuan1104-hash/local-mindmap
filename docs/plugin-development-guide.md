# 声明式插件开发规范

适用范围：v1.6 第一批

## 设计边界

插件是本地 `.json` 或 `.lmplugin` 数据包。应用只解析声明，不执行插件中的 JavaScript、DLL、Shell、命令或远程代码。插件贡献只能映射到应用内置 `builtin.` handler。

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

`contributions` 在 v1.6 第一批不是必填字段。用于验证安装与持久化底座的最小合法示例见
[`docs/examples/persistence-test-plugin.json`](examples/persistence-test-plugin.json)。

## 贡献点

### exporters

每项包含 `id`、`label`、`handler`，可选 `fileName`。第一批只提供 `builtin.exportText`；其他 handler 即使使用 `builtin.` 前缀，也只有应用已实现时才能产生实际功能。

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
command
shell
executable
```

此外：

- exporter handler 必须以 `builtin.` 开头。
- `capabilities` 不是数组时拒绝安装。
- `pluginId` 含路径分隔符或 `..` 时拒绝安装。
- 非法贡献内容会被跳过并提示；非法 manifest 不会导致页面崩溃。

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

## 当前限制

- 无插件市场和远程下载。
- 无任意 JS、DLL、WASM 或脚本执行。
- 无网络权限、文件系统任意路径权限或当前导图任意读取 API。
- exporter 菜单尚未完全数据驱动；第一批仅接入内置 TXT handler。
