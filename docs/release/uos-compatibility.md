# UOS 兼容候选包与真机验收

CI 在 Ubuntu 22.04 x64/ARM64 原生 runner 生成 DEB 和 AppImage。其名称中的 `uos` 表示目标兼容性，不表示统信官方认证。真实 UOS 测试完成前，`release-manifest.json` 中的 UOS `compatibilityStatus` 必须保持 `candidate`。

## 自托管 smoke workflow

`.github/workflows/uos-smoke-test.yml` 仅允许 `workflow_dispatch`，不会自动触发。为每种架构准备在线自托管 runner：

- x64：`self-hosted`, `linux`, `uos`, `x64`
- ARM64：`self-hosted`, `linux`, `uos`, `arm64`

运行时填写已有 Draft Release 的 tag；工作流下载对应候选包并执行 `docs/release/scripts/uos-smoke-test.sh` 的无 GUI 结构检查。若没有此 runner，不能把包标记为 verified，也不能静默跳过该架构。

## 手工验收矩阵

以下项目必须分别在 UOS x64 与 UOS ARM64 完成并记录版本、设备型号、系统版本、包 SHA-256 和结果。

| 项目 | x64 | ARM64 |
| --- | --- | --- |
| 安装、启动、卸载 DEB | [ ] | [ ] |
| 启动 AppImage | [ ] | [ ] |
| 打开 / 保存 `.lmind` 与自动保存 | [ ] | [ ] |
| 版本历史、`Ctrl+K`、大纲、小地图 | [ ] | [ ] |
| 中文输入法、文件选择器、打开目录 | [ ] | [ ] |
| Python、Workflow、Script 插件 | [ ] | [ ] |
| DEB desktop 文件、图标、文件关联 | [ ] | [ ] |
| HiDPI 与窗口缩放 | [ ] | [ ] |

通过后可在后续受控 Release 过程中将对应 UOS 资产从 `candidate` 调整为 `verified`；这不是 CI 自动完成的状态转换。
