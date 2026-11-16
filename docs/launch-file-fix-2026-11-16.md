# LMIND 文件关联修复（2026-11-16）

原因：Windows 文件关联指向 2026-09-29 的旧安装程序；新代码启动时又把空白导图设为未保存，触发替换确认；草稿恢复弹窗会遮挡启动文件。

修改文件：
- src/app/App.tsx：初始空白导图无修改，指定文件启动时收起恢复面板。
- src-tauri/src/main.rs：启动参数调用独立解析模块。
- src-tauri/src/launch_file.rs：解析中文、空格、大写扩展名；缺失文件保留路径以显示打开错误。
- src-tauri/tauri.conf.json：声明 .lmind 关联。
- src/features/mindmap/__tests__/tauriConfigAssets.test.ts：文件关联配置回归。
- docs/requirement-matrix.md、本文：验收记录。

测试命令：npm test -- --reporter=dot（553 项通过）；cargo test --manifest-path src-tauri/Cargo.toml --offline（68 项通过）；npm run tauri:build -- --no-bundle（生产程序构建）。

已更新 Windows 当前关联指向的安装程序；保留 local-mindmap.before-launch-fix-20261115.exe 备份。用户导图内容未修改。

完成范围：Windows 冷启动文件接收与打开。未验收：macOS/信创文件关联、安装包安装过程。

桌面复验（2026-11-16）：通过 Windows Shell 的 .lmind 文件关联启动中文且含空格文件名。UI 显示“文件关联 验证.lmind · 已保存”、根节点“文件关联验证：已有内容”及子节点“子节点也已恢复”；无替换确认和恢复面板遮挡。最终生产构建通过并已更新安装程序。
