import json
import sys
from pathlib import Path

context = json.load(sys.stdin)
file = context["inputFile"]
with Path(file["path"]).open(encoding="utf-8-sig") as source:
    nodes = json.load(source)
if not isinstance(nodes, list) or not nodes:
    sys.exit("文件应包含非空节点数组。")
parent_id = (context.get("selectedNode") or {}).get("id") or context["mindmap"]["rootNodeId"]
actions = [
    {"type": "addChildNodes", "parentId": parent_id, "nodes": nodes},
    {"type": "showMessage", "message": f"已导入 {len(nodes)} 个分支。"}
]
print(json.dumps({"actions": actions}, ensure_ascii=False))
