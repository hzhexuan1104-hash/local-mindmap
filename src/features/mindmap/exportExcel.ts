import * as XLSX from 'xlsx';
import type { MindmapNode } from './types';

type ExcelRow = {
  节点层级: number;
  节点文本: string;
  节点路径: string;
  节点备注: string;
  创建顺序: number;
};

function flattenMindmapRows(
  node: MindmapNode,
  level: number,
  path: string[],
  rows: ExcelRow[],
) {
  const currentPath = [...path, node.text];

  rows.push({
    节点层级: level,
    节点文本: node.text,
    节点路径: currentPath.join(' / '),
    节点备注: node.remark,
    创建顺序: rows.length + 1,
  });

  node.children.forEach((child) =>
    flattenMindmapRows(child, level + 1, currentPath, rows),
  );
}

export function exportMindmapExcel(rootNode: MindmapNode) {
  const rows: ExcelRow[] = [];
  flattenMindmapRows(rootNode, 1, [], rows);

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['节点层级', '节点文本', '节点路径', '节点备注', '创建顺序'],
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mindmap');
  XLSX.writeFile(workbook, 'mindmap.xlsx');
}
