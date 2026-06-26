# 桌面端内网分发指南

更新日期：2026-06-26

## 定位

local-mindmap 后续以 Tauri 桌面端本地应用作为公司内网推广主入口。Web / GitHub Pages 只保留为演示、开发预览和静态构建验证入口，业务使用不依赖公网网页，不依赖在线配置。

## 分发方式

Windows 内网分发可选方式：

- 安装包：由 `npm run tauri:build` 生成安装产物后，经 IT 审核后分发。
- 绿色版压缩包：将可执行文件和必要运行资源打包为 zip，适合受控内网试点。
- IT 统一部署：通过公司 IT 软件中心、终端管理工具、共享盘、OA 附件或内网文件分发系统推送。

macOS / Linux 后续按各平台 Tauri 打包产物分别验证。v1.4 第二批重点记录 Windows 开发和打包验证路径。

## 断网使用

断网环境下应保持可用：

- 基础思维导图编辑。
- `.lmind` 保存和打开。
- Markdown / Excel / JSON / 图片等本地导入导出能力。
- Web JSON 插件管理。
- 桌面 Native 插件 manifest 的扫描、安装、启用、禁用和卸载。
- 桌面配置目录和插件目录的本地读写。

断网环境不依赖 GitHub Pages、远程插件市场、云同步、用户登录或在线配置。

## 数据保存位置

- 导图文件：由用户选择本地路径保存，文件后缀为 `.lmind`，内容为 JSON。
- 桌面配置：保存在应用数据目录下的 `config`。
- 桌面插件：保存在应用数据目录下的 `plugins`。
- Web 演示版状态：继续使用浏览器 `localStorage`。

典型目录：

```text
Windows:
  %APPDATA%/Local Mindmap/config
  %APPDATA%/Local Mindmap/plugins

macOS:
  ~/Library/Application Support/Local Mindmap/config
  ~/Library/Application Support/Local Mindmap/plugins

Linux:
  ~/.local/share/local-mindmap/config
  ~/.local/share/local-mindmap/plugins
```

实际路径由 Tauri app data dir 解析，不在代码中硬编码绝对路径。

## tauri:build 验证

验证命令：

```bash
npm run tauri:build
```

如果通过，应记录生成产物路径。Windows 常见产物位于：

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

构建产物不得提交到 Git。`.gitignore` 必须覆盖：

```text
dist/
src-tauri/target/
target/
```

如果失败，需要区分代码问题和环境问题。常见环境问题包括：

- Rust / Cargo 未安装或 toolchain 未配置。
- Windows SDK 或 Visual Studio Build Tools 缺失。
- WebView2 运行时或打包依赖缺失。
- Windows 安装包工具链缺失。
- 签名证书或企业签名流程尚未配置。

不要为了打包通过而绕过安全边界或提交构建产物。

### 2026-06-26 Windows 本机验证结果

本机执行 `npm run tauri:build` 已通过，生成产物：

```text
src-tauri/target/release/local-mindmap.exe
src-tauri/target/release/bundle/msi/Local Mindmap_1.4.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Local Mindmap_1.4.0_x64-setup.exe
```

注意事项：

- 构建过程中 Tauri 下载了 WiX 和 NSIS 打包工具。公司内网构建机需要预安装、预缓存或配置可信内网镜像。
- 当前 `identifier` 为 `com.localmindmap.app`，Tauri 提示该值以 `.app` 结尾在 macOS 上不推荐，后续跨平台打包前应评估是否调整。
- 上述产物位于 `src-tauri/target/`，属于构建产物，不提交到 Git。

### v1.4.0 发布构建要求

发布前重新执行 `npm run tauri:build`，安装包名称应体现 `1.4.0`：

```text
src-tauri/target/release/bundle/msi/Local Mindmap_1.4.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Local Mindmap_1.4.0_x64-setup.exe
```

这些文件只作为发布附件或内网分发产物，不提交到 Git 仓库。

## 安全说明

v1.4 仍严格保持：

- 不加载 DLL。
- 不执行 DLL。
- 不执行第三方代码。
- 不从远程 URL 安装插件。
- 不上传用户导图、模板、节点类型或插件配置。

后续 DLL 插件实验必须来自内网可信来源，并经过安全审查、签名策略、崩溃隔离、权限边界和回滚方案评审。
