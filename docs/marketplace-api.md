# 公共资源商城接口规范

## 查询
客户端对配置的清单地址发起 HTTPS GET。无需账号和 Cookie，不发送导图、附件或节点数据，不跟随重定向。响应应为 UTF-8 JSON，最大 2 MB，最多 1000 个条目。浏览器访问时服务端需配置允许应用来源的 CORS。

```json
{"items":[{"id":"example.plugin","name":"示例插件","kind":"plugin","description":"功能说明","url":"./example.lmplugin","fileName":"example.lmplugin"}]}
```

id 必须唯一且非空。name 非空。kind 为 plugin、node-type 或 template。description 可省略。url 为 HTTPS 绝对地址或相对清单地址，禁止账号密码。fileName 不含路径和系统非法字符，扩展名为 .json 或 .lmplugin。当前关键词搜索在客户端执行，不向服务端发送查询参数。

## 下载
用户点击下载后，客户端对条目 url 发起 HTTPS GET。服务端返回文件原始字节，建议使用 application/octet-stream。最大 20 MB，超时 15 秒，不跟随重定向；HTTP 非成功状态显示失败。不要求登录或授权头。下载后由用户选择本地保存位置，再通过对应的插件、模板或节点类型入口导入，不自动执行或安装。

## 错误与版本
非法清单、重复 ID、非 HTTPS 地址、超限文件、超时和网络错误均中止当前操作并显示消息。清单当前无分页和版本协商字段；扩展服务时需兼容上述 items 结构。空商城地址表示未配置，不主动联网。
