# v1.6.0 Release Notes（草案）

日期：2026-06-27

状态：第一批功能完成，尚未发布；项目版本仍保持 `1.5.0`。

## 第一批：用户目录分离与插件体系

- 安装目录只保存程序本体；桌面用户资产改存 Tauri `app_data_dir`。
- Tauri identifier 在发布前固定为 `com.localmindmap.desktop`；Windows 用户目录为 `%APPDATA%\com.localmindmap.desktop`。
- 首次启动会从旧 identifier 目录 `com.localmindmap.app` 复制已有用户数据，不删除源目录、不覆盖新目录已有文件。
- 新增统一用户数据存储层，桌面端调用 Tauri commands，Web 端继续使用 localStorage fallback。
- 自定义节点类型、节点类型包、自定义模板、模板包、插件 registry、插件 manifest 和配置进入用户目录。
- 新增目录初始化、安全 JSON 读写、文件列举、插件安装 / 卸载和打开用户目录命令。
- 所有命令限制在用户数据根目录内，拒绝绝对路径、`.`、`..`、路径穿越和符号链接逃逸。
- 首次桌面启动会备份旧 localStorage 数据后再迁移；迁移成功写 flag，不删除旧数据。
- 插件管理支持 `.json` / `.lmplugin` 导入、严格 manifest 校验、搜索、类型筛选、权限展示、启用、禁用、卸载和重复 ID 确认。
- 插件类型统一为 `theme-pack`、`icon-pack`、`import-export`、`node-type-pack`、`template-pack`、`tool`；旧 `exporter` 仅兼容读取。
- 插件导入失败会展示并保留具体原因；新增可直接导入的 `docs/examples/persistence-test-plugin.json`。
- 修复 Windows canonical path 大小写差异导致合法插件目录被误判为越界的问题。
- 插件贡献点基础版支持 exporters、nodeTypePacks、templatePacks；TXT 导出纳入 `builtin.exportText`。
- 插件管理面板显示用户数据目录，支持复制路径；桌面端支持打开目录。

## 用户目录结构

```text
com.localmindmap.desktop/
  mindmaps/
  autosave/
  node-types/
    custom-node-types.json
    packs/
  templates/
    custom-templates.json
    packs/
  plugins/
    plugin-registry.json
    installed/<pluginId>/manifest.json
  config/
    app-settings.json
    recent-files.json
    user-preferences.json
    migration-v1.6.json
  backups/
```

实际根路径由 Tauri 根据操作系统和应用标识解析，不写入 `dist`、`src-tauri`、`target`、`node_modules` 或安装目录。
identifier 属于安装包身份和持久化路径契约，v1.6 发布后不得无迁移方案随意修改。

## 插件安全边界

- 当前插件是声明式 JSON 数据，不执行插件包中的任意 JavaScript 或二进制代码。
- handler 只允许映射到应用内置的 `builtin.` 命名空间。
- 递归拒绝 `script`、`eval`、`function`、`remoteUrl`、`code`、`command`、`shell`、`executable`。
- 不使用 `eval` 或 `new Function`。
- 不支持远程插件市场、远程下载或远程脚本。

## 兼容性

- Web 端继续使用原 localStorage key，不破坏已有 Web 数据。
- 旧 Web JSON 插件可在 registry 读取阶段兼容归一化；新导入插件使用 v1 manifest。
- `.lmind` 基础结构、保存 / 打开逻辑、节点类型包和模板包格式不变。
- v1.5 顶部、左右面板、画布和检查器主布局保持不变。
- 未新增 npm 依赖。

## 暂未包含

- 查找替换单次替换定位 bug。
- 备注区域查找高亮。
- 写作模块。
- 插件市场、远程下载、任意 JS、DLL 或其他可执行插件。
- 云同步、登录、协同。
- PDF / Word 导出。

## 验证状态

- `npm run build`：通过。
- `npm run test`：通过，20 个测试文件、182 个测试。
- Windows release 二进制已验证新用户目录创建、旧 identifier 数据复制，以及节点类型、模板和插件 registry 的重启持久化。
- `cargo test`（`src-tauri`）：通过，6 个测试。
- `npm run tauri:build`：通过，已生成 MSI 与 NSIS。
- Windows release 桌面端：启动、真实路径显示、复制路径、打开目录、目录树创建和迁移备份通过。
- 用户自定义节点类型 / 模板与第三方插件的完整桌面 UI 生命周期仍需发布前人工样例验收。
