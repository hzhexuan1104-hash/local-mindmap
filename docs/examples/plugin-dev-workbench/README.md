# 插件开发者工作台示例说明

插件管理器“开发者模式”中的“插件开发者工作台”会在本机用户数据目录创建项目：

```text
plugins/dev/<pluginId>/
  manifest.json
  README.md
  main.js / main.py / plugin.exe
  icons/
  assets/
```

当前可选模板为 `import-export`、`action-workflow`、`script`、
`external-command / python`、`external-command / executable` 和
`theme-pack`。

- 声明式与 Workflow 模板不执行代码。
- script 示例只接收 context snapshot 并返回宿主校验的 actions。
- Python 示例通过 UTF-8 stdin/stdout 交换 JSON。
- executable 模板不会生成 EXE；请自行编译 `plugin.exe` 后放入项目目录。

推荐闭环：

1. 新建项目。
2. 在本地编辑 `manifest.json` 或 entry。
3. 回到工作台校验项目。
4. 校验通过后打包 `.lmplugin`。
5. 使用“导入本地打包插件”重新导入验证。
6. 在插件详情确认新安装 `trusted=false`，并按需手动启用对应 runner。

打包包含 manifest、entry、README 和普通项目资源；排除 registry、trusted、
安装时间、`node_modules`、`.git`、logs 和临时文件。完整规则见
`docs/plugin-development.md` 的 v1.11 章节。
