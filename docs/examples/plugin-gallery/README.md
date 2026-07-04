# 本地插件中心示例库

本目录是 Local Mindmap 本地插件中心的唯一内置数据源。应用通过编译期内置资源读取
`catalog.json` 和示例文件，不发起网络请求，也不下载远程插件。

## 目录结构

- `catalog.json`：插件中心索引。
- `text-export-plugin/`：声明式 TXT 导出示例。
- `meeting-workflow-plugin/`：JSON Action Workflow 示例。
- `script-batch-plugin/`：受控 Web Worker 脚本示例。
- `python-keyword-plugin/`：Python 外部命令示例。

每个示例目录必须包含 `manifest.json` 和 `README.md`。`script` 与
`external-command` 示例还必须包含 manifest 声明的 `entry` 文件。

## 维护规则

1. catalog 的 `id` 必须与 manifest 的 `pluginId` 一致。
2. `path` 必须是以 `manifest.json` 结尾的安全相对路径，不得包含 `..`、绝对路径、
   URL、Windows 盘符或 ADS。
3. `pluginType`、`runtime` 必须与 manifest 一致。
4. 新增资源后同步更新 Rust 端内置资源映射和测试。
5. 示例不得依赖网络、远程 URL、Shell、自动依赖安装或用户数据上传。
6. 安装必须走宿主现有的 manifest 校验和事务安装流程。

## catalog 字段

- `version`：catalog 结构版本，当前为 `1`。
- `items[].id`：gallery 条目 ID，同时也是插件 `pluginId`。
- `title`、`description`：卡片标题与说明。
- `category`：UI 分类。
- `pluginType`、`runtime`：插件类型与可选运行时。
- `path`：相对本目录的 manifest 路径。
- `tags`：搜索标签。
- `recommended`：是否推荐。
- `riskLevel`：`low`、`medium` 或 `high`。
