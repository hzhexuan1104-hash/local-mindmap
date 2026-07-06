# 插件诊断中心测试示例

本目录说明如何手动构造异常插件状态，用于验证“插件诊断中心”。所有操作都只发生在本地用户数据目录，不联网、不上传报告、不执行插件代码。

用户数据目录：

```text
%APPDATA%/com.localmindmap.desktop
```

## registry 孤儿记录

1. 打开 `plugins/plugin-registry.json`。
2. 添加一条不存在 installed 目录的记录：

```json
{
  "pluginId": "localmindmap.test.registry-orphan",
  "enabled": true,
  "trusted": false,
  "installedAt": "2026-07-06T00:00:00.000Z",
  "updatedAt": "2026-07-06T00:00:00.000Z"
}
```

3. 在诊断中心点击“一键扫描插件”。
4. 应看到 `Registry orphan record`。
5. 点击修复后，应创建 `plugins/backups/diagnostics/<timestamp>/`，并移除该 registry 记录。

## installed 孤儿目录

1. 创建 `plugins/installed/localmindmap.test.installed-orphan/manifest.json`。
2. 写入一个有效声明式 manifest。
3. 不要在 registry 中添加对应记录。
4. 扫描后应看到 `Installed orphan directory`。
5. 修复后应补 registry 项，默认 `enabled=true`、`trusted=false`。

## manifest 缺失

1. 创建空目录 `plugins/installed/localmindmap.test.missing-manifest/`。
2. 扫描后应看到 `Installed manifest missing`。
3. 修复会将目录移动到 `plugins/quarantine/localmindmap.test.missing-manifest-<timestamp>/`。
4. 本版本不提供自动恢复；需要手动检查后重新安装或移回。

## 危险 entry

创建 manifest 时将 `entry` 设置为以下任一值：

```json
"../main.js"
```

```json
"https://example.com/main.js"
```

```json
"C:/temp/main.js"
```

扫描后应显示 critical。此类问题不会自动修复，应卸载、隔离或重新安装插件。

## 生命周期字段

在 installed manifest 中加入：

```json
{
  "trusted": true,
  "installedAt": "2026-07-06T00:00:00.000Z",
  "updatedAt": "2026-07-06T00:00:00.000Z"
}
```

扫描后应看到 `Manifest contains lifecycle field`。修复会从 manifest 中移除这些字段；生命周期状态应只保存在 `plugins/plugin-registry.json`。

## 报告验证

1. 点击“导出 JSON 报告”。
2. 点击“导出 Markdown 报告”。
3. Markdown 报告中不应出现用户数据目录绝对路径，应显示 `<USER_DATA_DIR>`。
4. 报告不应包含 `main.py`、`main.js` 的源码内容，也不应包含任何用户导图内容。
