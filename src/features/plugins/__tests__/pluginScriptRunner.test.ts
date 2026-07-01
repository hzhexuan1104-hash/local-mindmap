import { afterEach, describe, expect, it } from 'vitest';
import { runScriptPlugin } from '../pluginScriptRunner';
import type { ScriptPluginContext } from '../pluginScriptActions';

const context: ScriptPluginContext = {
  app: { version: '1.8.0', platform: 'desktop' },
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
  nodes: [{
    id: 'root',
    text: 'Root',
    remark: '',
    parentId: null,
    childrenIds: [],
    type: 'default',
  }],
  selection: { nodeIds: ['root'] },
};

const originalWorker = globalThis.Worker;
const originalWindow = globalThis.window;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: originalWorker,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('script plugin worker runner', () => {
  it('rejects dynamic imports before creating a worker', async () => {
    await expect(
      runScriptPlugin({
        source: 'async function run() { return import("https://example.com/x.js"); }',
        context,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: '脚本插件不支持动态 import 或远程模块。',
    });
  });

  it('terminates a script worker after the configured timeout', async () => {
    class SilentWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      terminate() {}
    }
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: SilentWorker,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    });
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};

    const result = await runScriptPlugin({
      source: 'async function run() { while (true) {} }',
      context,
      timeoutMs: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      error: '脚本执行超时（5ms）。',
    });
  });
});
