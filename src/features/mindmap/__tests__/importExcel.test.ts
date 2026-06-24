import { describe, expect, it } from 'vitest';
import {
  createExcelTableView,
  ExcelImportError,
  parseExcelRowsToMindmap,
} from '../importExcel';

describe('Excel import core logic', () => {
  it('maps sheet rows with and without headers', () => {
    const sheetRows = [
      ['节点层级', '节点文本', '节点备注'],
      [1, '中心主题', '根备注'],
      [2, '子节点', '子备注'],
    ];

    const withHeader = createExcelTableView(sheetRows, true);
    const withoutHeader = createExcelTableView(sheetRows.slice(1), false);

    expect(withHeader.suggestedMapping.levelColumn).toBe('节点层级');
    expect(withHeader.rows[0]['节点文本']).toBe('中心主题');
    expect(withoutHeader.headers).toEqual(['A列', 'B列', 'C列']);
    expect(withoutHeader.rows[0]['B列']).toBe('中心主题');
  });

  it('parses rows into a mindmap tree', () => {
    const mindmap = parseExcelRowsToMindmap(
      [
        { level: 1, title: '中心主题', note: '根备注' },
        { level: 2, title: '子节点', note: '' },
      ],
      {
        levelColumn: 'level',
        textColumn: 'title',
        remarkColumn: 'note',
        nodeTypeColumn: '',
        orderColumn: '',
      },
    );

    expect(mindmap.text).toBe('中心主题');
    expect(mindmap.remark).toBe('根备注');
    expect(mindmap.children[0].text).toBe('子节点');
  });

  it('throws a friendly error for invalid levels', () => {
    expect(() =>
      parseExcelRowsToMindmap(
        [{ level: 'bad', title: '中心主题' }],
        {
          levelColumn: 'level',
          textColumn: 'title',
          remarkColumn: '',
          nodeTypeColumn: '',
          orderColumn: '',
        },
      ),
    ).toThrow(ExcelImportError);
  });
});

