# macOS 安装验收

对 ARM64 和 x64 DMG 分别在对应真实硬件完成以下检查。ARM64 不能以 Universal Binary 或 Intel 包替代，Intel 检查也不能在 Rosetta 上替代。

| 检查 | ARM64 | x64 |
| --- | --- | --- |
| 下载正确 DMG 并校验 SHA-256 | [ ] | [ ] |
| 挂载 DMG，拖入 Applications | [ ] | [ ] |
| Gatekeeper、Developer ID 与 notarization 正常 | [ ] | [ ] |
| 应用启动、退出和卸载正常 | [ ] | [ ] |
| 打开 / 保存 `.lmind` | [ ] | [ ] |
| 中文输入法和快捷键 | [ ] | [ ] |
| Python 3 自动检测与插件执行 | [ ] | [ ] |
| Finder 打开目录和文件位置 | [ ] | [ ] |

预览包没有 Developer ID 或 notarization，可能需要用户在系统设置中手动放行；它们不得作为正式安装包发布。
