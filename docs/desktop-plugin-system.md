# 桌面插件与用户目录

更新日期：2026-06-27

适用版本：v1.6 第一批

## 当前定位

桌面端与 Web 端共享同一套声明式 JSON 插件模型。桌面端负责把 manifest 和 registry 写入 Tauri 用户数据目录；Web 端使用 localStorage fallback。

当前不加载 DLL，不执行 JavaScript、Shell、命令或其他插件代码，也不支持远程插件下载。

## 当前目录

```text
app data dir/
  plugins/
    plugin-registry.json
    installed/
      <pluginId>/
        manifest.json
```

用户数据根由 Tauri `app_data_dir` 按平台和应用标识解析。v1.6 identifier 为 `com.localmindmap.desktop`，Windows 根目录为 `%APPDATA%\com.localmindmap.desktop`。插件管理面板显示实际路径。

旧 identifier `com.localmindmap.app` 仅作为迁移来源保留：首次启动新版本时复制旧数据，不删除旧目录、不覆盖新目录已有文件。v1.6 发布后不得在没有新迁移方案的情况下再次修改 identifier。

## Tauri commands

- `get_user_data_dir`
- `ensure_user_data_dirs`
- `read_user_json`
- `write_user_json`
- `list_user_files`
- `install_plugin_to_user_dir`
- `uninstall_plugin_from_user_dir`
- `open_user_data_dir`

所有文件参数都是用户数据根下的相对路径。绝对路径、`.`、`..`、路径穿越和符号链接逃逸会被拒绝。

## v1.4 Native manifest 兼容说明

仓库仍保留 v1.4 的 `get_desktop_plugin_dir`、`list_desktop_plugins`、`install_desktop_plugin_manifest`、`set_desktop_plugin_enabled`、`uninstall_desktop_plugin` 命令和前端兼容模块，避免直接删除旧代码。

这些 legacy commands 不在 v1.6 插件管理 UI 中使用，也不会加载或执行 `entry` 指向的二进制文件。v1.6 新安装流程只接受声明式 manifest，并写入 `plugins/installed/`。

后续若决定彻底移除 legacy Native manifest 壳层，应单独做迁移和兼容评审；不得在没有签名、权限、隔离和回滚设计的情况下启用二进制执行。

## 安全边界

- 不使用 `eval` 或 `new Function`。
- 不动态 import 用户插件文件。
- 不加载 DLL。
- 不执行远程 URL 内容。
- handler 只允许 `builtin.` 命名空间。
- 插件不能获得任意路径读写能力。
- 非法 manifest 返回清晰错误，不影响应用启动。
