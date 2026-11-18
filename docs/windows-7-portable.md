# Windows 7 SP1 离线便携版

Windows 10 及以上继续使用标准版。Windows 7 SP1 使用独立便携版：Electron 22.3.27（Chromium 108）和为 Windows 7 单独编译的本地文件服务都随 ZIP 提供，无需在目标机安装 Edge、WebView2、Node.js 或 Rust。[Electron 官方说明](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice)确认 22 是最后一个支持 Windows 7 的主版本；[官方版本列表](https://releases.electronjs.org/release?channel=stable&major=v22)列出了对应内核。该运行时已停止安全更新，建议仅在获准的隔离内网使用，打开可信来源的导图、附件和插件。

## 在内网电脑上使用

1. 打开「控制面板 → 系统」，确认显示 Windows 7 Service Pack 1，并查看「系统类型」。64 位系统用 `win7-x64.zip`；32 位系统用 `win7-ia32.zip`。Windows 7 未安装 SP1 的情况不在支持范围内。
2. 由 IT 比对 ZIP 与随包提供的 `.sha256` 文件，使用内网批准的介质分发。完整解压到有读取权限的本地目录，再双击 `LocalMindmap-Win7.exe`。请保留同目录的 DLL、数据文件以及 `resources`、`locales` 文件夹。
3. 在软件菜单里打开 `.lmind` 文件。便携版不写入系统文件关联；首次验证时用副本，保存后关闭并重新打开核对节点、样式和备注。导图文件与标准版共用 `.lmind` 格式。
4. Chromium 缓存独立放在 `%APPDATA%\com.localmindmap.desktop\chromium-win7`。应用的本地配置和插件目录与标准版使用相同的位置；若同一台测试电脑上装有两个版本，建议关闭一个再启动另一个。JavaScript 插件继续使用应用自带运行时；Python 或 EXE 插件仍得使用目标机器可运行的解释器或程序。

## 从源码构建

使用有 MSVC C++ 工具（含 x86 和 x64）与 Windows SDK 的 Windows 10/11 构建机。使用 Node.js 22 或项目现有构建环境，并先安装项目依赖。因为 Rust 的 [Windows 7 专用 MSVC 目标](https://doc.rust-lang.org/rustc/platform-support/win7-windows-msvc.html) 不提供预编译标准库，便携版会用固定版本的 nightly 和 `rust-src` 构建标准库。

```powershell
npm ci
rustup toolchain install nightly-2026-06-01 --profile minimal --component rust-src
npm run desktop:package:win7
```

产物在 `release-win7/`，文件名为 `LocalMindmap-<版本>-win7-x64.zip` 和 `LocalMindmap-<版本>-win7-ia32.zip`，各自带有 `.sha256`。只构建一个位数时，运行 `npm run desktop:package:win7 -- --arch x64`，把 `x64` 换成 `ia32` 即为 32 位。目标机无需构建环境。

首次构建会从 Electron 官方发布源下载对应运行时，并按固定 SHA-256 验证。断网构建请先在联网构建机准备同版本 npm 依赖、Rust 工具链、Cargo 依赖缓存和两个 [Electron 官方 ZIP](https://github.com/electron/electron/releases/tag/v22.3.27)。将 ZIP 放入 `tmp/win7-build-cache/` 或用 `--cache-dir` 指定缓存目录，再执行 `npm run desktop:package:win7 -- --offline`。断网运行与断网构建是两个不同环节。

## 内网验收

用实际的 Win7 SP1 x64 和 x86 电脑或虚拟机分别验收：断网启动、通过菜单打开中文路径下的 `.lmind`、新建节点、保存并重开、导入 Excel/Markdown、导出 PNG、打开和保存文件对话框。常用部署分辨率也应检查一次，例如 1024×768；若有必须用的插件，再单独试跑该插件。现代 Windows 上启动旧 Electron 与检查二进制架构只能用于初验，不能代替 Win7 实机验收。
