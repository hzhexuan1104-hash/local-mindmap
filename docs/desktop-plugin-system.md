# 桌面 Native 插件系统

更新日期：2026-06-26

适用版本：v1.4.0

## 当前范围

v1.4 只实现桌面插件目录和 Native manifest 管理，不加载 DLL，不执行 DLL，不执行任何第三方代码。

Native 插件属于本机扩展能力。未来版本可能加载本地二进制文件。请只安装可信来源插件。

## 插件目录

优先使用 Tauri / Rust 推荐的应用数据目录，并在其下创建 `plugins` 子目录。目录不存在时自动创建。

- Windows：`%APPDATA%/Local Mindmap/plugins`
- macOS：`~/Library/Application Support/Local Mindmap/plugins`
- Linux：`~/.local/share/local-mindmap/plugins`

每个插件使用独立子目录：

```text
plugins/
  plugin-id/
    manifest.json
    plugin.dll
```

v1.4 只读取 `manifest.json`。`plugin.dll` 可以作为未来结构占位，但不会被复制、加载或执行。

## manifest.json 示例

```json
{
  "manifestVersion": 1,
  "pluginId": "my-native-plugin",
  "name": "Native 插件",
  "version": "1.0.0",
  "author": "作者",
  "description": "桌面端 Native 插件示例",
  "pluginType": "native",
  "platform": "windows",
  "arch": "x64",
  "entry": "my-native-plugin.dll",
  "capabilities": ["exportText"],
  "enabled": false,
  "abi": {
    "version": 1,
    "exports": {
      "info": "lm_plugin_info",
      "execute": "lm_plugin_execute",
      "free": "lm_plugin_free"
    }
  }
}
```

## 校验规则

- `manifestVersion` 必须存在且为正整数。
- `pluginId` 必填，只允许字母、数字、点、下划线和短横线。
- `name` 必填。
- `version` 必填。
- `pluginType` 必须为 `native`。
- `entry` 必填。
- `enabled` 缺省为 `false`。
- `capabilities` 必须来自白名单：`exportText`、`themePack`、`iconPack`、`nodeTypePack`、`toolPanel`。
- `abi` 只作为声明，不执行。
- 顶层禁止 `code`、`script`、`eval`、`function`、`remoteUrl` 字段。
- 非法 manifest 只进入错误列表，不导致应用崩溃。

## Tauri commands

- `get_desktop_plugin_dir`：返回当前桌面插件目录。
- `list_desktop_plugins`：扫描插件目录，返回合法插件列表和非法 manifest 错误列表。
- `install_desktop_plugin_manifest`：安装用户选择的 `manifest.json` 到 `plugins/plugin-id/manifest.json`。
- `set_desktop_plugin_enabled`：写入 `desktop-plugin-registry.json`，不直接改用户原始 manifest。
- `uninstall_desktop_plugin`：删除对应插件目录，并移除注册表状态。

## 与桌面配置目录的关系

v1.4 第二批新增桌面配置目录 `config`，但插件 manifest 仍保存在 `plugins` 目录。

```text
app data dir/
  config/
    app-settings.json   # 后续应用设置 registry 草案
  plugins/
    desktop-plugin-registry.json
    plugin-id/
      manifest.json
      plugin.dll        # v1.4 不复制、不加载、不执行
```

后续 `config/app-settings.json` 可以通过 `pluginRegistryPath` 引用 `../plugins/desktop-plugin-registry.json`，但 v1.4 仍以插件目录中的 registry 为实际启用状态来源。

## 安全边界

v1.4 明确禁止：

- 加载 DLL。
- 调用 DLL。
- 执行插件代码。
- 使用 `eval` 或 `new Function`。
- 动态 import 用户文件。
- 从远程 URL 安装插件。
- 插件读取当前导图数据。
- 插件访问任意本地目录。

## ABI 草案

当前 ABI 只作为 manifest 声明保存：

- `lm_plugin_info`：未来用于读取插件元信息。
- `lm_plugin_execute`：未来用于执行受控能力。
- `lm_plugin_free`：未来用于释放插件返回内存。

v1.5 之前不绑定 ABI、不加载符号、不调用任何 DLL 函数。
