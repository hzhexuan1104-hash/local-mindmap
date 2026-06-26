# 本地化思维导图工具

一个纯本地运行的思维导图 Web 工具，使用 React + TypeScript + Vite 构建。项目目标是提供离线可用、文件可迁移、无云端依赖的思维导图编辑体验。当前版本：v1.3.1。

## 在线预览

[GitHub Pages 在线预览](https://hzhexuan1104-hash.github.io/local-mindmap/)

## 已实现功能

- 基础节点操作：新建中心主题、新增子节点、新增同级节点、删除节点、双击编辑节点文本。
- 画布能力：左到右自动布局、节点自动换行、缩放、空白拖拽平移、Shift 框选、一键居中。
- 视图控制：节点折叠 / 展开、展开全部、折叠全部、重新自动布局。
- 文件能力：保存 `.lmind`、打开 `.lmind`，文件内容为标准 JSON。
- Markdown 备注：编辑模式、实时预览、预览模式、放大预览。
- 导入导出：Markdown、Excel、JSON 导入导出，PNG/JPG 图片导出。
- Markdown 导入导出增强：使用 `LMIND_NODE` 注释区分真实节点标题和备注中的 Markdown 标题。
- Excel 导入增强：支持列映射配置，可选择节点层级、节点文本、节点备注、节点类型、创建顺序列。
- 查找替换：支持节点文本、备注内容、全部范围的查找、跳转、单次替换、全部替换。
- 模板管理：内置官方默认模板库，自定义模板保存到 localStorage，支持分类、备注、缩略图、搜索、排序、筛选、删除和从模板新建。
- 自定义节点类型：支持图标、形状、颜色、字号、加粗、默认文本、默认备注。
- 共享包：支持节点类型包和模板包导入 / 导出，用于分享本地自定义节点类型和自定义模板。
- 主题系统：内置默认蓝、清新绿、活力橙、暗色黑、简洁灰。
- 插件管理基础版：支持本地 JSON 插件安装、启用、禁用、卸载，内置主题包、图标包和 TXT 导出示例插件。
- 操作历史：支持撤销 / 重做，历史记录不少于 50 步。
- 性能测试工具：支持生成 100 / 500 / 1000 节点导图，统计序列化和内容生成耗时。
- 自动化测试基础：使用 Vitest 覆盖 Markdown、JSON、Excel、TXT、插件、模板、布局、选择、剪贴板、框选、快捷键和树操作。

## 版本功能

- v1.0.0：基础完整 Web 版。
- v1.1.0：Tauri 桌面端最小壳、节点拖拽 position、重新自动布局、Ctrl/Shift 多选、批量删除、批量切换节点类型、节点和画布右键菜单。
- v1.1.1：顶部导航压缩为高频按钮和分组菜单，低频功能移入左侧工具栏抽屉，画布工具悬浮化，备注面板可折叠，并新增专注模式。
- v1.1.2：修复右侧备注面板顶部布局，第一行显示 Remark 和收起按钮，第二行显示放大预览 / 编辑模式 / 预览模式，第三行显示节点标题，避免按钮挤压标题。
- v1.2.0 第一批：节点复制 / 剪切 / 粘贴、复制为同级节点、复制完整子树、root 剪切保护、Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D、顶部编辑菜单和右键菜单入口。
- v1.2.0 第二批：框选节点、Shift + 框选追加选择、Ctrl+A 全选节点、Esc 行为统一、快捷键帮助完善，输入框和 textarea 中不误拦截默认快捷键。
- v1.2.0 第三批：拖拽调整父子层级基础版、拖拽目标高亮、root 节点保护、禁止移动到自己或子孙节点下、树结构安全校验。
- v1.3.0：节点类型包共享、模板包共享和共享包体验收口；共享包是本地 JSON 配置，不等同于 `.lmind`。
- v1.3.1：补丁修复框选、空白点击、多选、框选坐标和中心主题左上拖动的画布交互问题。

## 当前完成度

- P0/P1 核心能力已覆盖主要编辑、备注、保存打开、导入导出、模板、查找替换、主题和基础画布操作。
- P2 能力已实现自定义节点类型增强和插件管理基础版。
- v1.2.0 已补齐复制 / 剪切 / 粘贴、框选、Ctrl+A、快捷键帮助、拖拽调整父子层级基础版和备注面板顶部布局修复。
- v1.3.0 已补齐节点类型包导入 / 导出、模板包导入 / 导出、共享包错误提示和共享包说明文档。
- 兄弟节点拖拽排序、批量层级调整、复杂智能排版、PDF 导出、云同步、协同编辑和插件市场仍属于后续任务。

## 本地运行

环境要求：

- Node.js 18 或更高版本
- npm 9 或更高版本

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

通常打开：

```text
http://localhost:5173/
```

## 构建方法

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

本地预览构建产物：

```bash
npm run preview
```

## 自动化测试

```bash
npm run test
```

当前测试覆盖：

- Markdown 导入 / 导出。
- JSON 导入校验。
- Excel 导入核心解析和列映射。
- TXT 导出。
- 插件 manifest 校验。
- 官方模板。
- 性能测试数据生成。
- v1.1：节点 `position` 保存 / 打开兼容、JSON 导入导出保留 `position`、无 `position` 自动布局、重新自动布局清除 `position`、多选纯函数。
- v1.2：节点复制 / 剪切 / 粘贴纯函数、完整子树 ID 重建、root 剪切保护、复制为同级节点、框选、快捷键、树操作和完整性校验。
- v1.3：节点类型包、模板包、非法包、空包、重复导入和冲突重命名。

## GitHub Pages 部署

项目是静态前端应用，可将 `npm run build` 生成的 `dist/` 目录部署到 GitHub Pages。

在线预览地址：

```text
https://hzhexuan1104-hash.github.io/local-mindmap/
```

## 桌面端开发模式

v1.1 起接入 Tauri v2 最小桌面壳，保留当前 Vite + React Web 架构。

```bash
npm run tauri:dev
npm run tauri:build
```

运行 Tauri 需要本机安装 Rust / Cargo，以及目标平台所需的 Tauri 系统依赖。当前桌面端只加载本地 Vite 应用或 `dist/` 构建产物，不新增云端服务、不上传用户数据、不执行远程脚本。

## 文件格式

`.lmind` 是本工具的本地文件格式，本质是标准 JSON 文件。典型结构包含：

- `version`：文件格式版本。
- `meta`：创建时间、更新时间、主题等元信息。
- `nodeTypes`：自定义节点类型配置。
- `rootNode`：完整思维导图节点树。

`position` 是 v1.1 新增的可选字段。旧 `.lmind` 文件没有该字段时仍使用左到右自动布局；节点被手动拖拽后会保存该坐标，点击“重新自动布局”会清除节点坐标并恢复自动布局。

## 安全约束

- 不上传用户文件、节点文本、备注、模板、插件配置或操作数据。
- 不强制联网。
- 不引入用户登录、云同步或协同编辑。
- 插件系统不执行第三方 JavaScript，不使用 `eval` 或 `new Function`。
- 内部剪贴板、框选状态、快捷键弹窗状态和拖拽目标高亮状态不写入 `.lmind`。

## 发布文档

```text
docs/release-checklist.md
docs/release-notes-v1.0.0.md
docs/release-notes-v1.1.0-draft.md
docs/release-notes-v1.1.1-draft.md
docs/release-notes-v1.2.0-draft.md
docs/release-notes-v1.3.0-draft.md
docs/share-packs.md
```

## 验收测试

验收测试清单见：

```text
docs/acceptance-test-checklist.md
```

## 后续计划

- 兄弟节点拖拽排序。
- 批量层级调整和框选后的批量移动体验。
- 更智能的自动排版、避让和辅助线。
- 更完整的主题和连接线样式配置。
- 更完整的端到端测试。
- Tauri 桌面端真实安装包和跨平台打包验证。

## v1.3 节点类型包基础版

- 支持在“节点类型”面板导出 `local-mindmap-node-types.json`，用于分享当前本地自定义节点类型。
- 支持导入节点类型包 JSON，导入后写入浏览器 localStorage 中的本地节点类型库，刷新或新建导图后仍可使用。
- 节点类型包格式包含 `version`、`kind`、`meta`、`nodeTypes`，其中 `kind` 固定为 `local-mindmap-node-type-pack`。
- 节点类型包不是 `.lmind` 文件，不包含 `rootNode`，不保存用户导图内容。
- `.lmind` 文件仍保留原有结构，仍可携带当前导图使用的 `nodeTypes`，保存和打开逻辑不变。
- 当前不包含云同步、用户登录、远程节点类型市场或权限系统，也不会执行第三方 JavaScript。

## v1.3 模板包基础版

- 支持在“模板库”面板导出 `local-mindmap-templates.json`，用于分享当前本地自定义模板。
- 支持导入模板包 JSON，导入后写入浏览器 localStorage 中的本地模板库，刷新后仍可使用。
- 模板包格式包含 `version`、`kind`、`meta`、`templates`，其中 `kind` 固定为 `local-mindmap-template-pack`。
- 模板包不等同于 `.lmind` 文件，不代表当前打开的完整导图文件；它保存的是模板库配置。
- 模板本身继续保留已有 `rootNode`、`nodeTypes`、`themeId` 等字段，用于从模板新建导图，不改变 `.lmind` 基础结构。
- 节点类型包和模板包是两个独立共享能力：节点类型包分享节点类型配置，模板包分享自定义模板。
- 当前不包含云同步、用户登录、远程模板市场或权限系统，也不会执行第三方 JavaScript。

## v1.3 共享包体验收口

- 节点类型包和模板包的导入结果统一显示成功导入、跳过重复、重命名冲突和无效条目数量。
- 非法 JSON 会提示“文件不是有效 JSON”；包类型不匹配会提示不是有效节点类型包或模板包。
- 空节点类型包会提示“未找到可导入的节点类型”，空模板包会提示“未找到可导入的模板”。
- 共享包说明见 `docs/share-packs.md`。
- 共享包不等于 `.lmind`，不包含完整导图文件，不执行脚本，仍保持完全本地运行。

## v1.3.0 画布框选与平移修复

- 画布空白区域普通左键拖拽用于平移画布。
- Shift + 画布空白区域左键拖拽用于框选节点，框选结果会替换当前选择。
- 框选命中改为节点中心点进入框选矩形才选中，减少边缘擦到时误选第三个节点。
- 点击画布空白区域会清空选择，不再默认选中中心主题；只有明确点击中心主题时才会选中 root。
- 框选视觉矩形和实际命中统一使用同一组屏幕点转换，缩放、平移和滚动后命中结果应与半透明框位置一致。
- 框选、节点拖拽和平移过程中会阻止浏览器原生文字选区，输入框、备注编辑器和可编辑区域仍可正常选择文本。
- 中心主题 / root 节点可以继续向左或向上自由拖动，`position.x` / `position.y` 可以为负数并随 `.lmind` 保存和打开恢复。
- root 的结构保护只限制删除和拖为其他节点子节点，不限制 root 的 position 拖动。
- 非 Shift 框选结束后会替换当前选择，旧 `selectedNodeId` 不会残留为高亮节点。
# v1.4 桌面端定位更新

local-mindmap 后续以 Tauri 桌面端本地应用为主运行目标。Web / GitHub Pages 仅保留为演示、开发预览和静态构建验证入口，不再作为公司内网推广时的业务主入口。

- 应用不依赖在线配置、用户登录、云同步或远程插件市场。
- 导图文件、配置、插件优先保存到本地文件系统。
- `.lmind` 继续保持本地 JSON 文件格式和可迁移能力。
- 公司内网推广时，可通过安装包、绿色版压缩包或 IT 软件中心分发。
- v1.4 新增的桌面 Native 插件目录和 manifest 管理能力仅在 Tauri 桌面端可用。
- Web 版继续保留现有 Web JSON 插件、节点类型包和模板包能力，但不支持 DLL 插件。
- v1.4 只管理 Native manifest，不加载 DLL，不执行 DLL，不执行任何第三方代码。

## v1.4 第二批：桌面本地配置与内网分发准备

第二批继续保持桌面端本地应用方向，补齐配置目录、配置 registry 草案和内网分发文档，不大规模迁移现有 `localStorage` 状态。

桌面端本地目录：

- 配置目录：`app data dir/config`
  - Windows: `%APPDATA%/Local Mindmap/config`
  - macOS: `~/Library/Application Support/Local Mindmap/config`
  - Linux: `~/.local/share/local-mindmap/config`
- 插件目录：`app data dir/plugins`
  - Windows: `%APPDATA%/Local Mindmap/plugins`
  - macOS: `~/Library/Application Support/Local Mindmap/plugins`
  - Linux: `~/.local/share/local-mindmap/plugins`

本批新增最小 Tauri command：`get_desktop_config_dir` 和 `ensure_desktop_config_dir`，用于获取和创建桌面端本地配置目录。现有 Web JSON 插件、节点类型包、模板包仍保留原逻辑。

配置 registry 草案见 `docs/desktop-local-config.md`，内网分发说明见 `docs/desktop-deployment-guide.md`。v1.4 仍不加载 DLL、不执行 DLL、不执行第三方代码。
