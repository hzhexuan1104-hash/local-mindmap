import json
import sys

try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def main():
    context = json.load(sys.stdin)
    node = context.get("selectedNode")

    if not node:
        print(json.dumps({
            "actions": [{
                "type": "showMessage",
                "level": "warning",
                "message": "请先选择一个节点。"
            }]
        }, ensure_ascii=False))
        return

    text = node.get("text", "当前节点")
    print(json.dumps({
        "actions": [
            {
                "type": "addChildNodes",
                "parentId": node["id"],
                "nodes": [
                    {"text": f"{text} - 关键词 1", "remark": "由 Python 插件生成"},
                    {"text": f"{text} - 关键词 2", "remark": "由 Python 插件生成"},
                    {"text": f"{text} - 关键词 3", "remark": "由 Python 插件生成"}
                ]
            },
            {
                "type": "showMessage",
                "level": "info",
                "message": "Python 插件已生成 3 个关键词子节点。"
            }
        ]
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
