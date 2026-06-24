import * as XLSX from 'xlsx';
import { selectLocalFile } from './fileUtils';
import type { MindmapNode, MindmapNodeType } from './types';

export class ExcelImportError extends Error {}

export type RawExcelRow = Record<string, unknown>;

export type ExcelImportMapping = {
  levelColumn: string;
  textColumn: string;
  remarkColumn: string;
  nodeTypeColumn: string;
  orderColumn: string;
};

export type ExcelImportPreview = {
  fileName: string;
  headers: string[];
  rows: RawExcelRow[];
  sheetRows: unknown[][];
  suggestedMapping: ExcelImportMapping;
};

type ParsedExcelRow = {
  level: number;
  text: string;
  remark: string;
  nodeTypeId: string | undefined;
};

const EMPTY_MAPPING: ExcelImportMapping = {
  levelColumn: '',
  textColumn: '',
  remarkColumn: '',
  nodeTypeColumn: '',
  orderColumn: '',
};

function getExcelColumnName(index: number) {
  let columnNumber = index + 1;
  let columnName = '';

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return `${columnName}列`;
}

function makeUniqueHeaders(headers: string[]) {
  const usedHeaders = new Map<string, number>();

  return headers.map((header, index) => {
    const fallbackHeader = getExcelColumnName(index);
    const baseHeader = header.trim() || fallbackHeader;
    const usedCount = usedHeaders.get(baseHeader) ?? 0;
    usedHeaders.set(baseHeader, usedCount + 1);

    return usedCount === 0 ? baseHeader : `${baseHeader}_${usedCount + 1}`;
  });
}

function getMaxColumnCount(sheetRows: unknown[][]) {
  return sheetRows.reduce((maxCount, row) => Math.max(maxCount, row.length), 0);
}

function rowToRecord(row: unknown[], headers: string[]): RawExcelRow {
  return headers.reduce<RawExcelRow>((record, header, index) => {
    record[header] = row[index] ?? '';
    return record;
  }, {});
}

export function createExcelTableView(sheetRows: unknown[][], hasHeader: boolean) {
  const maxColumnCount = getMaxColumnCount(sheetRows);
  const fallbackHeaders = Array.from({ length: maxColumnCount }, (_, index) =>
    getExcelColumnName(index),
  );
  const headers = hasHeader
    ? makeUniqueHeaders(
        fallbackHeaders.map((fallbackHeader, index) =>
          normalizeCell(sheetRows[0]?.[index] ?? fallbackHeader),
        ),
      )
    : fallbackHeaders;
  const dataRows = hasHeader ? sheetRows.slice(1) : sheetRows;
  const rows = dataRows.map((row) => rowToRecord(row, headers));

  return {
    headers,
    rows,
    suggestedMapping: hasHeader ? inferExcelImportMapping(headers) : EMPTY_MAPPING,
  };
}

function createImportedNode(
  text: string,
  remark = '',
  nodeTypeId?: string,
): MindmapNode {
  return {
    id: crypto.randomUUID(),
    text: text.trim() || '未命名节点',
    remark,
    ...(nodeTypeId ? { nodeTypeId } : {}),
    children: [],
  };
}

function normalizeCell(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function findHeader(headers: string[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);

  return (
    headers.find((header) =>
      normalizedCandidates.includes(normalizeHeader(header)),
    ) ?? ''
  );
}

function getLevel(row: RawExcelRow, levelColumn: string) {
  const rawLevelValue = normalizeCell(row[levelColumn]).trim();

  if (!rawLevelValue) {
    return 1;
  }

  const levelValue = Number(rawLevelValue);

  return Number.isFinite(levelValue) && levelValue > 0
    ? Math.floor(levelValue)
    : null;
}

function getNodeTypeId(
  value: unknown,
  nodeTypes: MindmapNodeType[],
): string | undefined {
  const nodeTypeValue = normalizeCell(value).trim();

  if (!nodeTypeValue) {
    return undefined;
  }

  const matchedNodeType = nodeTypes.find(
    (nodeType) =>
      nodeType.id === nodeTypeValue || nodeType.name === nodeTypeValue,
  );

  return matchedNodeType?.id;
}

export function inferExcelImportMapping(headers: string[]): ExcelImportMapping {
  return {
    levelColumn: findHeader(headers, ['节点层级', '层级', 'level']),
    textColumn: findHeader(headers, [
      '节点文本',
      '节点名称',
      '标题',
      '文本',
      'text',
      'title',
      'name',
    ]),
    remarkColumn: findHeader(headers, ['节点备注', '备注', 'remark', 'note']),
    nodeTypeColumn: findHeader(headers, ['节点类型', '类型', 'type', 'nodeType']),
    orderColumn: findHeader(headers, ['创建顺序', '顺序', 'order']),
  };
}

export function validateExcelImportMapping(mapping: ExcelImportMapping) {
  return Boolean(mapping.levelColumn && mapping.textColumn);
}

export function parseExcelRowsToMindmap(
  rows: RawExcelRow[],
  mapping: ExcelImportMapping = {
    ...EMPTY_MAPPING,
    levelColumn: '节点层级',
    textColumn: '节点文本',
    remarkColumn: '节点备注',
    nodeTypeColumn: '节点类型',
    orderColumn: '创建顺序',
  },
  nodeTypes: MindmapNodeType[] = [],
): MindmapNode {
  if (rows.length === 0) {
    return createImportedNode('导入的 Excel');
  }

  if (!validateExcelImportMapping(mapping)) {
    throw new ExcelImportError('Excel 导入缺少必填列：节点层级列和节点文本列');
  }

  const orderedRows = [...rows];

  if (mapping.orderColumn) {
    orderedRows.sort((left, right) => {
      const leftOrder = Number(left[mapping.orderColumn]);
      const rightOrder = Number(right[mapping.orderColumn]);

      if (!Number.isFinite(leftOrder) || !Number.isFinite(rightOrder)) {
        return 0;
      }

      return leftOrder - rightOrder;
    });
  }

  const validRows = orderedRows.flatMap<ParsedExcelRow>((row) => {
    const level = getLevel(row, mapping.levelColumn);

    if (level === null) {
      throw new ExcelImportError(
        `节点层级列存在无法解析的值：${normalizeCell(row[mapping.levelColumn])}`,
      );
    }

    const text = normalizeCell(row[mapping.textColumn]);
    const remark = mapping.remarkColumn ? normalizeCell(row[mapping.remarkColumn]) : '';

    if (!text.trim() && !remark.trim()) {
      return [];
    }

    return [
      {
        level,
        text,
        remark,
        nodeTypeId: mapping.nodeTypeColumn
          ? getNodeTypeId(row[mapping.nodeTypeColumn], nodeTypes)
          : undefined,
      },
    ];
  });

  if (validRows.length === 0) {
    return createImportedNode('导入的 Excel');
  }

  const rootRow = validRows[0];
  const rootNode = createImportedNode(
    rootRow.text || '导入的 Excel',
    rootRow.remark,
    rootRow.nodeTypeId,
  );
  const stack: Array<{ level: number; node: MindmapNode }> = [
    { level: rootRow.level, node: rootNode },
  ];

  for (const row of validRows.slice(1)) {
    const node = createImportedNode(row.text, row.remark, row.nodeTypeId);

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

export async function selectExcelImportPreview(): Promise<ExcelImportPreview | null> {
  const selectedFile = await selectLocalFile(
    '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  if (!selectedFile) {
    return null;
  }

  const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new ExcelImportError('Excel 格式不正确，未找到工作表');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (sheetRows.length === 0 || getMaxColumnCount(sheetRows) === 0) {
    throw new ExcelImportError('Excel 格式不正确，未找到可导入数据');
  }

  const tableView = createExcelTableView(sheetRows, true);

  return {
    fileName: selectedFile.name,
    sheetRows,
    headers: tableView.headers,
    rows: tableView.rows,
    suggestedMapping: tableView.suggestedMapping,
  };
}

export async function importMindmapExcel(): Promise<MindmapNode | null> {
  const preview = await selectExcelImportPreview();

  if (!preview) {
    return null;
  }

  if (!validateExcelImportMapping(preview.suggestedMapping)) {
    throw new ExcelImportError('Excel 格式不正确，缺少节点层级列或节点文本列');
  }

  return parseExcelRowsToMindmap(preview.rows, preview.suggestedMapping);
}
