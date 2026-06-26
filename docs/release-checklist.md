# v1.4.0 Release 发布检查清单

更新日期：2026-06-26

## 1. 发布前检查

- [ ] 当前分支为 `v1.4-dev`。
- [ ] 发布版本号为 `1.4.0`。
- [ ] `package.json` 版本为 `1.4.0`。
- [ ] `package-lock.json` 根版本为 `1.4.0`。
- [ ] `src-tauri/tauri.conf.json` 版本为 `1.4.0`。
- [ ] `src-tauri/Cargo.toml` 版本为 `1.4.0`。
- [ ] `src-tauri/Cargo.lock` 中 `local-mindmap` 版本为 `1.4.0`。
- [ ] `.lmind` 基础结构未改变，旧文件可继续打开。
- [ ] 未新增云同步、用户登录、在线配置、远程插件市场或用户数据上传能力。
- [ ] 未加载 DLL、未执行 DLL、未执行第三方代码。

## 2. 必跑命令

```bash
npm run build
npm run test
npm run tauri:dev
npm run tauri:build
git status --short
```

- [ ] `npm run build` 通过。
- [ ] `npm run test` 通过。
- [ ] `npm run tauri:dev` 通过，可启动桌面应用。
- [ ] `npm run tauri:build` 通过。
- [ ] 如出现 Vite chunk 体积提醒，记录为已知提醒，不作为阻断错误。

## 3. 构建产物检查

- [ ] Windows MSI 安装包生成成功。
- [ ] Windows NSIS setup.exe 生成成功。
- [ ] 安装包文件名体现 `1.4.0`。
- [ ] 构建产物不提交 Git。
- [ ] `dist/` 不提交 Git。
- [ ] `src-tauri/target/` 不提交 Git。
- [ ] `target/` 不提交 Git。
- [ ] `node_modules/` 不提交 Git。
- [ ] `.msi`、`.exe`、`.pdb`、`.rlib`、`.rmeta` 不提交 Git。

Windows 预期产物路径：

```text
src-tauri/target/release/local-mindmap.exe
src-tauri/target/release/bundle/msi/Local Mindmap_1.4.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Local Mindmap_1.4.0_x64-setup.exe
```

## 4. v1.4 桌面能力回归

- [ ] 桌面 Native 插件区域可以显示。
- [ ] 桌面插件目录可以获取。
- [ ] 桌面配置目录可以获取。
- [ ] 可以安装 Native manifest。
- [ ] 可以扫描 Native manifest。
- [ ] 可以启用 / 禁用 Native manifest。
- [ ] 可以卸载 Native manifest。
- [ ] 非法 Native manifest 不会导致应用崩溃。
- [ ] 没有 DLL 文件也不会崩溃。
- [ ] Web / GitHub Pages 环境下桌面 Native 插件能力安全降级，不崩溃。
- [ ] 普通 Web JSON 插件不受影响。

## 5. 既有功能回归

- [ ] 新建思维导图。
- [ ] 新增子节点 / 同级节点。
- [ ] 删除节点和批量删除。
- [ ] 编辑节点文本。
- [ ] 左到右自动布局和重新自动布局。
- [ ] 节点折叠 / 展开、展开全部 / 折叠全部。
- [ ] 节点自由拖拽 position、保存 / 打开恢复。
- [ ] 中心主题可以向左 / 向上拖动。
- [ ] Ctrl / Shift 多选节点。
- [ ] Ctrl+A 全选节点。
- [ ] Esc 清空选择 / 关闭弹窗。
- [ ] Shift + 空白拖动框选节点。
- [ ] 普通空白拖动画布平移。
- [ ] 框选后旧选中节点不残留。
- [ ] 点击空白处不会默认选中中心主题。
- [ ] 多选普通节点不会自动带上中心主题。
- [ ] 框选视觉区域与实际命中一致。

## 6. v1.2 编辑效率回归

- [ ] Ctrl+C 复制节点。
- [ ] Ctrl+X 剪切节点。
- [ ] Ctrl+V 粘贴节点。
- [ ] Ctrl+D 复制为同级节点。
- [ ] 复制完整子树。
- [ ] root 节点不能剪切。
- [ ] 粘贴节点 ID 不重复。
- [ ] 撤销 / 重做正常。
- [ ] 拖拽调整父子层级正常。
- [ ] 拖拽层级调整不会产生循环结构。

## 7. v1.3 共享能力回归

- [ ] 节点类型包可导出。
- [ ] 节点类型包可导入。
- [ ] 模板包可导出。
- [ ] 模板包可导入。
- [ ] 重复 ID / 冲突 ID / 非法 JSON 有明确提示。
- [ ] Web JSON 插件启用 / 禁用 / 卸载正常。
- [ ] 自定义节点类型正常。
- [ ] 自定义模板正常。

## 8. 导入导出回归

- [ ] `.lmind` 保存 / 打开正常。
- [ ] Markdown 导入 / 导出正常。
- [ ] Excel 导入 / 导出正常。
- [ ] Excel 列映射导入正常。
- [ ] JSON 导入 / 导出正常。
- [ ] PNG / JPG 导出正常。
- [ ] TXT 插件导出正常。

## 9. 其他模块回归

- [ ] Markdown 备注编辑、实时预览、放大预览正常。
- [ ] 查找替换正常。
- [ ] 模板库和官方模板正常。
- [ ] 自定义节点类型正常。
- [ ] 主题切换正常。
- [ ] 插件管理正常。
- [ ] 性能测试工具正常。
- [ ] GitHub Pages 静态构建不受影响。
- [ ] Tauri 桌面端构建不受影响。
- [ ] 无明显 UI 溢出或布局错乱。

## 10. 发布文档

- [ ] `README.md` 已更新。
- [ ] `docs/project-status.md` 已更新。
- [ ] `docs/next-task.md` 已更新。
- [ ] `docs/acceptance-test-checklist.md` 已更新。
- [ ] `docs/desktop-app-roadmap.md` 已更新。
- [ ] `docs/desktop-plugin-system.md` 已更新。
- [ ] `docs/desktop-deployment-guide.md` 已更新。
- [ ] `docs/desktop-local-config.md` 已更新。
- [ ] `docs/release-notes-v1.4.0-draft.md` 已完成。

## 11. 发布步骤建议

```bash
git status --short
npm run build
npm run test
npm run tauri:dev
npm run tauri:build
git status --short
git add .gitignore README.md docs package.json package-lock.json src src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json src-tauri/src/main.rs
git commit -m "release: prepare v1.4.0"
git push origin v1.4-dev
```

发布后：

- [ ] 创建或更新 GitHub PR，目标分支为 `main`。
- [ ] 确认 CI / GitHub Pages 构建通过。
- [ ] 合并到 `main` 后创建 `v1.4.0` tag。
- [ ] 基于 `docs/release-notes-v1.4.0-draft.md` 创建 GitHub Release。
- [ ] 将 MSI / NSIS 安装包作为 Release 附件或交给内网分发流程。

## 12. 已知风险

| 风险 | 影响 | 处理建议 |
|---|---|---|
| Vite 主 chunk 超过 500 kB | 首次加载可能受影响 | 后续评估代码分包 |
| 自动化测试以单元和核心逻辑为主 | 完整浏览器交互仍需手动回归 | 按验收清单执行关键流程 |
| v1.4 只管理 Native manifest | 不加载 DLL，Native 插件不能实际执行能力 | v1.5 再评估 Windows DLL 插件实验版 |
| Tauri 打包工具可能在线下载 WiX / NSIS | 内网构建机可能无法联网下载 | 预安装、预缓存或配置可信内网镜像 |
| `identifier` 以 `.app` 结尾 | Tauri 提示 macOS 不推荐 | 后续跨平台打包前评估是否调整 |
