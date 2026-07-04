# Python 关键词插件

本示例从 stdin 读取 UTF-8 context JSON，从选中节点标题提取关键词，并向 stdout
输出 `{"actions": [...]}`。中文输出使用 `ensure_ascii=False`，兼容 Windows。

外部命令插件风险较高：外部程序作为本地进程启动，在操作系统层面可能访问本机资源。
安装不会启用 external runner，也不会自动获得信任。用户必须手动启用运行器，并在
首次写入时完成权限确认。宿主不使用 Shell，不接受自定义命令行参数，也不安装依赖。
