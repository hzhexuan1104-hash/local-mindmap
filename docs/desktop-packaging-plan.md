# 桌面端打包准备方案

## 1. 当前结论

v1.1 第一批已接入 Tauri v2 最小桌面端配置，但尚未交付正式桌面安装包。

当前仍保留 Vite Web 应用作为主形态：

- Web 版开发仍使用 `npm run dev`。
- Web 版构建仍使用 `npm run build`。
- GitHub Pages 仍发布 Vite 静态构建产物 `dist/`。
- 浏览器版保存、打开、导入、导出逻辑不变，仍使用本地文件能力。

Tauri 最小壳只负责启动桌面窗口并加载当前 Vite 应用，不新增云端服务、不上传用户数据、不执行远程脚本。

## 2. 新增文件和脚本

新增文件：

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/src/main.rs`

新增 npm 脚本：

```bash
npm run tauri:dev
npm run tauri:build
```

新增开发依赖：

```text
@tauri-apps/cli
```

## 3. 运行方式

Web 开发：

```bash
npm run dev
```

Web 构建：

```bash
npm run build
```

Tauri 桌面开发：

```bash
npm run tauri:dev
```

Tauri 桌面构建：

```bash
npm run tauri:build
```

Tauri 运行前需要安装 Rust / Cargo，并按目标平台安装系统 WebView 依赖。

## 4. 当前验证状态

- `npm run build` 已通过。
- `npm run test` 已通过。
- `npm run tauri:build` 在当前环境未通过，原因是缺少 Rust / Cargo：
  - `rustc` 不在 PATH。
  - `cargo` 不在 PATH。
  - Tauri CLI 无法执行 `cargo metadata`。

## 5. 桌面端安全要求

- 默认不联网。
- 不上传用户文件或节点数据。
- 不加载远程脚本。
- 插件基础版继续只读 manifest 数据，不执行第三方 JS。
- 本地文件读写必须由用户明确选择或确认。
- 后续如引入桌面后端文件能力，应限制文件系统访问范围。

## 6. 文件能力要求

桌面版至少需要保持 Web 版现有能力：

- 新建导图。
- 打开 `.lmind`。
- 保存 `.lmind`。
- 导入 Markdown / Excel / JSON。
- 导出 Markdown / Excel / JSON / PNG / JPG / TXT。
- 保持 `.lmind` 为标准 JSON，不依赖云端。

## 7. 后续分阶段计划

### 阶段 1：补齐本机环境

- 安装 Rust / Cargo。
- 运行 `npm run tauri:dev`。
- 运行 `npm run tauri:build`。
- 记录 Windows 本机验证结果。

### 阶段 2：平台验证

- Windows 10+ x86/x64。
- macOS 11+ Intel / Apple Silicon。
- Linux x86/x64。
- 统信 UOS / 银河麒麟。
- 飞腾、鲲鹏、龙芯等国产 CPU 架构。

### 阶段 3：原生能力评估

- 评估是否用 Tauri 原生文件对话框增强 `.lmind` 打开和保存。
- 保持 Web 版继续可用。
- 不改变 `.lmind` 数据结构。
- 不开启不必要的系统权限。

## 8. 当前未完成

- 当前环境未完成 Tauri 真实构建。
- 未生成桌面安装包。
- 未验证信创系统真实打包。
- 未验证国产 CPU 架构运行时兼容。
- 未接入 Tauri 原生文件对话框。
