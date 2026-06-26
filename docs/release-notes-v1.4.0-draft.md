# v1.4.0 Release Notes

版本号：v1.4.0

版本主题：桌面端本地应用化与 Native 插件体系底座

发布日期：2026-06-26

## 在线预览

GitHub Pages 在线预览仅作为演示和开发预览入口：

```text
https://hzhexuan1104-hash.github.io/local-mindmap/
```

公司内网推广和业务使用以后以 Tauri 桌面端本地应用为主，不依赖公网网页，不依赖在线配置。

## 桌面端定位

v1.4.0 将 local-mindmap 主线调整为 Tauri 桌面端本地应用：

- 桌面端是后续主要运行目标。
- Web / GitHub Pages 保留为演示、开发预览和静态构建验证。
- `.lmind` 继续保持可迁移的本地 JSON 文件格式。
- 导图文件由用户保存到本地文件系统。
- 配置和插件优先保存到本机应用数据目录。
- 不引入用户登录、云同步、在线配置或远程插件市场。

## Windows 安装包

Windows 构建通过 `npm run tauri:build` 生成：

```text
src-tauri/target/release/local-mindmap.exe
src-tauri/target/release/bundle/msi/Local Mindmap_1.4.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Local Mindmap_1.4.0_x64-setup.exe
```

这些文件是发布附件或内网分发产物，不提交到 Git 仓库。

## 本地配置目录

v1.4.0 新增桌面端配置目录能力：

```text
Windows: %APPDATA%/Local Mindmap/config
macOS: ~/Library/Application Support/Local Mindmap/config
Linux: ~/.local/share/local-mindmap/config
```

新增 Tauri commands：

- `get_desktop_config_dir`
- `ensure_desktop_config_dir`

配置 registry 草案为 `config/app-settings.json`：

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

本版本只完成目录能力和设计说明，不大规模迁移现有 `localStorage`。

## 桌面插件目录

桌面 Native 插件 manifest 保存到 app data dir 下的 `plugins`：

```text
Windows: %APPDATA%/Local Mindmap/plugins
macOS: ~/Library/Application Support/Local Mindmap/plugins
Linux: ~/.local/share/local-mindmap/plugins
```

目录结构：

```text
plugins/
  desktop-plugin-registry.json
  plugin-id/
    manifest.json
    plugin.dll
```

v1.4.0 只读取和管理 `manifest.json`。`plugin.dll` 仅作为未来目录结构占位，不复制、不加载、不执行。

## Native Manifest 管理

v1.4.0 新增 Native manifest 类型和校验：

- `manifestVersion` 必填。
- `pluginId` 必填，且只能包含字母、数字、点、下划线和短横线。
- `name` 必填。
- `version` 必填。
- `pluginType` 必须为 `native`。
- `entry` 必填。
- `enabled` 默认 `false`。
- `capabilities` 必须来自白名单。
- `abi` 只作为声明保存，不执行。
- 禁止 `code`、`script`、`eval`、`function`、`remoteUrl` 字段。

新增 Tauri commands：

- `get_desktop_plugin_dir`
- `list_desktop_plugins`
- `install_desktop_plugin_manifest`
- `set_desktop_plugin_enabled`
- `uninstall_desktop_plugin`

桌面插件启用状态写入 `desktop-plugin-registry.json`，不直接修改用户原始 manifest。

## Web 与桌面能力差异

Web / GitHub Pages：

- 保留现有 `.lmind` 保存 / 打开、导入导出、模板、节点类型、Web JSON 插件能力。
- 桌面 Native 插件能力安全降级，显示“桌面插件仅在桌面端可用”或禁用操作。
- 不支持 DLL 插件。
- 不依赖 Tauri commands，不因 Tauri API 不存在而崩溃。

Tauri 桌面端：

- 支持桌面插件目录。
- 支持桌面配置目录。
- 支持 Native manifest 的扫描、安装、启用、禁用和卸载。
- 支持 Windows 安装包构建。

## 内网分发方式

公司内网推广可采用：

- Windows MSI 安装包。
- Windows NSIS setup.exe。
- 绿色版压缩包。
- 公司 IT 软件中心。
- 内网共享盘、OA 附件或终端管理工具推送。

断网环境下基础编辑、`.lmind` 保存打开、本地导入导出、Web JSON 插件和桌面 Native manifest 管理应继续可用。

## 数据安全

v1.4.0 继续保持纯本地边界：

- 不上传用户导图文件。
- 不上传节点文本、备注、模板、节点类型或插件配置。
- 不强制联网。
- 不使用云同步。
- 不使用用户登录。
- 不从远程 URL 安装插件。

## Native 安全边界

v1.4.0 明确不做：

- 不加载 DLL。
- 不执行 DLL。
- 不调用 DLL。
- 不执行第三方代码。
- 不使用 `eval`。
- 不使用 `new Function`。
- 不动态 import 用户文件。
- 不把当前导图数据交给插件。
- 不允许插件访问任意本地目录。

## 本地运行

```bash
npm install
npm run dev
```

Web 预览默认运行在：

```text
http://127.0.0.1:5173/
```

## 桌面开发运行

```bash
npm run tauri:dev
```

需要本机安装 Rust / Cargo 和 Tauri 所需系统依赖。

## 桌面构建

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/`，不得提交到 Git。

## 测试方式

```bash
npm run build
npm run test
npm run tauri:dev
npm run tauri:build
```

发布前还需要按 `docs/acceptance-test-checklist.md` 手动回归关键交互。

## 已知限制

- v1.4.0 只管理 Native manifest，不加载 DLL。
- `config/app-settings.json` 仍是 registry 草案，本版不迁移全部 `localStorage`。
- Web JSON 插件仍使用浏览器 `localStorage`。
- 桌面端配置迁移需后续分批完成。
- 构建 Windows 安装包可能下载 WiX / NSIS，内网构建机需要预安装、预缓存或使用可信内网镜像。
- Tauri 当前提示 `identifier` 以 `.app` 结尾对 macOS 不推荐，后续跨平台打包前应评估是否调整。
- Vite 构建存在主 chunk 超过 500 kB 的提醒，当前不作为发布阻断。

## 后续计划

v1.5 计划评估 Windows DLL 插件实验版，但进入前必须补齐：

- Native ABI 稳定草案。
- 插件可信来源和签名策略。
- 安全审查流程。
- 权限模型。
- 崩溃隔离。
- 日志边界。
- 可回滚方案。

v1.5 之前不加载 DLL、不执行 DLL、不执行第三方代码。
