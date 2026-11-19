import { describe, expect, it } from 'vitest';
import { validatePluginAction } from '../pluginActions';
import {
  applyScriptPluginActions,
  createScriptPluginContext,
  validateScriptActionPermissions,
  validateScriptPluginActions,
} from '../pluginScriptActions';
import { DEFAULT_NODE_STYLE, getEffectiveNodeStyle } from '../../mindmap/nodeStyles';
import type { MindmapNode, MindmapNodeType } from '../../mindmap/types';
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
const taskType: MindmapNodeType = {
  id: 'task', name: '任务', icon: null, shape: 'pill',
  backgroundColor: '#ffff00', borderColor: '#808000', textColor: '#000000',
  fontSize: 18, bold: true, defaultText: '新任务', defaultRemark: '任务备注模板',
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
      contextVersion: 1,
      app: { version: '1.11.0', platform: 'desktop' },
      mindmap: {
        filePath: '',
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
        type: 'default', tags: [],
      },
      nodes: [
        {
          id: 'root',
          text: 'Root',
          parentId: null,
          remark: '',
          childrenIds: ['node-1'],
          type: 'default', tags: [],
        },
        {
          id: 'node-1',
          text: 'Node 1',
          parentId: 'root',
          remark: 'Remark',
          childrenIds: [],
          type: 'default', tags: [],
        },
      ],
      selection: { nodeIds: ['node-1'] },
    });
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
    expect(JSON.stringify(context)).not.toMatch(
      /userData|__TAURI__|function/,
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

  it('applies 1000 additions in order and rejects a 1001st action', () => {
    const actions = Array.from({ length: 1000 }, (_, index) => ({
      type: 'addChildNode',
      parentId: 'node-1',
      node: { text: `Child ${index}` },
    }));
    const valid = validateScriptPluginActions(actions, rootNode);
    if (!valid.valid) throw new Error(valid.error);
    const applied = applyScriptPluginActions(rootNode, valid.actions);
    const children = applied.rootNode.children[0].children;
    expect(applied).toMatchObject({ appliedCount: 1000, mutationCount: 1000 });
    expect(children.map(({ text }) => text)).toEqual(actions.map(({ node }) => node.text));
    expect(new Set(children.map(({ id }) => id)).size).toBe(1000);
    expect(rootNode.children[0].children).toEqual([]);

    expect(validateScriptPluginActions([...actions, actions[0]], rootNode)).toEqual({
      valid: false,
      actions: [],
      error: '单次最多执行 1000 个 actions。',
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

  it('rejects updateNodes over 1000 entries', () => {
    expect(
      validateScriptPluginActions(
        [{
          type: 'updateNodes',
          updates: Array.from({ length: 1001 }, () => ({
            nodeId: 'node-1',
            patch: { text: 'updated' },
          })),
        }],
        rootNode,
      ),
    ).toMatchObject({ valid: false, error: expect.stringContaining('最多 1000') });
  });

  it('accepts addChildNodes and rejects over 1000 nodes', () => {
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
          nodes: Array.from({ length: 1001 }, () => ({ text: 'Child' })),
        }],
        rootNode,
      ),
    ).toMatchObject({ valid: false, error: expect.stringContaining('最多 1000') });
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

describe('Expanded plugin import and batch protocol', () => {
  it.each(['', ' \t', '\u00a0\u3000'])('resolves Excel type IDs with surrounding whitespace %j throughout addChildNodes trees', (padding) => {
    const specialType = { ...taskType, id: '190ccefd-c339-447e-955d-86e95d52012f' };
    const result = validateScriptPluginActions([{
      type: 'addChildNodes', parentId: 'root', nodes: [
        { text: 'Imported title', type: `${padding}${specialType.id}${padding}`, children: [
          { text: 'Nested title', nodeTypeId: `\u00a0${specialType.id}\u3000`, remark: '' },
          { text: 'Unknown', type: ' missing ', nodeTypeId: specialType.id },
          { text: 'Default' },
        ] },
      ],
    }], rootNode);
    if (!result.valid) throw new Error(result.error);
    const added = applyScriptPluginActions(rootNode, result.actions, [specialType]).rootNode.children[1];
    expect(added).toMatchObject({ text: 'Imported title', nodeTypeId: specialType.id, remark: specialType.defaultRemark });
    expect(getEffectiveNodeStyle(added, specialType)).toMatchObject({ backgroundColor: '#ffff00', shape: 'pill' });
    expect(added.children[0]).toMatchObject({ text: 'Nested title', nodeTypeId: specialType.id, remark: '' });
    for (const child of added.children.slice(1)) {
      expect(child.nodeTypeId).toBeUndefined();
      expect(getEffectiveNodeStyle(child)).toEqual(DEFAULT_NODE_STYLE);
    }
  });

  it('adds 1000 nodes in a single action and falls back to the default type', () => {
    const result = validateScriptPluginActions([{ type: 'addChildNodes', parentId: 'root', nodes: Array.from({ length: 1000 }, () => ({ text: 'Imported', type: 'missing' })) }], rootNode);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(result.error);
    const applied = applyScriptPluginActions(rootNode, result.actions);
    expect(applied.rootNode.children).toHaveLength(1001);
    expect(applied.rootNode.children[1000].nodeTypeId).toBeUndefined();
    expect(getEffectiveNodeStyle(applied.rootNode.children[1000])).toEqual(DEFAULT_NODE_STYLE);
    expect(rootNode.children).toHaveLength(1);
  });

  it('accepts exactly 1000 updates and rejects 1001', () => {
    const updates = Array.from({ length: 1000 }, (_, index) => ({ nodeId: 'node-1', patch: { text: String(index) } }));
    const result = validateScriptPluginActions([{ type: 'updateNodes', updates }], rootNode);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(result.error);
    expect(applyScriptPluginActions(rootNode, result.actions).rootNode.children[0].text).toBe('999');
    expect(validateScriptPluginActions([{ type: 'updateNodes', updates: [...updates, updates[0]] }], rootNode).valid).toBe(false);
  });

  it('creates a typed tree with unique IDs and returns the export location', () => {
    const result = validateScriptPluginActions([
      { type: 'createMindmap', rootNode: { text: 'New', nodeTypeId: 'task', children: [{ text: 'Child', nodeTypeId: 'missing' }] } },
      { type: 'showMessage', message: 'Done', exportPath: 'C:/exports/result.txt' },
    ], rootNode);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(result.error);
    const applied = applyScriptPluginActions(rootNode, result.actions, [taskType]);
    expect(applied.rootNode.text).toBe('New');
    expect(applied.rootNode.nodeTypeId).toBe('task');
    expect(applied.rootNode.children[0].nodeTypeId).toBeUndefined();
    expect(applied.rootNode.id).not.toBe(applied.rootNode.children[0].id);
    expect(applied.messages[0].exportPath).toBe('C:/exports/result.txt');
  });

  it('applies types at every depth and keeps ordered edits to existing nodes', () => {
    const result = validateScriptPluginActions([
      { type: 'updateNode', nodeId: 'node-1', patch: { text: 'Updated', remark: 'A' } },
      { type: 'addChildNode', parentId: 'node-1', node: { text: 'Branch', type: 'task', children: [{ text: 'Nested', nodeTypeId: 'task', remark: '', children: [{ text: 'Leaf' }] }] } },
      { type: 'appendNodeRemark', nodeId: 'node-1', text: 'B' },
      { type: 'addChildNodes', parentId: 'node-1', nodes: [{ text: 'Second', children: [{ text: 'Other leaf' }] }] },
      { type: 'appendNodeText', nodeId: 'node-1', text: ' title' },
    ], rootNode);
    if (!result.valid) throw new Error(result.error);
    const [parent] = applyScriptPluginActions(rootNode, result.actions, [taskType]).rootNode.children;
    expect(parent).toMatchObject({ text: 'Updated title', remark: 'AB', collapsed: false });
    const [branch, second] = parent.children;
    expect(branch).toMatchObject({ text: 'Branch', nodeTypeId: 'task', remark: taskType.defaultRemark });
    expect(getEffectiveNodeStyle(branch, taskType)).toMatchObject({ backgroundColor: '#ffff00', shape: 'pill' });
    expect(branch.children[0]).toMatchObject({ nodeTypeId: 'task', remark: '', children: [{ text: 'Leaf' }] });
    expect(second).toMatchObject({ text: 'Second', children: [{ text: 'Other leaf' }] });
  });

  it('rejects the entire batch on malformed, oversized or too-deep descendants', () => {
    const deep = Array.from({ length: 64 }).reduce<{ text: string; children?: unknown[] }>(
      (child) => ({ text: 'Parent', children: [child] }), { text: 'Leaf' },
    );
    for (const [node, error] of [
      [{ text: 'Branch', children: [{ text: 'Leaf', type: 123 }] }, /children\[0\]\.type/],
      [{ text: 'Branch', children: Array.from({ length: 1000 }, () => ({ text: 'Leaf' })) }, /最多 1000/],
      [deep, /最多 64 层/],
    ] as const) {
      expect(validateScriptPluginActions([
        { type: 'updateNode', nodeId: 'root', patch: { text: 'Skipped' } },
        { type: 'addChildNode', parentId: 'node-1', node },
      ], rootNode)).toMatchObject({ valid: false, actions: [], error: expect.stringMatching(error) });
    }
  });

  it('rejects malformed imported trees and mixed replacement batches', () => {
    expect(validateScriptPluginActions([{ type: 'createMindmap', rootNode: { text: 'New', children: [null] } }], rootNode).valid).toBe(false);
    expect(validateScriptPluginActions([{ type: 'createMindmap', rootNode: { text: 'New' } }, { type: 'updateNode', nodeId: 'root', patch: { text: 'Mixed' } }], rootNode).valid).toBe(false);
  });
});
