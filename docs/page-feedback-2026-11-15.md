# 页面优化建议落实记录（2026-11-15）

来源：本地《页面优化建议.doc》。本次落实文档中的四项页面建议。

- 插件管理分类采用页签外观，选中项有背景、底部指示线及键盘焦点提示。
- 两个运行器开关位于标题文字前面。
- 运行器标题使用较大黑色文字，说明使用较小灰色文字并紧邻标题。
- 已安装插件详情使用卡片完整宽度；商城卡片展开详情时跨满网格。
- 明确隐藏分区的 display，防止 grid 样式覆盖 hidden。

修改文件：src/features/mindmap/PluginManagerPanel.tsx、src/styles/global.css、本文、docs/requirement-matrix.md。

验证：npm test -- --reporter=dot（60 个测试文件、548 项测试通过）；npm run build（通过，存在包体积提示）；git diff --check（通过）。

完成范围：上述四项页面优化，对应 UX-003 的交互易用性增量。
未完成验证：桌面端视觉人工验收、macOS 和信创实机验证。此次不代表全部 P0/P1 需求验收完成。

## 页签切换显示修复

截图反馈：已安装插件和插件商城内容较长时，导航文字被裁切，选中底线穿过文字。
原因：纵向 Flex 弹窗内导航允许收缩，且 overflow-x:auto 使其成为可压缩滚动区域。
修复：标题和导航禁止收缩，内容区设置 flex:1 1 auto 和 min-height:0；导航禁止垂直滚动，文字不换行并设置明确行高。
本次修改：src/styles/global.css、本文。
验证：npm test -- --reporter=dot（60 个文件、548 项通过）；npm run build（通过，仍有包体积提示）；git diff --check（通过）。
已完成：页签高度与滚动区域的布局修复。未完成：实际桌面窗口的视觉复验。
