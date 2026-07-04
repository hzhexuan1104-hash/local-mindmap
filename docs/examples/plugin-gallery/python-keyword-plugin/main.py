import json
import re
import sys

try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def extract_keywords(text):
    words = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_-]{2,}", text)
    unique = []
    for word in words:
        if word not in unique:
            unique.append(word)
    return (unique + ["重点", "结论", "行动项"])[:3]


def main():
    context = json.load(sys.stdin)
    node = context.get("selectedNode")
    if not node:
        result = {"actions": [{
            "type": "showMessage",
            "level": "warning",
            "message": "请先选择一个节点。"
        }]}
    else:
        keywords = extract_keywords(node.get("text", ""))
        result = {"actions": [
            {
                "type": "addChildNodes",
                "parentId": node["id"],
                "nodes": [
                    {"text": keyword, "remark": "由 Python 关键词插件生成"}
                    for keyword in keywords
                ]
            },
            {
                "type": "showMessage",
                "level": "info",
                "message": "Python 插件已生成关键词子节点。"
            }
        ]}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
