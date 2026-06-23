import * as XLSX from 'xlsx';
import { selectLocalFile } from './fileUtils';
import type { MindmapNode } from './types';

export class ExcelImportError extends Error {}

type RawExcelRow = Record<string, unknown>;

function createImportedNode(text: string, remark = ''): MindmapNode {
  return {
    id: crypto.randomUUID(),
    text: text.trim() || '未命名节点',
    remark,
    children: [],
  };
}

function normalizeCell(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function getLevel(row: RawExcelRow) {
  const levelValue = Number(row['节点层级']);

  return Number.isFinite(levelValue) && levelValue > 0
    ? Math.floor(levelValue)
    : null;
}

export function parseExcelRowsToMindmap(rows: RawExcelRow[]): MindmapNode {
  if (rows.length === 0) {
    return createImportedNode('导入的 Excel');
  }

  if (!Object.prototype.hasOwnProperty.call(rows[0], '节点层级')) {
    throw new ExcelImportError('Excel 格式不正确，缺少节点层级列');
  }

  const validRows = rows
    .map((row) => ({
      level: getLevel(row),
      text: normalizeCell(row['节点文本']),
      remark: normalizeCell(row['节点备注']),
    }))
    .filter((row): row is { level: number; text: string; remark: string } =>
      row.level !== null,
    );

  if (validRows.length === 0) {
    return createImportedNode('导入的 Excel');
  }

  const rootRow = validRows[0];
  const rootNode = createImportedNode(rootRow.text || '导入的 Excel', rootRow.remark);
  const stack: Array<{ level: number; node: MindmapNode }> = [
    { level: rootRow.level, node: rootNode },
  ];

  for (const row of validRows.slice(1)) {
    const node = createImportedNode(row.text, row.remark);

    while (stack.length > 1 && stack[stack.length - 1].level >= row.level) {
      stack.pop();
    }

    const parent =
      row.level <= stack[0].level ? rootNode : stack[stack.length - 1].node;

    parent.children.push(node);
    stack.push({ level: row.level, node });
  }

  return rootNode;
}

export async function importMindmapExcel(): Promise<MindmapNode | null> {
  const selectedFile = await selectLocalFile(
    '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  if (!selectedFile) {
    return null;
  }

  const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return createImportedNode('导入的 Excel');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });
  const headers = (headerRows[0] ?? []).map((header) => String(header));

  if (!headers.includes('节点层级')) {
    throw new ExcelImportError('Excel 格式不正确，缺少节点层级列');
  }

  const rows = XLSX.utils.sheet_to_json<RawExcelRow>(
    worksheet,
    { defval: '' },
  );

  return parseExcelRowsToMindmap(rows);
}
