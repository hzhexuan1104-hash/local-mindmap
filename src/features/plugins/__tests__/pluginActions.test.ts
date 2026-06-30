import { describe, expect, it } from 'vitest';
import { validatePluginAction } from '../pluginActions';
import {
  applyScriptPluginActions,
  createScriptPluginContext,
  validateScriptPluginActions,
} from '../pluginScriptActions';
import type { MindmapNode } from '../../mindmap/types';

const rootNode: MindmapNode = {
  id: 'root',
  text: 'Root',
  remark: '',
  children: [
    {
      id: 'node-1',
      text: 'Node 1',
      remark: 'Remark',
      children: [],
    },
  ],
};

describe('Plugin Action Protocol validation', () => {
  it('accepts a valid updateNode action', () => {
    expect(
      validatePluginAction({
        type: 'updateNode',
        nodeId: 'node-1',
        patch: { text: '新标题', remark: '新备注' },
      }),
    ).toMatchObject({
      valid: true,
      action: {
        type: 'updateNode',
        nodeId: 'node-1',
      },
    });
  });

  it('rejects an unknown action type', () => {
    expect(validatePluginAction({ type: 'runShell' })).toMatchObject({
      valid: false,
      action: null,
      errors: ['未知 Plugin action type：runShell'],
    });
  });
});

describe('Script Plugin Action validation', () => {
  it('creates a JSON-safe context snapshot', () => {
    expect(createScriptPluginContext(rootNode, 'node-1')).toEqual({
      mindmap: { title: 'Root', nodeCount: 2 },
      selectedNode: { id: 'node-1', text: 'Node 1', remark: 'Remark' },
      nodes: [
        { id: 'root', text: 'Root', parentId: null, remark: '' },
        { id: 'node-1', text: 'Node 1', parentId: 'root', remark: 'Remark' },
      ],
    });
  });

  it('accepts and applies updateNode plus showMessage actions', () => {
    const validation = validateScriptPluginActions(
      [
        {
          type: 'updateNode',
          nodeId: 'node-1',
          patch: { text: 'Updated' },
        },
        {
          type: 'showMessage',
          level: 'info',
          message: 'Done',
        },
      ],
      rootNode,
    );

    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const applied = applyScriptPluginActions(rootNode, validation.actions);
    expect(applied.rootNode.children[0].text).toBe('Updated');
    expect(applied.messages[0].message).toBe('Done');
  });

  it('rejects an unknown script action type', () => {
    expect(validateScriptPluginActions([{ type: 'runShell' }], rootNode)).toEqual({
      valid: false,
      actions: [],
      error: '第 1 个 action 出错：不支持的 action type：runShell',
    });
  });

  it('rejects overlong update text', () => {
    const result = validateScriptPluginActions(
      [
        {
          type: 'updateNode',
          nodeId: 'node-1',
          patch: { text: 'x'.repeat(501) },
        },
      ],
      rootNode,
    );

    expect(result).toMatchObject({
      valid: false,
      error: '第 1 个 action 出错：patch.text 长度不能超过 500。',
    });
  });

  it('rejects missing node ids', () => {
    const result = validateScriptPluginActions(
      [
        {
          type: 'setNodeRemark',
          nodeId: 'missing',
          remark: 'New',
        },
      ],
      rootNode,
    );

    expect(result).toMatchObject({
      valid: false,
      error: '第 1 个 action 出错：nodeId 不存在：missing',
    });
  });

  it('rejects action batches over the limit', () => {
    const result = validateScriptPluginActions(
      Array.from({ length: 21 }, (_, index) => ({
        type: 'showMessage',
        message: `message ${index}`,
      })),
      rootNode,
    );

    expect(result).toEqual({
      valid: false,
      actions: [],
      error: '单次最多执行 20 个 actions。',
    });
  });

  it('rejects deleteNode for the MVP', () => {
    expect(
      validateScriptPluginActions([{ type: 'deleteNode', nodeId: 'node-1' }], rootNode),
    ).toMatchObject({
      valid: false,
      error: '第 1 个 action 出错：deleteNode 本批暂不支持执行。',
    });
  });
});
