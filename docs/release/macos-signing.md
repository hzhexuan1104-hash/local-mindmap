# macOS Developer ID 签名与公证

tag 发布的 macOS 构建必须使用 Developer ID Application 签名并完成 Apple notarization。缺失任一必需 secret 会使 macOS job 失败，汇总发布任务不会运行。

## GitHub Actions secrets

在仓库 **Settings → Secrets and variables → Actions** 中配置以下值；不要将真实值、`.p12` 文件或 Apple ID 写入仓库或日志。

- `APPLE_CERTIFICATE`：Developer ID Application `.p12` 的 base64 内容；
- `APPLE_CERTIFICATE_PASSWORD`：`.p12` 密码；
- `KEYCHAIN_PASSWORD`：CI 临时 keychain 密码；
- `APPLE_SIGNING_IDENTITY`：Developer ID Application 身份名称；
- `APPLE_ID`：用于公证的 Apple ID；
- `APPLE_PASSWORD`：该 Apple ID 的 app-specific password；
- `APPLE_TEAM_ID`：Apple Developer Team ID。

## 配置步骤

1. 在 Apple Developer 账户创建或下载 Developer ID Application 证书，并导出含私钥的 `.p12`。
2. 在受信任机器上以 base64 编码 `.p12`；仅将编码结果作为 `APPLE_CERTIFICATE` secret 保存。
3. 为用于公证的 Apple ID 创建 app-specific password，保存为 `APPLE_PASSWORD`。
4. 在非 tag 分支先以 `workflow_dispatch` 验证构建；tag 之前配置全部 secret。

工作流将证书导入 `$RUNNER_TEMP` 下的临时 keychain，限制可用工具，构建结束时删除证书和 keychain。它只记录缺失 secret 的名称，绝不回显 secret 内容。

正式 job 验证 DMG、`codesign --verify --deep --strict` 和 `xcrun stapler validate`。手工预览模式使用 ad-hoc identity `-`，文件名带 `_preview`，只作为 Artifact 提供，不能进入正式 Draft Release。
