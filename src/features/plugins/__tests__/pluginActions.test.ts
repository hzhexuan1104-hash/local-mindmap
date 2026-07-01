import { describe, expect, it } from 'vitest';
import { validatePluginAction } from '../pluginActions';
import {
  applyScriptPluginActions,
  createScriptPluginContext,
  validateScriptActionPermissions,
  validateScriptPluginActions,
} from '../pluginScriptActions';
import type { MindmapNode } from '../../mindmap/types';
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../../mindmap/history';

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
    const context = createScriptPluginContext(rootNode, 'node-1');
    expect(context).toEqual({
      app: { version: '1.8.0', platform: 'desktop' },
      mindmap: {
        title: 'Root',
        nodeCount: 2,
        selectedNodeId: 'node-1',
        rootNodeId: 'root',
      },
      selectedNode: {
        id: 'node-1',
        text: 'Node 1',
        remark: 'Remark',
        parentId: 'root',
        childrenIds: [],
        type: 'default',
      },
      nodes: [
        {
          id: 'root',
          text: 'Root',
          parentId: null,
          remark: '',
          childrenIds: ['node-1'],
          type: 'default',
        },
        {
          id: 'node-1',
          text: 'Node 1',
          parentId: 'root',
          remark: 'Remark',
          childrenIds: [],
          type: 'default',
        },
      ],
      selection: { nodeIds: ['node-1'] },
    });
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
    expect(JSON.stringify(context)).not.toMatch(
      /filePath|userData|__TAURI__|function/,
    );
  });

  it('truncates oversized context node lists', () => {
    const largeRoot: MindmapNode = {
      ...rootNode,
      children: Array.from({ length: 1001 }, (_, index) => ({
        id: `node-${index}`,
        text: `Node ${index}`,
        remark: '',
        children: [],
      })),
    };
    const context = createScriptPluginContext(largeRoot, 'root');
    expect(context.mindmap.nodeCount).toBe(1002);
    expect(context.nodes).toHaveLength(1000);
    expect(context.truncated).toBe(true);
    expect(context.warning).toContain('已截断');

    const tailContext = createScriptPluginContext(
      largeRoot,
      'node-1000',
      ['node-1000'],
    );
    expect(tailContext.selectedNode?.id).toBe('node-1000');
    expect(tailContext.selection.nodeIds).toEqual(['node-1000']);
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
      error:
        '第 1 个 action 出错：当前版本暂不支持 deleteNode，防止误删节点。',
    });
  });

  it('accepts updateNodes atomically and applies every patch', () => {
    const validation = validateScriptPluginActions(
      [{
        type: 'updateNodes',
        updates: [
          { nodeId: 'root', patch: { remark: 'Root remark' } },
          { nodeId: 'node-1', patch: { text: 'Batch updated' } },
        ],
      }],
      rootNode,
    );
    expect(validation.valid).toBe(true);
    if (!validation.valid) throw new Error(validation.error);
    const applied = applyScriptPluginActions(rootNode, validation.actions);
    expect(applied.rootNode.remark).toBe('Root remark');
    expect(applied.rootNode.children[0].text).toBe('Batch updated');
  });

  it('rejects an updateNodes batch when one node does not exist', () => {
    expect(
      validateScriptPluginActions(
        [{
          type: 'updateNodes',
          updates: [
            { nodeId: 'node-1', patch: { text: 'valid' } },
            { nodeId: 'missing', patch: { text: 'invalid' } },
          ],
        }],
        rootNode,
      ),
    ).toMatchObject({ valid: false, error: expect.stringContaining('missing') });
  });

  it('rejects updateNodes over 50 entries', () => {
    expect(
      validateScriptPluginActions(
        [{
          type: 'updateNodes',
          updates: Array.from({ length: 51 }, () => ({
            nodeId: 'node-1',
            patch: { text: 'updated' },
          })),
        }],
        rootNode,
      ),
    ).toMatchObject({ valid: false, error: expect.stringContaining('最多 50') });
  });

  it('accepts addChildNodes and rejects over 20 nodes', () => {
    const valid = validateScriptPluginActions(
      [{
        type: 'addChildNodes',
        parentId: 'node-1',
        nodes: [
          { text: 'Child 1', remark: '' },
          { text: 'Child 2' },
        ],
      }],
      rootNode,
    );
    expect(valid.valid).toBe(true);
    if (!valid.valid) throw new Error(valid.error);
    expect(
      applyScriptPluginActions(rootNode, valid.actions).rootNode.children[0]
        .children,
    ).toHaveLength(2);

    expect(
      validateScriptPluginActions(
        [{
          type: 'addChildNodes',
          parentId: 'node-1',
          nodes: Array.from({ length: 21 }, () => ({ text: 'Child' })),
        }],
        rootNode,
      ),
    ).toMatchObject({ valid: false, error: expect.stringContaining('最多 20') });
  });

  it('undoes and redoes one script batch as one history step', () => {
    const validation = validateScriptPluginActions(
      [{
        type: 'addChildNodes',
        parentId: 'node-1',
        nodes: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      }],
      rootNode,
    );
    if (!validation.valid) throw new Error(validation.error);
    const before = {
      rootNode,
      nodeTypes: [],
      themeId: 'default-blue',
    };
    const after = {
      ...before,
      rootNode: applyScriptPluginActions(rootNode, validation.actions).rootNode,
    };
    const history = pushHistory(createHistoryState(), before);
    const undone = undoHistory(history, after);
    expect(undone?.project.rootNode.children[0].children).toHaveLength(0);
    const redone = undoHistory(history, after)
      ? redoHistory(undone!.history, undone!.project)
      : null;
    expect(redone?.project.rootNode.children[0].children).toHaveLength(3);
    expect(history.past).toHaveLength(1);
  });

  it('validates append/prepend text against the final title length', () => {
    const valid = validateScriptPluginActions(
      [
        { type: 'prependNodeText', nodeId: 'node-1', text: '【重点】' },
        { type: 'appendNodeText', nodeId: 'node-1', text: ' ✅' },
      ],
      rootNode,
    );
    expect(valid.valid).toBe(true);
    if (!valid.valid) throw new Error(valid.error);
    expect(
      applyScriptPluginActions(rootNode, valid.actions).rootNode.children[0].text,
    ).toBe('【重点】Node 1 ✅');

    expect(
      validateScriptPluginActions(
        [{
          type: 'appendNodeText',
          nodeId: 'node-1',
          text: 'x'.repeat(100),
        }],
        { ...rootNode, children: [{ ...rootNode.children[0], text: 'x'.repeat(450) }] },
      ),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining('拼接后 text 长度不能超过 500'),
    });
  });

  it('rejects appendNodeRemark when the final remark exceeds 5000', () => {
    expect(
      validateScriptPluginActions(
        [{ type: 'appendNodeRemark', nodeId: 'node-1', text: 'xx' }],
        {
          ...rootNode,
          children: [{ ...rootNode.children[0], remark: 'x'.repeat(4999) }],
        },
      ),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining('拼接后 remark 长度不能超过 5000'),
    });
  });

  it('rejects applyTemplate explicitly', () => {
    expect(
      validateScriptPluginActions([{ type: 'applyTemplate' }], rootNode),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining('暂不支持 applyTemplate'),
    });
  });

  it('requires a declared write permission for mutating actions', () => {
    const validation = validateScriptPluginActions(
      [{ type: 'appendNodeText', nodeId: 'node-1', text: ' ✅' }],
      rootNode,
    );
    if (!validation.valid) throw new Error(validation.error);
    expect(validateScriptActionPermissions(validation.actions, [])).toEqual({
      valid: false,
      error:
        '脚本返回了导图修改 action，但未声明 node:write 或 mindmap:write 权限。',
    });
    expect(
      validateScriptActionPermissions(validation.actions, ['node:write']),
    ).toEqual({ valid: true, error: null });
    expect(
      validateScriptActionPermissions(
        [{ type: 'showMessage', message: 'hello' }],
        [],
      ),
    ).toEqual({ valid: true, error: null });
  });
});
