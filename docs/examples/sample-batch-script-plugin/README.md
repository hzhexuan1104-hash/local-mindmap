# 批量脚本插件示例

这是 v1.8 第二批脚本 API 示例。它同时贡献顶部插件菜单和节点右键菜单，
对运行时选中的节点返回一个 `addChildNodes` action，一次新增三个子节点。

导入前请选择本目录的 `manifest.json`。脚本运行器默认关闭；启用后，首次执行
请求写权限且尚未信任的插件会显示确认提示。

脚本不能访问文件系统、网络、DOM、Tauri API 或 React state，只能读取 JSON
context snapshot 并返回由宿主校验的 Plugin Actions。
