import type { ScriptPluginContext } from './pluginScriptActions';

export const WORKFLOW_ACTION_LIMIT = 20;

export type ActionWorkflowDefinition = {
  name: string;
  description: string;
  actions: unknown[];
};

export type WorkflowResolutionResult =
  | { ok: true; actions: unknown[]; error: null }
  | { ok: false; actions: []; error: string };

export type WorkflowTrustDecision = 'cancel' | 'allow-once' | 'trust';

const VARIABLE_PATTERN = /\$[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*/g;

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveVariable(
  variable: string,
  context: ScriptPluginContext,
  now: Date,
) {
  switch (variable) {
    case '$selectedNode.id':
      if (!context.selectedNode) {
        throw new Error('变量 $selectedNode.id 需要先选择节点。');
      }
      return context.selectedNode.id;
    case '$selectedNode.text':
      if (!context.selectedNode) {
        throw new Error('变量 $selectedNode.text 需要先选择节点。');
      }
      return context.selectedNode.text;
    case '$selectedNode.remark':
      if (!context.selectedNode) {
        throw new Error('变量 $selectedNode.remark 需要先选择节点。');
      }
      return context.selectedNode.remark;
    case '$mindmap.title':
      return context.mindmap.title;
    case '$date.today':
      return formatLocalDate(now);
    case '$date.now':
      return now.toISOString();
    default:
      throw new Error(`未知 workflow 变量：${variable}`);
  }
}

function resolveValue(
  value: unknown,
  context: ScriptPluginContext,
  now: Date,
): unknown {
  if (typeof value === 'string') {
    if (value.includes('${')) {
      throw new Error('workflow 不支持 JavaScript 模板表达式。');
    }
    return value.replace(VARIABLE_PATTERN, (variable) =>
      resolveVariable(variable, context, now),
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, context, now));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        resolveValue(child, context, now),
      ]),
    );
  }
  return value;
}

export function resolveWorkflowActions(
  actions: unknown[],
  context: ScriptPluginContext,
  now = new Date(),
): WorkflowResolutionResult {
  try {
    const resolved = resolveValue(actions, context, now);
    return {
      ok: true,
      actions: resolved as unknown[],
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      actions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getWorkflowActionTypes(actions: unknown[]) {
  return actions.map((action) =>
    typeof action === 'object' &&
    action !== null &&
    !Array.isArray(action) &&
    typeof (action as { type?: unknown }).type === 'string'
      ? (action as { type: string }).type
      : 'invalid',
  );
}

export function workflowHasWriteActions(actions: unknown[]) {
  return getWorkflowActionTypes(actions).some((type) => type !== 'showMessage');
}

export function requestWorkflowTrustDecision(
  pluginName: string,
  permissions: string[],
  confirm: (message: string) => boolean,
): WorkflowTrustDecision {
  const allowed = confirm(
    `该 JSON Action 工作流请求修改当前导图：\n插件：${pluginName}\n权限：${permissions.join(', ')}\n\n确定：继续选择“仅本次”或“信任”\n取消：取消执行`,
  );
  if (!allowed) return 'cancel';
  const trusted = confirm(
    `是否信任插件“${pluginName}”？\n\n确定：信任此插件，后续不再提示\n取消：仅允许本次执行`,
  );
  return trusted ? 'trust' : 'allow-once';
}
