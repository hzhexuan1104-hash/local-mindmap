# 导入插件与消息面板改进

| 需求 | 实现与验收 |
|---|---|
| PLUGIN-002 / PLUGIN-006 | 插件管理识别 `importer`，校验 `runtime` 及对应入口。开发者工作台可生成可安装的 JavaScript 示例和本地输入文件；Python 示例验证了打包、安装和运行。旧版按 `import` 能力注册的插件仍可运行。 |
| PLUGIN-005 / NODETYPE-010 | JavaScript 读取用户选中的 UTF-8 文本。插件用 `children` 返回任意多层分支（最多 64 层），宿主保留层级、顺序和备注，校验整批后应用。冒烟测试覆盖三级分支、无效后代、取消、编码及大小限制、一次撤销、旧入口和新导图。 |
| UX-003 / UX-004 | 插件消息分别显示信息、提醒、错误。单条提示使用窄弹窗，多条提示在正文区域滚动；共用弹窗按普通表单或宽内容排版。桌面冒烟测试覆盖关闭、Esc、焦点与高缩放时的视口边界。 |

修改文件：

- 插件协议和运行：`src/features/mindmap/plugins.ts`、`src/features/plugins/pluginScriptActions.ts`、`src/features/plugins/pluginGallery.ts`、`src/features/commands/pluginCommands.ts`、`src/app/App.tsx`、`src-tauri/src/main.rs`、`electron/main.cjs`。
- 管理与弹窗：`src/features/mindmap/PluginManagerPanel.tsx`、`src/features/plugins/pluginDevWorkbench.ts`、`src/features/plugins/PluginDevWorkbenchPanel.tsx`、`src/features/plugins/FeedbackDialog.tsx`、`src/features/mindmap/AttachmentDialog.tsx`、`src/styles/global.css`。
- 文档与示例：`docs/plugin-development.md`、`docs/plugin-development-guide.md`、`docs/requirement-matrix.md`、本记录，以及 `docs/examples/sample-import-plugin/` 内的 `README.md`、`manifest.json`、`main.js`、`main.py`、`branches.json`。
- 回归测试：`src/features/mindmap/__tests__/plugins.test.ts`、`src/features/mindmap/__tests__/PluginManagerPanel.test.tsx`、`electron/plugin-import-smoke.cjs`；Rust 测试位于 `src-tauri/src/main.rs`。

验证命令：

```powershell
npm test
npm run build
cargo test --offline --manifest-path src-tauri/Cargo.toml
npm run native:build
.\node_modules\.bin\electron.cmd electron/plugin-import-smoke.cjs
git diff --check
```

本轮验证环境为 Windows。未生成或发布安装包，也未进行 macOS、统信 UOS 或银河麒麟的实机验证。
