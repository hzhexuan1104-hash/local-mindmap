# v1.3.0 Release Notes

版本号：v1.3.0

在线预览地址：

```text
https://hzhexuan1104-hash.github.io/local-mindmap/
```

## 本次新增功能

- 新增节点类型包导出：在“节点类型”面板可将当前本地自定义节点类型导出为 `local-mindmap-node-types.json`。
- 新增节点类型包导入：可导入符合格式的节点类型包 JSON，并持久化到 localStorage 本地节点类型库。
- 新增模板包导出：在“模板库”面板可将当前本地自定义模板导出为 `local-mindmap-templates.json`。
- 新增模板包导入：可导入符合格式的模板包 JSON，并持久化到 localStorage 本地模板库。
- 新增共享包体验收口：优化非法包、空包、重复包和冲突包提示。
- 新增共享包说明文档：`docs/share-packs.md`。

## 节点类型包

节点类型包用于分享自定义节点类型配置，不包含导图节点树，不包含 `rootNode`。

```json
{
  "version": "1.0",
  "kind": "local-mindmap-node-type-pack",
  "meta": {
    "name": "节点类型包名称",
    "description": "节点类型包说明",
    "createdAt": "ISO 时间",
    "source": "local-mindmap"
  },
  "nodeTypes": []
}
```

导入后，节点类型可立即用于新建节点和切换已有节点类型。

## 模板包

模板包用于分享本地自定义模板库，不等同于 `.lmind` 文件，也不用于分享当前打开的完整导图文件。

```json
{
  "version": "1.0",
  "kind": "local-mindmap-template-pack",
  "meta": {
    "name": "模板包名称",
    "description": "模板包说明",
    "createdAt": "ISO 时间",
    "source": "local-mindmap"
  },
  "templates": []
}
```

导入后，模板可立即用于从模板库新建导图。模板包会保留模板已有的 `rootNode`、`nodeTypes`、`themeId` 等字段，以便从模板新建时恢复结构、节点类型和主题。

## 冲突处理

- ID 相同且内容相同：跳过，计入重复数量。
- ID 相同但内容不同：自动生成 `原ID-imported-N`。
- name 相同但 ID 不同：允许导入，并在导入结果中提示同名数量。
- 缺少必要字段：跳过，并计入无效条目数量。

## 错误提示优化

- 非法 JSON 文件提示“文件不是有效 JSON”。
- 节点类型包 kind 不匹配提示“这不是有效的节点类型包”。
- 模板包 kind 不匹配提示“这不是有效的模板包”。
- 空节点类型包提示“未找到可导入的节点类型”。
- 空模板包提示“未找到可导入的模板”。
- 导入结果统一显示成功导入、跳过重复、重命名冲突和无效条目数量。

## 安全说明

- 节点类型包和模板包都是本地 JSON 配置。
- 共享包不执行第三方 JavaScript。
- 共享包导入导出不上传文件。
- 共享包不依赖云同步。
- 当前不包含用户账号、团队权限、协同编辑或远程市场。
- 共享包不等于 `.lmind` 文件。
- `.lmind` 文件结构保持兼容，保存 / 打开逻辑不变。
- 当前仍是完全本地运行工具。

## 数据安全

- 不上传用户文件、节点文本、备注、模板、节点类型、插件配置或操作数据。
- 不强制联网。
- 不引入云同步、用户登录或权限系统。
- 插件系统仍不执行第三方 JavaScript，不使用 `eval` 或 `new Function`。

## 本地运行

```bash
npm install
npm run dev
```

通常打开：

```text
http://localhost:5173/
```

## 构建方式

```bash
npm run build
```

构建产物输出到 `dist/`，可用于 GitHub Pages 静态部署。

## 测试方式

```bash
npm run test
```

v1.3 自动化测试覆盖节点类型包、模板包、非法 kind、非法 JSON、空包、重复导入和冲突重命名。

## 已知限制

- 共享包导入后仅保存到当前浏览器 localStorage。
- 换浏览器、换设备或清空站点数据后，需要重新导入共享包。
- 当前没有云同步、用户登录、团队权限、远程市场或协同编辑。
- 当前不包含 PDF / SVG / 打印 / 演示模式。
- 当前不恢复兄弟节点拖拽排序。
- Vite 仍可能提示主 chunk 超过 500 kB，这是体积提醒，不是构建错误。
- Tauri 桌面安装包不在本次 v1.3.0 发布范围内。

## 后续计划

- 补充更完整的浏览器端到端自动化测试。
- 在 Chrome / Edge 和不同分辨率下继续做手动回归。
- 后续评估共享包端到端导入导出测试夹具。
- 后续继续桌面端真实安装包和跨平台打包验证。
