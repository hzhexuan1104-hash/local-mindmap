# 桌面端本地配置设计

更新日期：2026-06-26

## 目标

v1.4 第二批只建立桌面端本地配置目录和 registry 设计，不大规模迁移现有 `localStorage` 数据。Web / GitHub Pages 继续使用现有浏览器本地存储逻辑，Tauri 桌面端后续逐步迁移到应用数据目录中的 JSON 配置文件。

本批不修改 `.lmind` 基础结构，不加载 DLL，不执行 DLL，不执行第三方代码。

## 配置目录

桌面端配置目录使用 Tauri / Rust 推荐的 app data dir，并在其下创建 `config` 子目录：

```text
Windows: %APPDATA%/Local Mindmap/config
macOS: ~/Library/Application Support/Local Mindmap/config
Linux: ~/.local/share/local-mindmap/config
```

插件目录继续保持在同一 app data dir 下的 `plugins`：

```text
Windows: %APPDATA%/Local Mindmap/plugins
macOS: ~/Library/Application Support/Local Mindmap/plugins
Linux: ~/.local/share/local-mindmap/plugins
```

代码中不硬编码绝对路径。Tauri command 通过 `app.path().app_data_dir()` 解析实际目录。

## Tauri Commands

v1.4 第二批新增最小目录能力：

- `get_desktop_config_dir`：返回桌面端配置目录路径，不强制写入配置文件。
- `ensure_desktop_config_dir`：确保桌面端配置目录存在，并返回目录路径。

本批不强制实现完整设置读写，不接管现有前端状态。

## app-settings.json 草案

后续桌面端可在 `config/app-settings.json` 保存应用级设置：

```json
{
  "version": 1,
  "lastOpenedFile": null,
  "themeId": "default-blue",
  "recentFiles": [],
  "defaultExportDir": null,
  "pluginRegistryPath": "../plugins/desktop-plugin-registry.json"
}
```

字段说明：

- `version`：配置 registry 版本，便于后续迁移。
- `lastOpenedFile`：最后打开的 `.lmind` 文件路径，默认 `null`。
- `themeId`：默认主题偏好，初始为 `default-blue`。
- `recentFiles`：最近打开文件列表，初始为空数组。
- `defaultExportDir`：默认导出目录，初始为 `null`。
- `pluginRegistryPath`：桌面插件启用状态 registry 的相对路径声明。

## localStorage 迁移路线

本批只形成迁移路线，不一次性迁移所有数据。

### 高优先级

- 桌面插件 registry：桌面端已使用 `plugins/desktop-plugin-registry.json`，后续可在 `app-settings.json` 中引用。
- 自定义节点类型：当前位于 `localStorage`，后续迁移到 `config/node-types.json` 或应用设置 registry。
- 自定义模板：当前位于 `localStorage`，后续迁移到 `config/templates.json` 或独立模板目录。
- 最近打开文件：后续写入 `config/app-settings.json` 的 `recentFiles`。
- 主题偏好：后续写入 `config/app-settings.json` 的 `themeId`。

### 中优先级

- Web JSON 插件启用状态：Web 保留 `localStorage`，桌面端后续可迁移到本地配置文件。
- 导入导出偏好：例如 Excel 列映射、默认导出格式、默认导出目录。
- 面板展开 / 折叠状态：只迁移对桌面体验有明显价值的部分。
- 性能测试配置：可保留为本地开发或诊断配置。

### 暂不迁移

- Web 演示专用状态。
- 临时 UI 状态。
- 不影响公司内网推广的缓存。
- 剪贴板、框选、高亮、拖拽目标等一次性交互状态。

## 迁移原则

1. Web / GitHub Pages 不依赖 Tauri API，不因桌面配置目录缺失而崩溃。
2. 桌面端优先使用 app data dir 下的本地 JSON 配置。
3. 每类配置迁移前先补导入、导出和兼容测试。
4. `.lmind` 继续保持可迁移的导图文件格式，不把机器私有路径写入基础结构。
5. Native 插件配置只管理 manifest 和启用状态；v1.4 不加载或执行 DLL。
