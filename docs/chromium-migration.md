# Chromium 迁移与内网部署

## 架构
Electron 45.3.3 自带 Chromium 156.0.8078.100，React 在沙箱渲染进程中运行；preload 只暴露命令调用，主进程验证来源、主框架和命令白名单。Rust 本地服务通过子进程 stdin/stdout JSON 请求提供文件、插件与导入导出能力，没有本地 HTTP 端口，也不依赖 WebView2。关闭程序时结束服务。

Rust 源文件暂保留 src-tauri 目录名，Cargo 已去除 tauri、tauri-build 和 WebView2 依赖。历史 tauri.conf.json 不参与当前打包。旧发布工作流移到 docs/release/legacy-tauri-workflow.yml，当前 CI 只构建并上传审核用制品，不自动发布。

## 数据与离线部署
Windows 继续读取原 AppData/Roaming/com.localmindmap.desktop；macOS 使用 Application Support 下同标识目录；Linux 使用 XDG_DATA_HOME 或 ~/.local/share 下同标识目录。Chromium 自身缓存放在该目录的 chromium 子目录，导图仍为本地 .lmind JSON。

内网部署复制 release-electron/win-unpacked 整个目录（不能只复制 exe），或在联网构建机执行 npm run desktop:package 生成安装包，再通过离线介质分发。内核及本地服务都随包携带，运行不需要联网下载。当前程序没有自动更新；内核更新需要在构建环境更新锁定依赖、重新测试和分发。

开发首次安装 npm/cargo 依赖及打包工具需要构建机访问源；完全离线构建需预先缓存 npm、Cargo、Electron 与 electron-builder 工具。离线运行不等于首次构建不需要依赖。

## 入口与文件关联
Electron 主进程接收启动参数、second-instance 和 macOS open-file。再次打开文件创建独立窗口，避免替换未保存导图。文件关联声明由 electron-builder 安装包负责。现有 Windows 安装目录仍是旧版单文件 Tauri 程序，本次未直接覆盖；请使用新版完整目录或新版安装包，不能用 Electron 主 exe 单独替换旧 exe。

旧 WebView2 的 localStorage 不自动复制到 Chromium。已迁移到本地 JSON 的模板、插件和节点类型复用原目录；仅存浏览器 localStorage 的旧数据需先在旧版导出。

## 验证与限制
前端 553 项及 Rust 68 项回归通过。Windows 实际 Chromium 启动验证了 .lmind 中文空格路径、根节点/子节点恢复、本地 JSON 写入读取、非法命令拒绝，以及 renderer 中 require 不可用。
Windows 目录包完成，尚未签名。macOS、统信/UOS 与银河麒麟需实机测试；当前 CI 的普通 Linux 构建不等于信创认证。龙芯等非上游标准 Electron 架构需要可用的内核发行版或单独移植，不能保证换内核后自动兼容。

## 修改文件
electron/main.cjs、preload.cjs、commands.json、smoke.cjs；src/desktop/bridge.ts；桌面调用方及对应测试；src-tauri/Cargo.toml、Cargo.lock、build.rs、src/main.rs、src/native_runtime.rs、src/node_attachments.rs；package.json、package-lock.json；.github/workflows/release-multiplatform.yml；scripts/ci/release-utils.mjs 及其测试；README.md、.gitignore、本文和需求矩阵。

## 检查命令
npm test -- --reporter=dot
cargo test --manifest-path src-tauri/Cargo.toml --offline
npm run build
npm run native:build
npm run desktop:build
electron electron/smoke.cjs "<测试文件绝对路径>.lmind"
