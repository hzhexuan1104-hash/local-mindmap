# 示例 JSON 插件

这是 Local Mindmap v1.7 的声明式插件模板。

## 导入

1. 打开“插件管理”。
2. 点击“导入本地插件”。
3. 选择本目录中的 `manifest.json`。
4. 导入后可在顶部“插件”菜单找到“示例 TXT 导出”。

## manifest 字段

- `manifestVersion`：当前固定为 `1`。
- `pluginId`：插件唯一标识，仅使用字母、数字、点、下划线和短横线。
- `pluginType`：插件类型。
- `capabilities`：声明式能力列表。
- `contributions`：菜单、导出项等贡献点。

## menus contribution

`contributions.menus` 声明顶部插件菜单项。`location` 当前为
`plugins`，`when` 可使用 `always`、`hasMindmap` 或
`hasSelectedNode`。

`command` 只能使用 Local Mindmap 内置白名单命令。本示例使用
`builtin.exportText`。

## 安全边界

当前版本不会执行插件内的 JavaScript、命令、Shell、DLL 或远程代码，
也不会下载在线插件。

后续版本计划提供受控 Plugin Context API 和 Action Protocol。插件将返回
结构化 action，由宿主校验后决定是否执行，而不是直接获得应用或系统权限。
