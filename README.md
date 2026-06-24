# 本地化思维导图工具

一个纯本地运行的思维导图 Web 工具，使用 React + TypeScript + Vite 构建。项目目标是提供离线可用、文件可迁移、无云端依赖的思维导图编辑体验。

## 在线预览

[GitHub Pages 在线预览](https://hzhexuan1104-hash.github.io/local-mindmap/)

## 已实现功能

- 基础节点操作：新建中心主题、新增子节点、新增同级节点、删除节点、双击编辑节点文本。
- 画布能力：节点自动换行、基础自动布局、缩放、平移、一键居中。
- 视图控制：节点折叠 / 展开、展开全部、折叠全部。
- 文件能力：保存 `.lmind`、打开 `.lmind`，文件内容为标准 JSON。
- Markdown 备注：编辑模式、实时预览、预览模式、放大预览。
- 导入导出：Markdown、Excel、JSON 导入导出，PNG/JPG 图片导出。
- Markdown 导入导出增强：使用 `LMIND_NODE` 注释区分真实节点标题和备注中的 Markdown 标题。
- Excel 导入增强：支持列映射配置，可选择节点层级、节点文本、节点备注、节点类型、创建顺序列。
- 查找替换：支持节点文本、备注内容、全部范围的查找、跳转、单次替换、全部替换。
- 模板管理：自定义模板保存到 localStorage，支持分类、备注、缩略图、搜索、排序、筛选、删除和从模板新建。
- 自定义节点类型：支持图标、形状、颜色、字号、加粗、默认文本、默认备注。
- 主题系统：内置默认蓝、清新绿、活力橙、暗色黑、简洁灰。
- 插件管理基础版：支持本地 JSON 插件安装、启用、禁用、卸载，内置主题包、图标包和 TXT 导出示例插件。
- 操作历史：支持撤销 / 重做，历史记录不少于 50 步。

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
    "children": []
  }
}
```

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

## 后续计划

- 节点复制 / 剪切 / 粘贴。
- 拖拽节点调整层级与顺序。
- 框选多个节点和批量操作。
- 更完整的主题和线条样式配置。
- Excel 导入更复杂的列映射规则。
- 官方模板库。
- 插件签名、插件目录和沙箱执行能力。
- 桌面端打包。
