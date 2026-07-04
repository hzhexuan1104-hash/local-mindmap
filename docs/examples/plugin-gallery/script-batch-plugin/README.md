# 批量脚本插件

本示例通过 Web Worker 受控脚本运行器读取 JSON context snapshot，并返回一个
`addChildNodes` action。宿主会先校验完整 action 批次，再修改导图。

脚本插件是实验能力，安装不会启用脚本运行器，也不会自动获得信任。启用运行器后，
首次执行写入动作仍会显示权限确认。脚本运行环境不提供 DOM、Tauri API、文件系统或
网络 API。
