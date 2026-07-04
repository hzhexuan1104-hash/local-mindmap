# EXE 外部程序插件示例

请用本地工具链生成 `keyword-plugin.exe` 并放到本目录。程序不接收命令行参数：

1. 从 stdin 读取 UTF-8 context JSON，直到 EOF。
2. 向 stdout 写出且只写出 `{"actions":[...]}` UTF-8 JSON。
3. 把调试日志写到 stderr。
4. 正常完成时返回 exit code 0。

将 `manifest.json`、`keyword-plugin.exe` 和本文件放在 ZIP 根目录，再把 ZIP
扩展名改为 `.lmplugin` 即可导入。不要打包 trusted 状态或 registry 文件。
