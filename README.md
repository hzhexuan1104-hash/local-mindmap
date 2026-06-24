# 本地化思维导图工具

一个纯本地运行的思维导图 Web 工具，使用 React + TypeScript + Vite 构建。项目目标是提供离线可用、文件可迁移、无云端依赖的思维导图编辑体验。当前开发版本：v1.1.0。

## 在线预览

[GitHub Pages 在线预览](https://hzhexuan1104-hash.github.io/local-mindmap/)

## 已实现功能

- 基础节点操作：新建中心主题、新增子节点、新增同级节点、删除节点、双击编辑节点文本。
- 画布能力：左到右自动布局、节点自动换行、缩放、平移、一键居中。
- 视图控制：节点折叠 / 展开、展开全部、折叠全部。
- 文件能力：保存 `.lmind`、打开 `.lmind`，文件内容为标准 JSON。
- Markdown 备注：编辑模式、实时预览、预览模式、放大预览。
- 导入导出：Markdown、Excel、JSON 导入导出，PNG/JPG 图片导出。
- Markdown 导入导出增强：使用 `LMIND_NODE` 注释区分真实节点标题和备注中的 Markdown 标题。
- Excel 导入增强：支持列映射配置，可选择节点层级、节点文本、节点备注、节点类型、创建顺序列。
- 查找替换：支持节点文本、备注内容、全部范围的查找、跳转、单次替换、全部替换。
- 模板管理：内置官方默认模板库，自定义模板保存到 localStorage，支持分类、备注、缩略图、搜索、排序、筛选、删除和从模板新建。
- 自定义节点类型：支持图标、形状、颜色、字号、加粗、默认文本、默认备注。
- 主题系统：内置默认蓝、清新绿、活力橙、暗色黑、简洁灰。
- 插件管理基础版：支持本地 JSON 插件安装、启用、禁用、卸载，内置主题包、图标包和 TXT 导出示例插件。
- 操作历史：支持撤销 / 重做，历史记录不少于 50 步。
- 性能测试工具：支持生成 100 / 500 / 1000 节点导图，统计序列化和内容生成耗时。
- 自动化测试基础：使用 Vitest 覆盖 Markdown 导入导出、JSON 校验、Excel 导入核心解析、TXT 导出和插件 manifest 校验。
- v1.1 第一批功能：Tauri 桌面端最小壳、节点拖拽位置、重新自动布局、Ctrl/Shift 多选、批量删除、批量切换节点类型、节点和画布右键菜单。

## 当前完成度

- P0/P1 核心能力已覆盖主要编辑、备注、保存打开、导入导出、模板、查找替换、主题和基础画布操作。
- P2 能力已实现自定义节点类型增强和插件管理基础版。
- 官方模板库基础版、性能压测工具、Release 检查文档和 v1.0.0 发布说明已完成。
- 桌面端已新增 Tauri v2 最小配置；真实安装包和跨平台打包验证仍属于后续任务。
- 复制 / 剪切 / 粘贴、拖拽调整层级、框选批量操作仍属于后续任务。

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

启动成功后，在浏览器打开终端显示的本地地址，通常是：

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

## 桌面端开发模式

v1.1 新增 Tauri v2 最小桌面壳，保留当前 Vite + React Web 架构。

运行桌面开发模式：

```bash
npm run tauri:dev
```

构建桌面端：

```bash
npm run tauri:build
```

运行 Tauri 需要本机安装 Rust / Cargo，以及目标平台所需的 Tauri 系统依赖。当前桌面端只加载本地 Vite 应用，不新增云端服务、不上传用户数据、不执行远程脚本。

## 自动化测试

运行单元测试：

```bash
npm run test
```

当前测试覆盖：

- Markdown 导出：节点标题、层级、`LMIND_NODE` 标记、备注标题保留。
- Markdown 导入：标记模式、普通 Markdown、代码块标题忽略。
- JSON 导入校验：合法 `.lmind` 解析、非法 JSON/结构拒绝。
- Excel 导入核心解析：列视图、有表头/无表头、层级树生成、错误层级提示。
- TXT 导出：层级缩进和备注输出。
- 插件 manifest 校验：合法 manifest 与缺失必填字段。
- 官方模板：模板数量、官方标识和 rootNode 合法性。
- 性能测试：100 / 1000 节点生成、唯一 ID 和多层级结构。
- v1.1：节点 `position` 保存/打开兼容、JSON 导入导出保留 `position`、无 `position` 自动布局、重新自动布局清除 `position`、多选纯函数。

## GitHub Pages 部署说明

项目是静态前端应用，可将 `npm run build` 生成的 `dist/` 目录部署到 GitHub Pages。

常见流程：

1. 在仓库中配置 GitHub Pages。
2. 使用 GitHub Actions 或手动方式执行 `npm install` 和 `npm run build`。
3. 将 `dist/` 目录发布为 Pages 静态站点。
4. 打开在线预览地址验证页面和静态资源是否正常加载。

当前在线预览地址：

```text
https://hzhexuan1104-hash.github.io/local-mindmap/
```

## 桌面端打包准备

当前阶段已接入 Tauri v2 最小桌面壳，Web 版和 GitHub Pages 部署方式保持不变。

桌面端后续方向：

- 保留当前 Vite Web 应用作为核心 UI。
- Tauri 桌面壳加载当前 Vite 应用和 `dist/` 构建产物。
- 桌面端继续满足纯本地运行、不上传用户数据、支持 `.lmind` 打开和保存。
- 先验证 Windows、macOS、Linux / 信创系统及国产 CPU 架构兼容，再进入正式打包。

详细方案见：

```text
docs/desktop-packaging-plan.md
```

## 信创适配说明

信创适配文档覆盖统信 UOS、银河麒麟、Windows 10+、macOS 11+，以及 x86/x64、ARM64、飞腾、鲲鹏、龙芯等目标架构的适配注意事项。

文档见：

```text
docs/xinchuang-compatibility.md
```

## 文件格式说明

`.lmind` 是本工具的本地文件格式，本质是标准 JSON 文件。

典型结构包含：

- `version`：文件格式版本。
- `meta`：元信息，例如创建时间、更新时间、主题。
- `nodeTypes`：自定义节点类型配置。
- `rootNode`：完整思维导图节点树。

示例：

```json
{
  "version": "1.0",
  "meta": {
    "createTime": "2026-06-24T10:00:00.000Z",
    "updateTime": "2026-06-24T10:00:00.000Z",
    "theme": "default-blue"
  },
  "nodeTypes": [],
  "rootNode": {
    "id": "root",
    "text": "中心主题",
    "remark": "",
    "position": { "x": 0, "y": 0 },
    "children": []
  }
}
```

`position` 是 v1.1 新增的可选字段。旧 `.lmind` 文件没有该字段时仍使用左到右自动布局；节点被手动拖拽后会保存该坐标，点击“重新自动布局”会清除节点坐标并恢复自动布局。

## 插件管理系统

当前插件系统是基础版，采用“插件描述文件 + 本地注册表 + 数据驱动扩展”的方式实现。

支持能力：

- 从本地 JSON 文件安装插件。
- 插件列表查看、搜索、分类筛选。
- 插件启用、禁用、卸载。
- 插件状态保存到浏览器 localStorage，刷新后保留。
- 启用主题包插件后，插件主题会出现在主题下拉框中。
- 启用图标包插件后，插件图标会出现在自定义节点类型图标选择中。
- 启用 TXT 导出插件后，页面显示“导出 TXT”按钮。

内置示例插件：

- 示例主题包：提供紫色主题、海洋主题。
- 示例图标包：提供 🚀、🔥、🧠、🏁、📎。
- TXT 导出插件：导出 `mindmap.txt`，按节点层级缩进输出文本和备注。

安全限制：

- 不执行第三方 JavaScript。
- 不使用 `eval` 或 `new Function`。
- 不加载远程脚本。
- 不联网下载插件。
- 插件 manifest 只声明数据和能力，真正的 TXT 导出由应用内置安全 handler 执行。

插件开发文档见：

```text
docs/plugin-development-guide.md
```

## 官方模板库

工具内置 8 个纯本地官方默认模板，不从云端加载：

- 项目管理模板
- 会议纪要模板
- 学习笔记模板
- 产品需求模板
- 问题分析模板
- 个人计划模板
- 读书笔记模板
- 竞赛方案模板

官方模板不可删除，可以直接用于新建思维导图，并支持搜索、分类筛选和排序。我的自定义模板功能仍保存在浏览器 localStorage 中。

## 性能测试工具

页面内置“性能测试”面板，可生成：

- 100 节点测试导图
- 500 节点测试导图
- 1000 节点测试导图

测试结果包含节点总数、最大层级、生成耗时、`.lmind` 序列化耗时、Markdown 内容生成耗时、JSON 内容生成耗时、TXT 内容生成耗时和布局计算耗时。结果可复制为 Markdown。

## Release 检查

发布检查文档见：

```text
docs/release-checklist.md
```

v1.0.0 发布说明见：

```text
docs/release-notes-v1.0.0.md
```

## 数据安全说明

- 工具在浏览器本地运行。
- 保存、打开、导入、导出均通过浏览器本地文件能力完成。
- 模板保存在浏览器 localStorage 中。
- 插件注册表保存在浏览器 localStorage 中。
- 不需要登录。
- 不上传用户文件。
- 不上传节点内容、备注内容或操作数据。
- 不依赖云端同步。

## 主要技术栈

- React
- TypeScript
- Vite
- react-markdown
- remark-gfm
- xlsx
- html-to-image

## 验收测试

验收测试清单见：

```text
docs/acceptance-test-checklist.md
```

插件开发文档见：

```text
docs/plugin-development-guide.md
```

v1.1 草稿发布说明见：

```text
docs/release-notes-v1.1.0-draft.md
```

## 后续计划

- 节点复制 / 剪切 / 粘贴。
- 拖拽节点调整层级与顺序。
- 框选多个节点和批量操作。
- 更完整的主题和线条样式配置。
- 更完整自动化测试。
- 性能优化。
- UI 细节打磨。
- 插件签名、插件目录和沙箱执行能力。
- 桌面端真实安装包和跨平台打包验证。
