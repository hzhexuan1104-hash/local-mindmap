export type PluginActionNodePatch = {
  text?: string;
  remark?: string;
};

export type AddNodeAction = {
  type: 'addNode';
  nodeId?: string;
  parentId?: string;
  text: string;
  remark?: string;
};

export type AddChildNodeAction = {
  type: 'addChildNode';
  parentId: string;
  nodeId?: string;
  text: string;
  remark?: string;
};

export type UpdateNodeAction = {
  type: 'updateNode';
  nodeId: string;
  patch: PluginActionNodePatch;
};

export type DeleteNodeAction = {
  type: 'deleteNode';
  nodeId: string;
};

export type SetNodeRemarkAction = {
  type: 'setNodeRemark';
  nodeId: string;
  remark: string;
};

export type ShowMessageAction = {
  type: 'showMessage';
  message: string;
  level?: 'info' | 'warning' | 'error';
};

export type ExportDataAction = {
  type: 'exportData';
  format: string;
  data?: unknown;
  fileName?: string;
};

export type ApplyTemplateAction = {
  type: 'applyTemplate';
  templateId: string;
};

export type PluginAction =
  | AddNodeAction
  | AddChildNodeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | SetNodeRemarkAction
  | ShowMessageAction
  | ExportDataAction
  | ApplyTemplateAction;

export type PluginActionValidationResult =
  | { valid: true; action: PluginAction; errors: [] }
  | { valid: false; action: null; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function invalid(...errors: string[]): PluginActionValidationResult {
  return { valid: false, action: null, errors };
}

export function validatePluginAction(
  value: unknown,
): PluginActionValidationResult {
  if (!isRecord(value)) {
    return invalid('Plugin action 必须是 JSON 对象。');
  }
  if (!isNonEmptyString(value.type)) {
    return invalid('Plugin action 缺少 type。');
  }

  switch (value.type) {
    case 'addNode':
      return isNonEmptyString(value.text)
        ? { valid: true, action: value as AddNodeAction, errors: [] }
        : invalid('addNode.text 必须是非空字符串。');
    case 'addChildNode':
      return isNonEmptyString(value.parentId) && isNonEmptyString(value.text)
        ? { valid: true, action: value as AddChildNodeAction, errors: [] }
        : invalid('addChildNode.parentId 和 text 必须是非空字符串。');
    case 'updateNode': {
      if (!isNonEmptyString(value.nodeId) || !isRecord(value.patch)) {
        return invalid('updateNode.nodeId 和 patch 必填。');
      }
      const hasText = typeof value.patch.text === 'string';
      const hasRemark = typeof value.patch.remark === 'string';
      return hasText || hasRemark
        ? { valid: true, action: value as UpdateNodeAction, errors: [] }
        : invalid('updateNode.patch 至少包含 text 或 remark。');
    }
    case 'deleteNode':
      return isNonEmptyString(value.nodeId)
        ? { valid: true, action: value as DeleteNodeAction, errors: [] }
        : invalid('deleteNode.nodeId 必须是非空字符串。');
    case 'setNodeRemark':
      return isNonEmptyString(value.nodeId) && typeof value.remark === 'string'
        ? { valid: true, action: value as SetNodeRemarkAction, errors: [] }
        : invalid('setNodeRemark.nodeId 和 remark 必填。');
    case 'showMessage':
      return isNonEmptyString(value.message)
        ? { valid: true, action: value as ShowMessageAction, errors: [] }
        : invalid('showMessage.message 必须是非空字符串。');
    case 'exportData':
      return isNonEmptyString(value.format)
        ? { valid: true, action: value as ExportDataAction, errors: [] }
        : invalid('exportData.format 必须是非空字符串。');
    case 'applyTemplate':
      return isNonEmptyString(value.templateId)
        ? { valid: true, action: value as ApplyTemplateAction, errors: [] }
        : invalid('applyTemplate.templateId 必须是非空字符串。');
    default:
      return invalid(`未知 Plugin action type：${value.type}`);
  }
}
