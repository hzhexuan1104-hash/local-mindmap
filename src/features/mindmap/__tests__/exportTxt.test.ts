import { describe, expect, it } from 'vitest';
import { serializeMindmapTxt } from '../exportTxt';
import type { MindmapNode } from '../types';

describe('serializeMindmapTxt', () => {
  it('exports node hierarchy with indentation and remarks', () => {
    const mindmap: MindmapNode = {
      id: 'root',
      text: '中心主题',
      remark: '根备注',
      children: [
        {
          id: 'child',
          text: '需求分析',
          remark: '',
          children: [
            {
              id: 'grandchild',
              text: '用户需求',
              remark: '详细说明',
              children: [],
            },
          ],
        },
      ],
    };

    expect(serializeMindmapTxt(mindmap)).toBe(
      [
        '中心主题',
        '  备注：根备注',
        '  需求分析',
        '    用户需求',
        '      备注：详细说明',
        '',
      ].join('\n'),
    );
  });
});

