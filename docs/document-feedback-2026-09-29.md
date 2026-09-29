# 待优化点文档优化验收记录

本次根据 `C:/Users/11624/Desktop/待优化点.docx` 的文字与三张截图修改现有代码，保留纯本地编辑与 .lmind 存储。文档中的产品要求用于确定改动范围，没有执行文档内的外部操作指令。

## 实现与验收范围

| 优化项 | 实现结果 |
| --- | --- |
| 备注预览 | 删除“节点内容 / 备注内容”重复标签，保留标题和正文分区、同级导航。 |
| 日志入口 | “插件 → 诊断与日志 → 插件日志”直接展示独立弹窗；最近 100 条日志保存在本地 logs/plugins.json。 |
| 插件上下文 | Script、Workflow、Python/Executable 上下文提供 mindmap.filePath，未保存为空字符串；selectedNode 和 nodes 包含标签数组 tags。 |
| 插件菜单 | 按插件中心、插件命令、开发者工具、诊断与日志组织。中心包含管理、导入、重载、桌面目录入口。 |
| 插件管理 | 配置 / 已安装插件 / 商城分页；显示安装与日志目录、运行器开关、Python 路径。显示新安装来源、重装/启停/目录/说明/风险；历史来源不猜测。 |
| 开发入口 | 工作台独立窗口展示类型、模板生成和示例；开发文档 Markdown 弹窗，不再启动外部文本编辑器。 |
| 插件消息 | 所有 showMessage 内容合并为可滚动弹窗，不再只显示最后一条瞬时提示。 |
| Ctrl+F | 普通画布、节点文本编辑、备注输入和选择文本均使用应用查找替换；Ctrl/Cmd+H 也可打开。 |
| 状态提示 | 底部提示保留，图标移到文本后面。 |
| 公共商城 | 默认空地址、手动 HTTPS 查询和下载插件/节点类型/模板清单；不上传导图、附件或凭证，不自动安装或执行下载资源。 |
| 节点导出 | 文件菜单和节点右键支持导出当前选择；支持 LMIND、Markdown、Excel，包含所选分支，父子重复选择去重，多分支生成中心主题。 |
| 节点附件 | 每节点一个文件/图片/链接；增改删可撤销，文件和图片嵌入 LMIND，保存重开完整保留；图标按类型显示并提供名称提示；图片弹窗、链接默认浏览器、常见文档系统关联打开。 |

## 使用边界和待验证事项

- 没有提供真实商城服务地址，本次完成可配置客户端和清单协议，未部署服务，也未进行真实服务器联调。服务须支持 HTTPS、跨域匿名 GET，清单格式见 plugin-development.md。
- 附件上限 20 MB；图片支持 PNG/JPG/GIF/WebP/BMP。文件系统关联打开只支持常见文档、图片、音视频和压缩格式；其他格式可在附件窗口“另存附件”。Web 预览中的文件附件使用下载保存。
- 多节点导出为一个文件，不拆成多个下载；LMIND 保留附件，Markdown/Excel 保持原有正文结构输出。
- 新安装来源开始记录；历史已安装插件未记录的来源不会推断。本地安装重装会让用户重新选择包，商城安装可从原有本地商城条目重装。
- 尚未制作或安装新版桌面安装包；默认应用关联打开、macOS/信创实机行为、跨平台和长稳验收尚未进行。
- 构建仍提示既有大 chunk 和 templatePacks 混合动态/静态导入，不阻断构建。

## 测试

- `npm test`：60 个测试文件，548 项通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- `cargo test --manifest-path src-tauri/Cargo.toml --offline`：65 项通过，包含附件路径、链接边界和原有插件回归。
- `git diff --check`：通过。
- 本地浏览器实测：日志菜单直接弹窗；编辑节点并选择文字后 Ctrl+F 显示查找和替换；新增链接附件图标与 tooltip 正确，Ctrl+Z 撤销附件；插件管理分页及配置入口可见。
- 发布脚本测试原本固定断言 1.24.2，与项目已有 1.24.3 不一致，本次同步该断言，不修改应用版本。

## 修改文件

- `docs/document-feedback-2026-09-29.md`
- `docs/plugin-development.md`
- `docs/requirement-matrix.md`
- `scripts/ci/__tests__/release-scripts.test.mjs`
- `src-tauri/src/main.rs`
- `src-tauri/src/node_attachments.rs`
- `src/app/App.tsx`
- `src/app/components/TopMenuBar.tsx`
- `src/features/mindmap/AttachmentDialog.tsx`
- `src/features/mindmap/MarkdownPreview.tsx`
- `src/features/mindmap/PluginManagerPanel.tsx`
- `src/features/mindmap/__tests__/PluginManagerPanel.test.tsx`
- `src/features/mindmap/__tests__/documentFeedback.test.tsx`
- `src/features/mindmap/exportSelection.ts`
- `src/features/mindmap/keyboardShortcuts.ts`
- `src/features/mindmap/layout.ts`
- `src/features/mindmap/nodeAttachments.ts`
- `src/features/mindmap/openMindmap.ts`
- `src/features/mindmap/remarkPreview.tsx`
- `src/features/mindmap/types.ts`
- `src/features/plugins/FeedbackDialog.tsx`
- `src/features/plugins/MarketplacePanel.tsx`
- `src/features/plugins/PluginDevWorkbenchPanel.tsx`
- `src/features/plugins/__tests__/marketplace.test.ts`
- `src/features/plugins/__tests__/pluginActions.test.ts`
- `src/features/plugins/__tests__/pluginExternalRunner.test.ts`
- `src/features/plugins/__tests__/pluginScriptRunner.test.ts`
- `src/features/plugins/marketplace.ts`
- `src/features/plugins/pluginLogs.ts`
- `src/features/plugins/pluginScriptActions.ts`
- `src/styles/global.css`
