# 2026-09-24 文档截图优化验收

依据用户提供的《新建 DOC 文档.doc》中的 10 项优化点（12 张图片），在本地提取并核对；未上传文件或图片。

## 实现结果

| 优化点 | 实现 | 相关需求 |
| --- | --- | --- |
| 1 | 修正节点图标、字号下拉框悬停/聚焦后箭头铺满和重叠；增加文字与箭头的间距 | MAP-012、UX-003 |
| 2 | Markdown 表格恢复原生表格布局，列宽随侧栏和放大窗口变化，长文本在单元格内换行 | REMARK-004、REMARK-006 |
| 3 | 预览通过 Portal 放到页面顶层，遮罩覆盖菜单；背景不可交互，支持 Esc 关闭和焦点恢复 | REMARK-008 |
| 4 | 侧栏收起按钮和视图菜单统一命名为“备注” | UX-003 |
| 5 | 节点编辑支持 Shift+Enter 插入换行；Enter 提交，展示时保留换行 | MAP-003、REMARK-009、REMARK-010 |
| 6 | 仅当前搜索定位节点显示搜索圈选；首次下一项定位第一处匹配 | SEARCH-002、SEARCH-003 |
| 7 | 操作提示独立显示在窗口底部中央，14px 字号，按类型增加颜色与符号，窄窗口可见；警告/错误延长至 5 秒 | UX-004 |
| 8 | 无需先查找即可单次替换，并展开、选中、居中被替换节点；再次替换沿匹配游标继续；分支范围固定，全部替换尊重当前范围 | SEARCH-007、SEARCH-008 |
| 9 | 放大预览增加上一/下一同级节点按钮，首尾禁用，根节点无同级时均禁用；切换后正文回到顶部 | REMARK-008 |
| 10 | 预览分为“节点内容”和“备注内容”，标题采用独立浅色区域，长标题限制高度并可滚动 | REMARK-008 |

## 修改文件

- `src/app/App.tsx`：节点换行、搜索替换、定位、备注入口、同级节点传递。
- `src/app/components/RightInspectorPanel.tsx`：向备注预览传递同级节点和导航回调。
- `src/app/components/TopMenuBar.tsx`：提示通过 Portal 独立显示，状态和警告具有对应可访问性角色。
- `src/features/mindmap/RemarkPanel.tsx`：连接放大预览导航。
- `src/features/mindmap/remarkPreview.tsx`：预览层级、焦点管理、同级切换、内容分区。
- `src/features/mindmap/searchReplace.ts`：单次替换后的剩余匹配状态。
- `src/styles/global.css`：下拉框、表格、预览、换行、操作提示样式。
- `src/app/components/__tests__/NodeQuickToolbar.test.tsx`：原有样式断言兼容 Windows CRLF。
- `scripts/qa/screenshot-feedback.cjs`：浏览器回归，覆盖换行、下拉箭头、表格宽度、预览导航、折叠分支直接替换、连续替换、单节点圈选和窄窗口提示。
- `docs/requirement-matrix.md`：登记此次增量验收。
- `docs/screenshot-feedback-2026-09-24.md`：本记录。

## 测试

- `npm test -- --reporter=dot`：58 个测试文件、534 项测试通过。
- `npm run build`：TypeScript 和 Vite 生产构建通过。
- `node scripts/qa/screenshot-feedback.cjs`：Windows Edge 浏览器回归通过，无页面运行时异常。

浏览器回归需先运行 `npm run dev -- --host 127.0.0.1`，并使用已有的 Playwright：

```powershell
$env:PLAYWRIGHT_PATH = 'C:/Users/11624/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/qa/screenshot-feedback.cjs
```

可通过 `QA_URL`、`QA_OUTPUT_DIR`、`QA_BROWSER_CHANNEL` 指定本地预览地址、截图目录和浏览器。默认截图写入临时目录。

## 范围与限制

本次文档 10 项优化已完成。未进行安装包生成、Windows 原生 WebView2 实机验收、macOS/信创平台验收或 24 小时长稳测试；不将它们标记为已完成。构建仍存在已有的大包体积与混合静态/动态导入警告。工作区原有 `src-tauri/Cargo.toml` 变更未由本次任务修改。
