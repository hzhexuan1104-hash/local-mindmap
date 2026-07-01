import type { ScriptPluginContext } from './pluginScriptActions';

export type ScriptRunResult =
  | {
      ok: true;
      actions: unknown;
      durationMs: number;
    }
  | {
      ok: false;
      error: string;
      durationMs: number;
    };

export const DEFAULT_SCRIPT_TIMEOUT_MS = 1500;

type ScriptWorkerPayload =
  | { ok: true; actions: unknown }
  | { ok: false; error: string };

function normalizeScriptSource(source: string) {
  return source
    .replace(/\bexport\s+async\s+function\s+run\s*\(/, 'async function run(')
    .replace(/\bexport\s+function\s+run\s*\(/, 'function run(');
}

function validateScriptSourceSafety(source: string) {
  if (/\bimport\s*\(/.test(source)) {
    return '脚本插件不支持动态 import 或远程模块。';
  }
  if (/\b(?:SharedWorker|Worker)\s*\(/.test(source)) {
    return '脚本插件不允许创建子 Worker。';
  }
  return null;
}

function createWorkerSource(source: string, context: ScriptPluginContext) {
  return `
const blocked = () => {
  throw new Error("脚本插件不支持网络、远程模块或宿主 API。");
};
self.fetch = blocked;
self.XMLHttpRequest = undefined;
self.WebSocket = undefined;
self.EventSource = undefined;
self.importScripts = blocked;
self.Worker = undefined;
self.SharedWorker = undefined;
self.WebTransport = undefined;
self.RTCPeerConnection = undefined;
self.window = undefined;
self.document = undefined;
self.__TAURI__ = undefined;
self.__TAURI_INTERNALS__ = undefined;

(async () => {
  try {
    const context = ${JSON.stringify(context)};
    ${normalizeScriptSource(source)}
    if (typeof run !== "function") {
      throw new Error("脚本入口必须声明 run(context)。");
    }
    const actions = await run(JSON.parse(JSON.stringify(context)));
    self.postMessage({ ok: true, actions: JSON.parse(JSON.stringify(actions ?? [])) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
})();
`;
}

export function runScriptPlugin(options: {
  source: string;
  context: ScriptPluginContext;
  timeoutMs?: number;
}): Promise<ScriptRunResult> {
  const startedAt = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS;
  const safetyError = validateScriptSourceSafety(options.source);
  if (safetyError) {
    return Promise.resolve({
      ok: false,
      error: safetyError,
      durationMs: 0,
    });
  }

  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return Promise.resolve({
      ok: false,
      error: '当前环境不支持 Web Worker，无法运行脚本插件。',
      durationMs: 0,
    });
  }

  const workerSource = createWorkerSource(options.source, options.context);
  const workerUrl = URL.createObjectURL(
    new Blob([workerSource], { type: 'text/javascript;charset=utf-8' }),
  );
  const worker = new Worker(workerUrl);

  return new Promise<ScriptRunResult>((resolve) => {
    let completed = false;
    const finish = (result: ScriptWorkerPayload) => {
      if (completed) {
        return;
      }
      completed = true;
      window.clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        ...result,
        durationMs: Math.round(performance.now() - startedAt),
      } as ScriptRunResult);
    };
    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        error: `脚本执行超时（${timeoutMs}ms）。`,
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { ok?: boolean; actions?: unknown; error?: string };
      if (data.ok) {
        finish({ ok: true, actions: data.actions ?? [] });
      } else {
        finish({ ok: false, error: data.error || '脚本执行失败。' });
      }
    };
    worker.onerror = (event) => {
      finish({ ok: false, error: event.message || '脚本执行失败。' });
    };
  });
}
