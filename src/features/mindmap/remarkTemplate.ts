export const VIRTUAL_REMARK_TEMPLATE = [
  '# 用例概述',
  '',
  '***',
  '',
  '# 执行步骤',
  '',
  '***',
  '',
  '# 预期结果',
].join('\n');

export function shouldShowVirtualRemarkTemplate(
  remark: string,
  isDismissed: boolean,
) {
  return remark.length === 0 && !isDismissed;
}

export function getRemarkEditorValue(
  remark: string,
  isVirtualTemplateVisible: boolean,
) {
  return isVirtualTemplateVisible ? VIRTUAL_REMARK_TEMPLATE : remark;
}

export function shouldPersistRemarkEditorValue(
  nextValue: string,
  isVirtualTemplateVisible: boolean,
) {
  return !isVirtualTemplateVisible || nextValue.length > 0;
}
