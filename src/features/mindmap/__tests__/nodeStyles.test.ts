import { describe, expect, it, vi } from 'vitest';
import {
  createNodeTypeFromStyle,
  getEffectiveNodeStyle,
  mergeNodeStyle,
} from '../nodeStyles';
import type { MindmapNode, MindmapNodeType } from '../types';

const nodeType: MindmapNodeType = {
  id: 'type-task',
  name: '任务节点',
  icon: '✅',
  shape: 'rounded',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
  textColor: '#14315f',
  fontSize: 18,
  bold: true,
  defaultText: '新任务',
  defaultRemark: '默认备注',
};

const node: MindmapNode = {
  id: 'node-1',
  text: '当前节点',
  remark: '节点备注',
  nodeTypeId: nodeType.id,
  children: [],
};

describe('node style helpers', () => {
  it('lets current node style override global node type style', () => {
    const styledNode: MindmapNode = {
      ...node,
      style: mergeNodeStyle(node.style, {
        backgroundColor: '#dff6ff',
        fontSize: 20,
        bold: false,
      }),
    };

    expect(getEffectiveNodeStyle(styledNode, nodeType)).toMatchObject({
      shape: 'rounded',
      backgroundColor: '#dff6ff',
      borderColor: '#f59f00',
      textColor: '#14315f',
      fontSize: 20,
      bold: false,
    });
    expect(nodeType.backgroundColor).toBe('#fff7e8');
    expect(nodeType.fontSize).toBe(18);
  });

  it('creates an explicit global node type from current node style', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'generated-type-id',
    });

    expect(
      createNodeTypeFromStyle(
        ' 当前样式 ',
        getEffectiveNodeStyle(
          { ...node, style: { shape: 'pill', textColor: '#111111' } },
          nodeType,
        ),
        node,
      ),
    ).toMatchObject({
      id: 'generated-type-id',
      name: '当前样式',
      shape: 'pill',
      textColor: '#111111',
      defaultText: '当前节点',
      defaultRemark: '节点备注',
    });

    vi.unstubAllGlobals();
  });
});
