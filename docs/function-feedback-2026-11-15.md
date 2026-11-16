# 功能优化建议落实记录（2026-11-15）

来源：用户本地《功能优化建议.doc》。文档作为功能需求输入，未执行其中任何与代码优化无关的指令。保留此前页面优化改动。

## 逐项结果

| 文档条目 | 实现与边界 |
| --- | --- |
| 1 插件导入 | script/external-command 声明 import capability 后选择任意扩展名文件，context.inputFile 提供 path/name；取消不运行。支持更新当前节点或 createMindmap 新建导图。受控脚本没有文件系统权限，读取文件内容使用外部命令插件。 |
| 2 导出消息和路径 | showMessage.exportPath 可省略；非空时关闭消息后打开文件父目录，不执行文件，错误路径有反馈。 |
| 3 消息面板 | 调整宽度、标题分隔、正文间距、长内容换行和滚动。 |
| 4 lmind 文件关联 | 增加启动参数读取，等待本地配置加载后打开对应文件，恢复文件路径和保存状态。已实现命令行启动路径链路；未完成 Windows 安装包关联实机复验、macOS Opened 事件支持。 |
| 5/6 批量节点 | updateNodes/addChildNodes 每次上限 500；501 拒绝；保留原有整批校验与撤销机制。 |
| 7 关于 | 中央弹窗展示 package.json 的当前版本及权利说明。具体著作权人未在文档中提供，未擅自填入个人或公司名称。 |
| 8 命令面板 | 移除使用帮助中的菜单入口，保留实现、快捷键及设置入口。 |
| 9 使用指南 | 新增 Markdown 使用指南，中央弹窗阅读。 |
| 10 工作台 | 打开开发目录复用规范化路径；展开新建向导自动滚动到表单。创建/生成示例既有后端通过回归测试；另修复 external executable 相对入口切换工作目录后运行失败。 |
| 11 重复文档菜单 | 删除帮助下开发文档菜单，保留插件开发者工具入口。 |
| 12 manifest 目录 | 复用统一目录打开函数，Windows 路径转换为 Explorer 可接受格式，处理 UNC 路径。 |
| 13 内核 | 未迁移浏览器内核；需独立架构与平台兼容性评估。 |
| 14 商城说明 | 新增本地接口规范及面板查看按钮，说明清单 GET、下载 GET、字段、限制、CORS 和错误处理。 |
| 15 默认类型 | Tab 创建子节点使用所选默认类型。 |
| 16 附件 | 链接/图片/文档使用可区分图标；图片支持缩放、90°旋转和重置；Windows 链接交由系统默认应用打开。图标采用本地 Unicode 字符，未逐像素复刻文档插图。 |
| 节点类型补充 | 插件新建节点和导图支持 nodeTypeId，未知类型 ID 保留；类型编辑面板只读显示 ID，新建草稿预生成唯一 ID；导入同 ID 类型一律跳过，提示名称/ID 和删除后重导说明。 |

## 修改文件

- src/app/App.tsx：菜单、指南、启动文件、插件输入/输出和新导图处理、默认类型。
- src/app/components/NodeManagerDrawer.tsx：只读 ID。
- src/features/mindmap/ImageAttachmentPreview.tsx：图片交互。
- src/features/mindmap/nodeAttachments.ts：附件图标。
- src/features/mindmap/nodeTypes.ts、nodeTypePacks.ts：草稿 ID 和导入冲突。
- src/features/mindmap/plugins.ts：import capability。
- src/features/plugins/pluginScriptActions.ts：500 上限、类型 ID、导入树与导出路径。
- src/features/plugins/MarketplacePanel.tsx：商城文档入口。
- src/features/plugins/PluginDevWorkbenchPanel.tsx：新建向导定位。
- src/styles/global.css：消息/图片面板样式；保留此前页签修复。
- src-tauri/src/main.rs：启动文件、插件导入选择器、目录路径和可执行入口修复。
- src-tauri/src/node_attachments.rs：系统默认应用打开附件。
- src/features/plugins/__tests__/pluginActions.test.ts、pluginWorkflow.test.ts：批量边界和新增协议回归。
- src/features/mindmap/__tests__/nodeTypePacks.test.ts、plugins.test.ts：冲突规则与能力清单回归。
- docs/usage-guide.md、marketplace-api.md、plugin-development.md：用户和开发文档。
- docs/requirement-matrix.md、本文：需求与验收记录。

## 验证

- npm test -- --reporter=dot：60 个文件、552 项通过。
- npm run build：通过，仍有包体积提示。
- cargo test --manifest-path src-tauri/Cargo.toml --offline：65 项通过。
- git diff --check：通过。

未完成桌面 GUI 实机验收、macOS/统信验证和安装包重新构建。本次完成以上代码增量，不代表全部 P0/P1 需求或全平台验收完成。
