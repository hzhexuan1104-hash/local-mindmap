# v1.19.0 跨平台 Release 流水线

`release-multiplatform.yml` 是 Local Mindmap 的唯一正式桌面发布入口。它不使用开发者工作站的 `src-tauri/target` 目录，也不上传用户文件、`.lmind` 数据、证书或私钥。

## 触发与输出

- 推送语义化 tag（例如 `v1.19.0`）会运行预检、五个构建任务，并且仅在全部成功后创建 GitHub Draft Release。
- `workflow_dispatch` 用于验证构建；它只上传 Actions Artifacts，不会创建 Release。手工验证 macOS 时必须显式启用 `allow_unsigned_macos`，产物会标记为 `_preview`。
- 发布前脚本比较 `package.json`、`package-lock.json`（顶层及根 package）、`Cargo.toml`、`Cargo.lock` 的 `local-mindmap` 条目和 `tauri.conf.json`。tag 去掉 `v` 后必须完全一致。

| Artifact | Runner | Rust target | Bundle |
| --- | --- | --- | --- |
| Windows x64 | `windows-latest` | `x86_64-pc-windows-msvc` | NSIS EXE、MSI |
| macOS ARM64 | `macos-15`（Apple Silicon） | `aarch64-apple-darwin` | DMG |
| macOS x64 | `macos-15-intel` | `x86_64-apple-darwin` | DMG |
| UOS x64 candidate | `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | DEB、AppImage |
| UOS ARM64 candidate | `ubuntu-22.04-arm` | `aarch64-unknown-linux-gnu` | DEB、AppImage |

ARM64 AppImage 只在原生 ARM64 runner 构建；如果该 runner 不可用，任务应失败，不能以 x64 文件改名替代。Ubuntu 22.04 是 Tauri v2 WebKitGTK 4.1 支持的较低兼容基线；这只生成 UOS 兼容候选包，不等同于统信认证或真实设备验收。

## 产物与门禁

各构建 job 会先清理本目标的 bundle 输出，记录构建开始时间，再由 `scripts/ci/collect-release-assets.mjs` 只收集本次修改、名称包含当前版本的文件。它们被重命名为稳定文件名并上传为独立 Artifact，不上传 `target`、`node_modules` 或源码副本。

汇总 job 重新检查 tag、commit 与版本，下载五组 Artifact，生成以下文件：

- 八个用户可下载的安装包；
- `SHA256SUMS.txt`（稳定排序，格式为 `<hash>  <filename>`）；
- `release-manifest.json`；
- `build-summary.md`；
- 每个构建任务的 `build-info-<platform>-<arch>.json` 与验证报告。

已存在的 Draft Release 只有在 `targetCommitish` 与当前完整 commit SHA 相同时才会更新；同名已知资产可安全覆盖，未知的人工资产不会被删除。流水线始终保持 Draft，人工安装验收后才允许在 GitHub 界面中 Publish。

## 首次运行建议

1. 推送开发分支。
2. 手动运行 `Build and draft Local Mindmap release`，保持 `create_draft_release=false`，为 macOS 测试显式设定 `allow_unsigned_macos=true`。
3. 下载并检查五组 Artifact；在对应真实设备安装测试。
4. 完成 Apple 签名配置和 UOS 真机验收后，创建 `v1.19.0` tag。

不在 Windows 伪造 macOS DMG，不从 x64 交叉构建 ARM AppImage，也不将 Ubuntu 构建包称为“统信官方认证包”。
