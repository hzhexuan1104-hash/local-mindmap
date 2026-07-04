# 示例 Python 外部命令插件

1. 在插件管理器的开发者模式中启用“外部命令插件运行器”。
2. 保持 Python 路径为 `python`，或填写 Python/Python.exe 的绝对路径并点击“测试 Python”。
3. 通过“导入本地插件”选择本目录的 `manifest.json`。
4. 选中节点后从顶部插件菜单或节点右键菜单运行。

宿主向 stdin 写入 UTF-8 `contextVersion: 1` context JSON；插件必须只向 stdout
写入一个 UTF-8 JSON 对象，格式为 `{"actions": [...]}`。调试信息应写入 stderr。
actions 由宿主使用与脚本插件相同的 Action Protocol 整批校验和应用。
宿主为 Python 子进程设置 `PYTHONIOENCODING=utf-8` 和 `PYTHONUTF8=1`；
`main.py` 也显式 reconfigure stdin/stdout/stderr，兼容 Windows 控制台默认编码。
stdout 非 UTF-8 或非 JSON 时整次失败，不执行 actions，也不产生 undo。

外部命令插件是高风险实验功能。Local Mindmap 不通过 Shell 启动进程，不支持 DLL、
远程 URL、网络插件市场或自动安装依赖，也不提供文件系统 API。Python 固定以
`python <entry>` 启动，exe 固定直接启动 entry，不接受插件自定义参数。外部进程在
操作系统层面仍可能访问本机资源，因此只应运行可信插件。
