# 发布流水线排障

| 症状 | 处理 |
| --- | --- |
| 版本检查失败 | 执行 `node scripts/ci/check-release-version.mjs --tag v1.19.0`，只修正五处项目版本；不要执行 `cargo generate-lockfile`。 |
| tag / SHA 检查失败 | 重新确认 tag 指向欲发布 commit，不要将旧 tag 或不同 commit 的 Artifact 混入发布。 |
| UOS ARM job 无可用 runner | 这是阻断错误。启用 `ubuntu-22.04-arm` 原生 runner 或调整 GitHub 计划；不要交叉构建或重命名 x64 AppImage。 |
| Linux 缺少 WebKitGTK | 使用 Ubuntu 22.04 并安装工作流列出的 `libwebkit2gtk-4.1-dev` 等 Tauri v2 依赖。 |
| macOS 缺少签名 secret | 仅可进行 `allow_unsigned_macos=true` 的 Artifact 预览；配置全部 Apple secrets 后再推 tag。 |
| 资产收集失败 | 检查 Tauri bundle 输出、版本字符串和构建时间；收集器刻意拒绝不唯一、旧或过小的文件。 |
| Draft Release 更新被拒绝 | 已有 Release 的 `targetCommitish` 与当前 SHA 不同，必须人工处置，不能自动混合资产。 |
| UOS 包无法启动 | 保持 candidate，使用真实 UOS runner/设备执行验收并记录依赖、架构和日志（脱敏后）。 |

所有日志和诊断报告均不得包含证书、密码、用户绝对路径或思维导图内容。
