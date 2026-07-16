# v1.19.0 Release 门禁

## CI 自动门禁

- [ ] tag 为 `v1.19.0` 且指向本次发布 commit；
- [ ] `package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock`、`tauri.conf.json` 版本一致；
- [ ] 工作区干净，图标存在且非空；
- [ ] `npm run build`、`npm run test`、`cargo test --manifest-path ./src-tauri/Cargo.toml`、`npm run perf:mindmap` 通过；
- [ ] 五个原生矩阵 job 均成功，且五组 Artifact 齐全；
- [ ] Windows EXE/MSI、两种 macOS DMG、两种 UOS 架构的 DEB/AppImage 均经格式与架构验证；
- [ ] macOS 正式包通过签名、公证与 stapling；
- [ ] 资产来自同一 SHA，不含 debug、旧版本、`target` 或用户路径；
- [ ] `SHA256SUMS.txt`、`release-manifest.json`、`build-summary.md` 已生成；
- [ ] Draft Release 创建成功且未自动 Publish。

## 人工门禁

- [ ] 完成 `windows-acceptance.md`；
- [ ] 完成 `macos-acceptance.md`；
- [ ] 完成 `uos-compatibility.md` 的两种真实设备矩阵，或保持 candidate 标记；
- [ ] 检查 Release notes 下载分组与 SHA-256 校验说明；
- [ ] 仅在全部适用验收完成后，人工点击 GitHub 的 Publish release。
