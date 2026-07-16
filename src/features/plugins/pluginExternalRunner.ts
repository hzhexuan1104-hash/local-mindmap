import type { ScriptPluginContext } from './pluginScriptActions';
import { isDesktopRuntime } from '../storage/userDataStorage';

export const EXTERNAL_COMMAND_TIMEOUT_MS = 5000;
export const EXTERNAL_STDOUT_LIMIT_BYTES = 1024 * 1024;

export type ExternalProcessResult = {
  status: 'success' | 'failed' | 'timeout' | 'output_limit';
  stdout: string;
  stderr: string;
  stdoutSize: number;
  stderrSize: number;
  exitCode: number | null;
  durationMs: number;
  error?: string;
};

export type PythonTestResult = {
  ok: boolean;
  command?: string;
  version?: string;
  exitCode: number | null;
  durationMs: number;
  error?: string;
};

type ExternalCommandInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let invokerOverride: ExternalCommandInvoker | null = null;

async function invokeExternal<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  const invoker =
    invokerOverride ??
    (async <R>(name: string, commandArgs?: Record<string, unknown>) => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<R>(name, commandArgs);
    });
  return invoker<T>(command, args);
}

export function setExternalCommandInvokerForTests(
  invoker: ExternalCommandInvoker | null,
) {
  invokerOverride = invoker;
}

export async function runExternalCommandPlugin(options: {
  pluginId: string;
  context: ScriptPluginContext;
  pythonPath: string;
  timeoutMs?: number;
}): Promise<ExternalProcessResult> {
  if (!isDesktopRuntime() && !invokerOverride) {
    throw new Error('外部命令插件仅支持桌面端。');
  }
  return invokeExternal<ExternalProcessResult>('run_external_command_plugin', {
    pluginId: options.pluginId,
    context: options.context,
    pythonPath: options.pythonPath,
    timeoutMs: options.timeoutMs ?? EXTERNAL_COMMAND_TIMEOUT_MS,
  });
}

export async function testPythonRuntime(
  pythonPath: string,
): Promise<PythonTestResult> {
  if (!isDesktopRuntime() && !invokerOverride) {
    throw new Error('Python 测试仅支持桌面端。');
  }
  return invokeExternal<PythonTestResult>('test_python_runtime', {
    pythonPath,
  });
}

export function parseExternalActionsOutput(stdout: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `stdout 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray((value as { actions?: unknown }).actions)
  ) {
    throw new Error('stdout 必须是包含 actions 数组的 JSON 对象。');
  }
  return (value as { actions: unknown[] }).actions;
}
