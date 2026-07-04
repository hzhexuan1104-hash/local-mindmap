import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseExternalActionsOutput,
  runExternalCommandPlugin,
  setExternalCommandInvokerForTests,
  testPythonRuntime,
} from '../pluginExternalRunner';
import type { ScriptPluginContext } from '../pluginScriptActions';
import {
  applyScriptPluginActions,
  validateScriptPluginActions,
} from '../pluginScriptActions';
import type { MindmapNode } from '../../mindmap/types';

const context: ScriptPluginContext = {
  contextVersion: 1,
  app: { version: '1.9.0', platform: 'desktop' },
  mindmap: {
    title: 'Root',
    nodeCount: 1,
    selectedNodeId: 'root',
    rootNodeId: 'root',
  },
  selectedNode: {
    id: 'root',
    text: 'Root',
    remark: '',
    parentId: null,
    childrenIds: [],
    type: 'default',
  },
  nodes: [],
  selection: { nodeIds: ['root'] },
};

afterEach(() => setExternalCommandInvokerForTests(null));

describe('external command bridge', () => {
  it('parses only the object actions protocol', () => {
    expect(
      parseExternalActionsOutput('{"actions":[{"type":"showMessage","message":"ok"}]}'),
    ).toHaveLength(1);
    expect(() => parseExternalActionsOutput('not-json')).toThrow(
      'stdout 不是合法 JSON',
    );
    expect(() => parseExternalActionsOutput('[]')).toThrow(
      '包含 actions 数组',
    );
  });

  it('parses and applies ensure_ascii=False Chinese actions', () => {
    const root: MindmapNode = {
      id: 'root',
      text: '中心主题',
      remark: '',
      children: [],
    };
    const actions = parseExternalActionsOutput(
      '{"actions":[{"type":"addChildNodes","parentId":"root","nodes":[{"text":"中文关键词","remark":"中文备注"}]},{"type":"showMessage","message":"处理完成"}]}',
    );
    const validation = validateScriptPluginActions(actions, root);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    const applied = applyScriptPluginActions(root, validation.actions);
    expect(applied.rootNode.children[0]).toMatchObject({
      text: '中文关键词',
      remark: '中文备注',
    });
    expect(applied.messages[0].message).toBe('处理完成');
  });

  it('passes context and fixed runner options to Tauri', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: 'success',
      stdout: '{"actions":[]}',
      stderr: '',
      stdoutSize: 14,
      stderrSize: 0,
      exitCode: 0,
      durationMs: 10,
    });
    setExternalCommandInvokerForTests(invoke);
    await runExternalCommandPlugin({
      pluginId: 'localmindmap.test.external',
      context,
      pythonPath: 'python',
    });
    expect(invoke).toHaveBeenCalledWith(
      'run_external_command_plugin',
      expect.objectContaining({
        pluginId: 'localmindmap.test.external',
        context,
        pythonPath: 'python',
        timeoutMs: 5000,
      }),
    );
  });

  it('uses a dedicated Python version command', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      version: 'Python 3.12.0',
      exitCode: 0,
      durationMs: 5,
    });
    setExternalCommandInvokerForTests(invoke);
    await expect(testPythonRuntime('python3')).resolves.toMatchObject({
      ok: true,
    });
    expect(invoke).toHaveBeenCalledWith('test_python_runtime', {
      pythonPath: 'python3',
    });
  });
});
