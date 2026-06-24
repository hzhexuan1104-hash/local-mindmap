# 插件开发规范

## 1. 设计目标

插件管理系统基础版用于在纯本地环境中扩展思维导图工具的可用资源。当前版本采用“插件描述文件 + 本地注册表 + 数据驱动扩展”的方式，不执行第三方 JavaScript 代码。

目标：

- 支持用户从本地 JSON 文件安装插件。
- 支持主题包、图标包、节点类型包、导出格式描述和工具入口描述。
- 支持启用、禁用、卸载和本地持久化。
- 保持离线运行，不上传用户数据。

## 2. Manifest JSON 结构

```json
{
  "pluginId": "example-theme-pack",
  "name": "示例主题包",
  "version": "1.0.0",
  "author": "Local Mindmap",
  "description": "提供额外主题。",
  "category": "theme",
  "capabilities": ["themePack"],
  "enabled": true,
  "installedAt": "2026-06-24T10:00:00.000Z",
  "config": {},
  "contributions": {
    "themes": [
      {
        "id": "example-purple",
        "name": "示例紫色",
        "canvasBackground": "#fbf7ff",
        "gridColor": "#eadcff",
        "nodeBackground": "#f3e8ff",
        "nodeBorder": "#8b5cf6",
        "nodeText": "#3b0764",
        "lineColor": "#b794f4"
      }
    ],
    "icons": [
      {
        "value": "🚀",
        "label": "🚀 启动"
      }
    ],
    "nodeTypes": [
      {
        "id": "example-task",
        "name": "任务节点",
        "icon": "✅",
        "shape": "rounded",
        "backgroundColor": "#eef5ff",
        "borderColor": "#1f6feb",
        "textColor": "#14315f",
        "fontSize": 18,
        "bold": true,
        "defaultText": "新任务",
        "defaultRemark": ""
      }
    ],
    "exportFormats": [
      {
        "formatId": "txt",
        "label": "导出 TXT",
        "fileName": "mindmap.txt",
        "handlerId": "builtin-txt"
      }
    ],
    "tools": [
      {
        "toolId": "example-tool",
        "label": "示例工具",
        "description": "仅作为入口描述，不执行外部代码。"
      }
    ]
  }
}
```

## 3. 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| pluginId | 是 | 插件唯一标识，重复安装时会提示覆盖。 |
| name | 是 | 插件名称。 |
| version | 是 | 插件版本。 |
| author | 否 | 作者名称，缺省为“未知作者”。 |
| description | 否 | 插件说明。 |
| category | 是 | 插件分类。 |
| capabilities | 否 | 插件声明的能力列表。 |
| enabled | 否 | 是否启用，安装后默认启用。 |
| installedAt | 否 | 安装时间，缺省为当前时间。 |
| config | 否 | 插件配置数据，当前基础版仅保存，不执行。 |
| contributions | 否 | 插件贡献的数据。 |

## 4. 支持的插件分类

- `import-export`：导入导出相关插件。
- `theme`：主题包插件。
- `icon-pack`：图标包插件。
- `node-type`：节点类型包插件。
- `tool`：工具入口插件。

## 5. 支持的能力范围

- `exportText`：文本导出能力声明。
- `themePack`：主题包能力。
- `iconPack`：图标包能力。
- `nodeTypePack`：节点类型包能力。
- `toolPanel`：工具面板入口描述。

当前只有 `handlerId: "builtin-txt"` 会触发应用内置的安全 TXT 导出 handler。插件文件本身不会提供、加载或执行代码。

## 6. 当前基础版限制

- 不执行第三方 JavaScript。
- 不使用 `eval`。
- 不使用 `new Function`。
- 不加载远程脚本。
- 不联网下载插件。
- 不支持真正动态代码扩展。
- 主要支持主题包、图标包、节点类型包，以及应用内置的安全导出 handler。

## 7. 安全原则

- 插件安装来自用户选择的本地 JSON 文件。
- 插件数据保存在浏览器 localStorage 中。
- 不上传用户文件。
- 不上传节点内容、备注内容或操作数据。
- 不执行未知代码。
- 禁用插件后，插件贡献的主题、图标、节点类型和导出格式不再进入新选择列表。

## 8. 后续扩展方向

- 桌面端插件目录。
- 插件签名与来源校验。
- 沙箱执行环境。
- 明确的插件 API。
- 更细粒度的插件权限模型。

