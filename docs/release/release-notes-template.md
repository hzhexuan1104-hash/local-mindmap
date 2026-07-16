# Local Mindmap v1.19.0

## 下载

### Windows x64

- `Local-Mindmap_1.19.0_windows_x64-setup.exe` — 推荐普通 Windows 用户使用。
- `Local-Mindmap_1.19.0_windows_x64.msi` — 适合受管安装。

### macOS

- `Local-Mindmap_1.19.0_macos_arm64.dmg` — Apple Silicon / M1 及更新设备。
- `Local-Mindmap_1.19.0_macos_x64.dmg` — Intel Mac。

### 统信 UOS（兼容候选）

- `Local-Mindmap_1.19.0_uos_x64.deb` / `Local-Mindmap_1.19.0_uos_x64.AppImage`
- `Local-Mindmap_1.19.0_uos_arm64.deb` / `Local-Mindmap_1.19.0_uos_arm64.AppImage`

DEB 适合安装；AppImage 适合免安装运行。UOS 包由 Ubuntu 22.04 构建，在通过真实 UOS 设备验收前标记为兼容候选，不代表统信官方认证。

## 校验

下载 `SHA256SUMS.txt` 后计算包的 SHA-256，并与其中同名行比较。例如：

```text
sha256sum Local-Mindmap_1.19.0_uos_x64.AppImage
Get-FileHash Local-Mindmap_1.19.0_windows_x64-setup.exe -Algorithm SHA256
shasum -a 256 Local-Mindmap_1.19.0_macos_arm64.dmg
```

`release-manifest.json` 还记录了版本、tag、commit、构建时间、平台、架构、格式、大小、哈希、签名/公证和兼容状态。
