import type { MindmapNode } from './types';

/** Export selected branches once, retaining their order in the document. */
export function buildSelectionExport(root: MindmapNode, ids: string[]): MindmapNode | null {
  const selected = new Set(ids);
  const branches: MindmapNode[] = [];
  const visit = (node: MindmapNode) => {
    if (selected.has(node.id)) branches.push(structuredClone(node));
    else node.children.forEach(visit);
  };
  visit(root);
  if (!branches.length) return null;
  if (branches.length === 1) return branches[0];
  let id = 'selection-export';
  const allIds = new Set<string>();
  const collect = (node: MindmapNode) => { allIds.add(node.id); node.children.forEach(collect); };
  collect(root);
  while (allIds.has(id)) id += '-root';
  return { id, text: `${root.text}（选中节点）`, remark: '', children: branches };
}
