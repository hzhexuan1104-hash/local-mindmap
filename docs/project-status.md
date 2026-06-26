# 项目状态

更新时间：2026-06-25

当前版本：v1.4.0 发布前收尾版

## v1.0.0 已完成

- React + TypeScript + Vite 基础工程。
- 基础节点新增、删除、编辑、子节点、同级节点。
- 节点文本自动换行和左到右自动布局。
- `.lmind` 保存和打开，文件内容为标准 JSON。
- Markdown 备注、实时预览、预览模式和独立放大预览。
- Markdown / Excel / JSON 导入导出，Excel 导入列映射，PNG/JPG 图片导出。
- 全局查找替换、撤销 / 重做、画布缩放、平移、一键居中、节点折叠 / 展开。
- 模板管理增强和 8 个官方默认模板。
- 自定义节点类型、5 套主题、插件管理系统基础版、TXT 导出插件。
- 100 / 500 / 1000 节点性能压测工具。
- Vitest 自动化测试基础。
- GitHub Pages 部署、Release 检查文档和 v1.0.0 发布说明。

## v1.1 第一批已完成

- 新增 Tauri v2 最小桌面端配置：
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/build.rs`
  - `src-tauri/src/main.rs`
- 新增 npm 脚本：
  - `npm run tauri:dev`
  - `npm run tauri:build`
- 保留 Vite + React Web 架构，Web 开发、Web 构建和 GitHub Pages 静态部署方式不变。
- 新增节点拖拽自由布局基础版：
  - 节点支持鼠标拖拽。
  - 拖拽时节点位置和 SVG 连线实时更新。
  - 拖拽后保存 `position?: { x: number; y: number }`。
  - 缩放和平移状态下按当前缩放比例换算拖拽坐标。
- 新增重新自动布局：
  - 顶部视图区域和画布右键菜单均提供“重新自动布局”。
  - 操作会清除节点 `position`，恢复左到右自动布局。
  - 操作进入撤销 / 重做历史，不改变折叠状态。
- 新增多选节点基础版：
  - Ctrl + 点击、Shift + 点击追加选择。
  - 多选节点有独立高亮样式。
  - 支持批量删除，多个节点删除前二次确认。
  - 支持批量切换节点类型。
  - root 节点不允许被批量删除。
- 新增右键菜单基础版：
  - 节点右键菜单支持新增子节点、新增同级节点、编辑、删除、复制文本、折叠/展开、切换节点类型、重新自动布局。
  - 画布右键菜单支持新建、一键居中、重新自动布局、展开全部、折叠全部、导出 PNG/JPG。
  - 支持点击菜单项、点击其他区域和 Esc 关闭。
- UI 小幅优化：
  - 顶部按钮按文件、导入导出、工具分组。
  - 工具区域可换行，避免撑破页面。
  - 画布区域更突出，备注面板支持滚动。
  - 统一右键菜单、多选、拖拽反馈样式。
- 自动化测试已补充：
  - `position` 打开兼容。
  - `position` 序列化。
  - 无 `position` 自动布局。
  - 重新自动布局清除 `position`。
  - 多选纯函数。

## v1.1.1 UI 信息架构优化已完成

- 顶部导航压缩：
  - 顶部保留“新建思维导图”“保存 .lmind”“打开 .lmind”高频入口。
  - 文件、导入导出、编辑、视图、工具操作进入分组菜单。
  - 导入导出菜单保留 JSON / Markdown / Excel / PNG / JPG / TXT 相关入口。
- 非高频功能改为左侧工具栏抽屉：
  - 模板库。
  - 节点类型。
  - 查找替换。
  - 性能测试。
  - 插件管理。
  - 快捷键帮助。
- 主画布区域扩大：
  - 默认页面不再长期展开性能测试、查找替换、模板和节点类型表单。
  - 画布工具改为画布内部悬浮工具条，包含缩放、一键居中、重新自动布局和主题选择。
- 右侧备注面板支持折叠：
  - 折叠后画布自动变宽。
  - 折叠状态仅为 UI 状态，不写入 `.lmind`。
- 新增专注模式：
  - 隐藏顶部、左侧工具栏和备注面板。
  - 保留画布悬浮工具条和退出专注模式入口。
  - 不改变导图数据结构。

## v1.2 第一批已完成

- 新增节点复制 / 剪切 / 粘贴基础能力：
  - 支持复制当前主选中节点或多个选中节点。
  - 复制内容包含完整子树、节点文本、备注、子节点、节点类型、折叠状态和可选 `position`。
  - 内部剪贴板仅保存在应用运行状态中，不写入 `.lmind` 文件。
  - root 节点可以复制，但粘贴后作为普通子节点，不覆盖中心主题。
- 新增节点剪切：
  - root 节点不能剪切。
  - 多选中包含 root 时自动跳过 root。
  - 剪切采用延迟删除：粘贴成功后从原位置移除，并作为一次粘贴操作进入撤销 / 重做历史。
- 新增节点粘贴：
  - 支持 Ctrl+V 和右键菜单粘贴。
  - 默认粘贴到当前主选中节点下；无有效选中节点时粘贴到 root。
  - 粘贴时重新生成所有节点 ID，避免重复 ID 和循环结构。
  - 目标节点有 `position` 时，新节点靠近目标节点右侧；目标节点无 `position` 时交给自动布局处理。
  - 粘贴后选中新粘贴的节点。
- 新增复制为同级节点：
  - 非 root 节点复制后插入同一父节点下。
  - root 节点复制后作为 root 的子节点。
  - 操作进入撤销 / 重做历史。
- 新增入口：
  - 顶部编辑菜单：复制节点、剪切节点、粘贴节点、复制为同级节点。
  - 节点右键菜单：复制节点、剪切节点、粘贴为子节点、复制为同级节点。
  - 画布右键菜单：粘贴到中心主题、清空内部剪贴板。
  - 快捷键：Ctrl+C、Ctrl+X、Ctrl+V、Ctrl+D。
- 自动化测试已补充：
  - 完整子树复制和 ID 重建。
  - 节点文本、备注、节点类型、折叠状态和 `position` 保留。
  - 多节点粘贴、复制为同级节点、root 剪切保护。
  - 重复 ID 和循环结构校验。

## v1.2 第二批已完成

- 新增框选节点基础版：
  - 当前入口为 Shift + 画布空白区域拖动，超过阈值后显示半透明框选矩形。
  - 普通画布空白区域拖动用于平移画布。
  - 框选命中节点后更新 `selectedNodeIds`，备注面板显示最后一个被选中的主节点。
  - Shift 框选用于进入框选模式，框选结果会替换当前选择，避免旧节点残留。
  - 框选命中计算支持当前画布缩放和位移。
  - 节点拖拽、右键菜单、顶部工具、左侧工具栏和备注面板不会触发框选。
- 新增 Ctrl+A 全选节点：
  - 非输入状态下选中当前导图所有节点。
  - 输入框、备注 textarea、select 和可编辑元素内不拦截浏览器默认 Ctrl+A。
  - 全选后仍可批量删除普通节点、批量切换节点类型和复制节点，root 删除保护继续生效。
- 统一 Esc 行为：
  - 优先关闭 Excel 导入弹窗、插件管理弹窗和快捷键帮助弹窗。
  - 其次关闭右键菜单。
  - 框选中按 Esc 取消框选。
  - 无弹窗、菜单和框选时清空当前选择，不再默认选中中心主题。
- 快捷键帮助完善：
  - 左侧工具栏和工具菜单均可打开快捷键帮助弹窗。
  - 弹窗列出撤销、重做、复制、剪切、粘贴、复制为同级、全选、保存、打开、删除、Esc、框选追加和缩放快捷键。
  - 支持 Esc 关闭和关闭按钮关闭。
- 自动化测试已补充：
  - 框选矩形计算、反向拖动、节点命中、zoom / pan 坐标换算、Shift 追加选择。
  - Ctrl+A、Ctrl+S、Ctrl+O、Delete / Backspace 和 Esc 快捷键行为。
  - 输入状态下不拦截 Ctrl+A。

## v1.2 第三批已完成

- 新增拖拽调整父子层级基础版：
  - 普通节点拖拽仍会实时更新 `position`，保留 v1.1 自由布局能力。
  - 拖拽释放点落在另一个有效节点矩形附近时，被拖拽节点会移动为目标节点的子节点。
  - 拖拽过程中仅显示候选目标高亮，松开鼠标时才调整树结构。
  - root 中心主题不能被移动为其他节点的子节点。
  - 不允许移动到自己或自己的子孙节点下，避免循环结构。
  - 不执行兄弟节点拖拽排序，不做复杂智能排版。
- 新增树结构安全纯函数：
  - 支持父节点查找、子孙关系判断、移除节点、插入为子节点、移动为子节点。
  - 移动后保留节点 id、text、remark、nodeTypeId、collapsed、position 和完整子树。
  - 移动后校验 root 存在、ID 不重复、对象不被多个父节点复用。
- 自动化测试已补充：
  - root 保护、禁止移动到自己和子孙节点下。
  - 普通节点移动到目标 children 下、原父节点移除。
  - 节点字段保留、重复 ID 和非法结构识别。

## 本次验证结果

- v1.1.1：`npm run build` 通过。
- v1.1.1：`npm run test` 通过。
- v1.1.1：本地页面可打开，默认画布高度约占浏览器可视区域 74%。
- v1.1.1：左侧抽屉、备注折叠和专注模式已完成浏览器快速验证。
- v1.2.0 发布准备：`npm run build` 通过。
- v1.2.0 发布准备：`npm run test` 通过。
- v1.3.1 补丁发布准备：版本号已升级到 `1.3.1`，`package-lock.json` 已同步。
- Vite 仍提示主 chunk 超过 500 kB，这是体积提醒，不是构建错误。
- `npm run tauri:build` 未通过：当前环境缺少 Rust / Cargo，`cargo` 和 `rustc` 均不在 PATH。
- Vite 仍提示主 chunk 超过 500 kB，这是体积提醒，不是构建错误。

## 安全状态

- 未新增云端服务。
- 未新增用户登录或云同步。
- 未上传用户文件、节点文本、备注、模板、插件配置或操作数据。
- v1.2 内部剪贴板不保存到 `.lmind`，不上传、不写入 localStorage。
- v1.2 框选状态和快捷键帮助弹窗状态不保存到 `.lmind`，不上传、不写入 localStorage。
- Tauri 最小壳只加载本地 Vite 应用或 `dist/` 产物。
- 插件系统仍不执行第三方 JavaScript，不使用 `eval` 或 `new Function`。
- 浏览器版保存、打开、导入、导出仍走本地文件能力。
- v1.3 共享包只保存本地 JSON 配置，不执行第三方 JavaScript，不上传文件，不依赖云同步。
- 节点类型包和模板包不等同于 `.lmind` 文件，`.lmind` 基础结构保持兼容。

## 待确认 / 后续

- 安装 Rust / Cargo 后，需要在 Windows 上重新验证 `npm run tauri:dev` 和 `npm run tauri:build`。
- 需要在 macOS、Linux、统信 UOS、银河麒麟及国产 CPU 架构上验证 Tauri 运行时和 WebView 依赖。
- v1.2 第三批只实现拖拽调整父子层级基础版，不实现兄弟节点拖拽排序、批量层级调整或复杂智能排版。
- v1.2 第二批只实现框选基础版，不实现框选后的批量移动或批量样式编辑增强。
- v1.2 仍不实现复杂智能排版、左右双向布局、鱼骨图、PDF 导出、云同步、协同编辑或插件市场。

## v1.3-dev 节点类型共享基础版

- 已新增独立节点类型包 JSON 格式，`kind` 固定为 `local-mindmap-node-type-pack`。
- 已新增节点类型包导出入口，导出的 JSON 只包含 `version`、`kind`、`meta`、`nodeTypes`，不包含 `rootNode` 或任何导图节点内容。
- 已新增节点类型包导入入口，导入后持久化到 localStorage 本地节点类型库，并可立即用于新建节点和切换节点类型。
- ID 冲突采用保守策略：相同 ID 且内容相同跳过；相同 ID 但内容不同自动生成 `原ID-imported-N`；同名不同 ID 允许导入并在结果提示中计数。
- `.lmind` 保存 / 打开结构未调整，`.lmind` 内已有 `nodeTypes` 继续随文件保留。
- 当前仍不包含云同步、用户登录、远程节点类型市场或权限系统，不执行第三方 JavaScript。

## v1.3-dev 模板包导入 / 导出基础版

- 已新增独立模板包 JSON 格式，`kind` 固定为 `local-mindmap-template-pack`。
- 已新增模板包导出入口，导出的 JSON 只包含 `version`、`kind`、`meta`、`templates`，用于分享本地自定义模板库。
- 已新增模板包导入入口，导入后持久化到 localStorage 本地模板库，并可立即从模板库中新建导图。
- 模板包不是 `.lmind` 文件，不用于打开或覆盖当前完整导图；导入模板包不会修改当前 `rootNode`。
- 模板包会保留模板已有的 `rootNode`、`nodeTypes`、`themeId` 等字段，以便从模板新建导图时恢复模板结构和节点类型信息。
- 模板 ID 冲突采用保守策略：相同 ID 且内容相同跳过；相同 ID 但内容不同自动生成 `原ID-imported-N`；同名不同 ID 允许导入并在结果提示中计数。
- 节点类型包和模板包保持独立，不改变 `.lmind` 基础结构。
- 当前仍不包含云同步、用户登录、远程模板市场或权限系统，不执行第三方 JavaScript。

## v1.3-dev 共享包体验收口

- 已统一节点类型包和模板包导入结果提示，均显示成功导入、跳过重复、重命名冲突和无效条目数量。
- 已优化非法包提示：非法 JSON 显示“文件不是有效 JSON”，kind 不匹配时区分“这不是有效的节点类型包”和“这不是有效的模板包”。
- 已优化空包提示：空 `nodeTypes` 包显示“未找到可导入的节点类型”，空 `templates` 包显示“未找到可导入的模板”。
- 已新增 `docs/share-packs.md`，说明节点类型包、模板包、与 `.lmind` 的区别、导入导出流程、冲突处理和安全边界。
- 当前仍保持完全本地运行，不新增云同步、用户登录、远程市场、权限系统或第三方 JavaScript 执行。
- `package.json` 和 `package-lock.json` 版本已同步为 `1.3.1`。

## v1.3-dev 画布框选与平移交互修复

- 已将画布空白区域普通左键拖拽调整为平移画布，避免与框选入口冲突。
- 已将框选入口调整为 Shift + 画布空白区域左键拖拽，框选结果替换当前选择；节点点击、Ctrl / Shift 多选、节点自由拖拽和拖拽调整父子层级保持原有逻辑。
- 已将框选命中规则改为节点中心点在框选矩形内才选中，减少选择框边缘擦到其他节点时的误选。
- 已补充浏览器原生文字选区保护，框选、节点拖拽和平移过程中阻止默认文本选择，输入框、备注编辑器和可编辑区域仍保留文本选择。
- 已补充 `boxSelection.test.ts` 覆盖中心点命中、zoom / pan 坐标换算、Shift 框选、普通拖拽平移入口和交互目标屏蔽。
- 已修复 root / 中心主题向左或向上拖动被布局 padding 归一化卡住的问题，root 和普通节点 position 均可保存负坐标。
- root 结构保护继续生效：root 不能被删除或拖为其他节点子节点，但可以自由更新 position。
- 已修复非 Shift 框选后旧 `selectedNodeId` 残留导致框外节点继续高亮的问题，主选节点会始终落在 `selectedNodeIds` 内或为空。
- 已将点击画布空白区域调整为清空选择，中心主题不会被自动加入后续多选集合。
- 已统一框选视觉矩形和命中计算的坐标转换，缩放、平移和滚动后框选命中与半透明框保持一致。
# v1.4-dev 第一批：桌面端本地应用化 + Native 插件体系底座

更新日期：2026-06-26

- 已明确后续主线以 Tauri 桌面端本地应用为主，Web / GitHub Pages 仅作为演示或开发预览。
- 已将 `src-tauri/tauri.conf.json` 版本同步到 `package.json` 当前版本；发布收尾阶段已升级到 `1.4.0`。
- 已新增桌面插件目录能力，目录由 Tauri 应用数据目录解析并自动创建，插件位于 `plugins/plugin-id/manifest.json`。
- 已新增 Native manifest 校验，支持 `manifestVersion`、`pluginId`、`name`、`version`、`pluginType: native`、`entry`、`capabilities`、`abi` 声明。
- 已新增桌面插件扫描、manifest 安装、启用、禁用、卸载 Tauri commands。
- 已新增 `desktop-plugin-registry.json` 保存启用状态，不直接修改用户原始 manifest。
- 已在插件管理面板中新增“桌面 Native 插件”区域；非 Tauri 环境显示“桌面插件仅在桌面端可用”。
- 已保留 Web JSON 插件、节点类型包、模板包和 `.lmind` 基础结构。
- v1.4 当前严格不加载 DLL、不执行 DLL、不执行第三方代码。
- `npm run build` 已通过；`npm run test` 已通过。
- `npm run tauri:dev` 已在后续修复中通过；`npm run tauri:build` 在第二批中继续验证。

## v1.4-dev 第一批修复补充

更新日期：2026-06-26

- 已将前端桌面 Native 插件功能通过 `@tauri-apps/api/core` 的 `invoke` 接入 Tauri commands。
- 已修复 Windows 下 Vite 监听 `src-tauri/target` 导致 Rust 构建产物被占用并触发 `EBUSY` 的问题。
- 已补齐 `src-tauri/icons/icon.ico`，解决 Windows Resource 生成阶段 `icons/icon.ico not found`。
- `npm run tauri:dev` 已可进入 Tauri/Rust 构建并启动桌面应用。

## v1.4-dev 第二批：桌面本地配置与内网分发准备

更新日期：2026-06-26

- 已明确桌面配置目录位于 Tauri app data dir 下的 `config`，插件目录继续位于同一 app data dir 下的 `plugins`。
- 已新增最小 Tauri commands：`get_desktop_config_dir` 和 `ensure_desktop_config_dir`。
- 已新增前端 `desktopConfig.ts` 包装，非 Tauri Web 环境返回 unavailable，不影响 Web / GitHub Pages。
- 已新增 `docs/desktop-local-config.md`，记录 `config/app-settings.json` registry 草案和 localStorage 迁移路线。
- 已新增 `docs/desktop-deployment-guide.md`，记录 Windows 内网分发方式、断网使用说明、数据保存位置和 `tauri:build` 验证规则。
- 已完成 Windows 本机 `npm run tauri:build` 验证，生成 MSI 和 NSIS setup exe；构建产物位于 `src-tauri/target/`，不得提交。
- 本批不迁移全部 localStorage，不修改 `.lmind` 基础结构，不加载 DLL，不执行 DLL，不执行第三方代码。

## v1.4.0 发布前收尾

更新日期：2026-06-26

- 已将 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 同步到 `1.4.0`。
- `src-tauri/Cargo.lock` 已随 Cargo 元数据同步到 `local-mindmap 1.4.0`。
- 发布目标仍是 Tauri 桌面端本地应用；Web / GitHub Pages 仅作为演示和开发预览。
- v1.4.0 发布包聚焦桌面 Native 插件 manifest 管理、本地配置目录、内网分发准备和 Windows 安装包验证。
- 仍不加载 DLL、不执行 DLL、不执行第三方代码，不修改 `.lmind` 基础结构。
