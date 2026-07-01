import { describe, expect, it } from 'vitest';
import type { MindmapNode, MindmapProject } from '../../mindmap/types';
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../../mindmap/history';
import {
  applyScriptPluginActions,
  createScriptPluginContext,
  validateScriptPluginActions,
} from '../pluginScriptActions';
import {
  resolveWorkflowActions,
  requestWorkflowTrustDecision,
  workflowHasWriteActions,
} from '../pluginWorkflow';

const rootNode: MindmapNode = {
  id: 'root',
  text: 'Project Alpha',
  remark: '',
  children: [{
    id: 'node-1',
    text: 'Meeting',
    remark: 'Initial remark',
    children: [],
  }],
};

const context = createScriptPluginContext(rootNode, 'node-1');

describe('JSON Action workflow variables', () => {
  it('resolves selected node, mindmap and date variables in IDs and text', () => {
    const result = resolveWorkflowActions(
      [{
        type: 'addChildNodes',
        parentId: '$selectedNode.id',
        nodes: [{
          text: '基于 $selectedNode.text 的子任务',
          remark:
            '$mindmap.title | $selectedNode.remark | $date.today | $date.now',
        }],
      }],
      context,
      new Date('2026-07-01T12:34:56.000Z'),
    );

    expect(result).toEqual({
      ok: true,
      actions: [{
        type: 'addChildNodes',
        parentId: 'node-1',
        nodes: [{
          text: '基于 Meeting 的子任务',
          remark:
            'Project Alpha | Initial remark | 2026-07-01 | 2026-07-01T12:34:56.000Z',
        }],
      }],
      error: null,
    });
  });

  it('fails on unknown variables without partially resolving the batch', () => {
    expect(
      resolveWorkflowActions(
        [
          { type: 'showMessage', message: '$date.today' },
          { type: 'showMessage', message: '$unknown.value' },
        ],
        context,
      ),
    ).toEqual({
      ok: false,
      actions: [],
      error: '未知 workflow 变量：$unknown.value',
    });
  });

  it('fails when selectedNode variables are used without a selection', () => {
    const noSelection = createScriptPluginContext(rootNode, null);
    expect(
      resolveWorkflowActions(
        [{
          type: 'updateNode',
          nodeId: '$selectedNode.id',
          patch: { text: 'updated' },
        }],
        noSelection,
      ),
    ).toEqual({
      ok: false,
      actions: [],
      error: '变量 $selectedNode.id 需要先选择节点。',
    });
  });

  it('rejects JavaScript template expressions', () => {
    expect(
      resolveWorkflowActions(
        [{ type: 'showMessage', message: '${selectedNode.id}' }],
        context,
      ),
    ).toMatchObject({
      ok: false,
      error: 'workflow 不支持 JavaScript 模板表达式。',
    });
  });
});

describe('JSON Action workflow trust decisions', () => {
  it('supports cancel, allow-once and persistent trust choices', () => {
    expect(
      requestWorkflowTrustDecision('Workflow', ['node:write'], () => false),
    ).toBe('cancel');

    const allowOnceAnswers = [true, false];
    expect(
      requestWorkflowTrustDecision(
        'Workflow',
        ['node:write'],
        () => allowOnceAnswers.shift()!,
      ),
    ).toBe('allow-once');

    const trustAnswers = [true, true];
    expect(
      requestWorkflowTrustDecision(
        'Workflow',
        ['node:write'],
        () => trustAnswers.shift()!,
      ),
    ).toBe('trust');
  });
});

describe('JSON Action workflow execution through the shared protocol', () => {
  it('executes addChildNodes, updateNodes, appendNodeText and showMessage', () => {
    const resolution = resolveWorkflowActions(
      [
        {
          type: 'updateNodes',
          updates: [{
            nodeId: '$selectedNode.id',
            patch: { remark: 'Updated by workflow' },
          }],
        },
        {
          type: 'appendNodeText',
          nodeId: '$selectedNode.id',
          text: ' ✅',
        },
        {
          type: 'addChildNodes',
          parentId: '$selectedNode.id',
          nodes: [{ text: 'Agenda' }, { text: 'Actions' }],
        },
        { type: 'showMessage', message: 'Done for $selectedNode.text' },
      ],
      context,
    );
    if (!resolution.ok) throw new Error(resolution.error);
    const validation = validateScriptPluginActions(resolution.actions, rootNode);
    if (!validation.valid) throw new Error(validation.error);

    const applied = applyScriptPluginActions(rootNode, validation.actions);
    expect(applied.rootNode.children[0]).toMatchObject({
      text: 'Meeting ✅',
      remark: 'Updated by workflow',
    });
    expect(applied.rootNode.children[0].children).toHaveLength(2);
    expect(applied.messages[0].message).toBe('Done for Meeting');
  });

  it('rejects deleteNode and oversized child batches atomically', () => {
    const deleteResult = validateScriptPluginActions(
      [
        { type: 'appendNodeText', nodeId: 'node-1', text: ' changed' },
        { type: 'deleteNode', nodeId: 'node-1' },
      ],
      rootNode,
    );
    expect(deleteResult.valid).toBe(false);
    expect(rootNode.children[0].text).toBe('Meeting');

    expect(
      validateScriptPluginActions(
        [{
          type: 'addChildNodes',
          parentId: 'node-1',
          nodes: Array.from({ length: 21 }, () => ({ text: 'child' })),
        }],
        rootNode,
      ),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining('最多 20'),
    });
  });

  it('creates one undo step for a modifying workflow batch', () => {
    const validation = validateScriptPluginActions(
      [{
        type: 'addChildNodes',
        parentId: 'node-1',
        nodes: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      }],
      rootNode,
    );
    if (!validation.valid) throw new Error(validation.error);
    const before: MindmapProject = {
      rootNode,
      nodeTypes: [],
      themeId: 'default-blue',
    };
    const after: MindmapProject = {
      ...before,
      rootNode: applyScriptPluginActions(
        rootNode,
        validation.actions,
      ).rootNode,
    };
    const history = pushHistory(createHistoryState(), before);
    const undone = undoHistory(history, after)!;
    const redone = redoHistory(undone.history, undone.project)!;
    expect(history.past).toHaveLength(1);
    expect(undone.project.rootNode.children[0].children).toHaveLength(0);
    expect(redone.project.rootNode.children[0].children).toHaveLength(3);
  });

  it('identifies showMessage-only workflows as non-writing', () => {
    const actions = [{ type: 'showMessage', message: 'hello' }];
    expect(workflowHasWriteActions(actions)).toBe(false);
    const validation = validateScriptPluginActions(actions, rootNode);
    if (!validation.valid) throw new Error(validation.error);
    expect(
      applyScriptPluginActions(rootNode, validation.actions).mutationCount,
    ).toBe(0);
  });
});
