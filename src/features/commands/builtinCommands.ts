import type { CommandCategory, CommandContext, CommandDefinition } from './commandTypes';

type BuiltinOptions = {
  description?: string;
  keywords?: string[];
  shortcut?: string;
  disabledReason?: (context: CommandContext) => string | undefined;
  riskLevel?: CommandDefinition['riskLevel'];
};

const hasSelection = (context: CommandContext) =>
  context.selectedNodeIds.length > 0 ? undefined : '请先选择节点';
const hasPrimarySelection = (context: CommandContext) =>
  context.selectedNodeId ? undefined : '请先选择节点';
const notRootSelection = (context: CommandContext) => {
  if (!context.selectedNodeId) return '请先选择节点';
  return context.selectedNodeId === context.mindmap.id
    ? '中心主题不能新建同级节点'
    : undefined;
};
const hasFocusRoot = (context: CommandContext) =>
  context.focusedRootId ? undefined : '当前未处于分支聚焦状态';

function builtin(
  id: string,
  title: string,
  category: CommandCategory,
  actionId: string,
  options: BuiltinOptions = {},
): CommandDefinition {
  return {
    id: `builtin.${id}`,
    title,
    category,
    source: 'builtin',
    ...options,
    execute: async (context) => {
      const action = context.actions[actionId];
      if (!action) throw new Error(`命令执行入口不可用：builtin.${id}`);
      await action();
    },
  };
}

export function createBuiltinCommands(): CommandDefinition[] {
  return [
    builtin('file.new', '新建导图', 'file', 'file.new', { keywords: ['新建', 'new', '空白'] }),
    builtin('file.open', '打开导图', 'file', 'file.open', { shortcut: 'Ctrl+O', keywords: ['打开', 'open', '文件'] }),
    builtin('file.save', '保存', 'file', 'file.save', { shortcut: 'Ctrl+S', keywords: ['保存', 'save'] }),
    builtin('file.saveAs', '另存为', 'file', 'file.saveAs', { keywords: ['另存为', 'save as'] }),
    builtin('file.import', '打开导入面板', 'file', 'file.import', { keywords: ['导入', 'import', 'markdown', 'excel', 'json'] }),
    builtin('file.importMarkdown', '导入 Markdown', 'file', 'file.importMarkdown', { keywords: ['导入', 'import', 'md', 'markdown'] }),
    builtin('file.importExcel', '导入 Excel', 'file', 'file.importExcel', { keywords: ['导入', 'import', 'xlsx', 'excel'] }),
    builtin('file.importJson', '导入 JSON', 'file', 'file.importJson', { keywords: ['导入', 'import', 'json'] }),
    builtin('file.export', '打开导出入口', 'file', 'file.export', { keywords: ['导出', 'export'] }),
    builtin('file.exportPng', '导出 PNG', 'file', 'file.exportPng', { keywords: ['导出', 'export', 'png', '图片'] }),
    builtin('file.exportMarkdown', '导出 Markdown', 'file', 'file.exportMarkdown', { keywords: ['导出', 'export', 'md', 'markdown'] }),
    builtin('file.exportExcel', '导出 Excel', 'file', 'file.exportExcel', { keywords: ['导出', 'export', 'xlsx', 'excel'] }),
    builtin('file.exportJson', '导出 JSON', 'file', 'file.exportJson', { keywords: ['导出', 'export', 'json'] }),
    builtin('file.exportTxt', '导出 TXT', 'file', 'file.exportTxt', { keywords: ['导出', 'export', 'txt', '文本'] }),
    builtin('file.exportFocused', '导出当前聚焦分支', 'file', 'file.exportFocused', { keywords: ['导出', '聚焦', 'focus'], disabledReason: hasFocusRoot }),
    builtin('history.snapshot', '创建版本快照', 'history', 'history.snapshot', { keywords: ['历史', '版本', '快照', 'snapshot'] }),
    builtin('history.open', '打开版本历史', 'history', 'history.open', { keywords: ['历史', '版本', 'history'] }),
    builtin('history.recovery', '打开恢复中心', 'history', 'history.recovery', { keywords: ['恢复', '草稿', 'recovery'] }),
    builtin('file.recent', '打开最近文件', 'file', 'file.recent', { keywords: ['最近', '文件', 'recent'] }),

    builtin('edit.undo', '撤销', 'edit', 'edit.undo', { shortcut: 'Ctrl+Z', keywords: ['撤销', 'undo'] }),
    builtin('edit.redo', '重做', 'edit', 'edit.redo', { shortcut: 'Ctrl+Y', keywords: ['重做', 'redo'] }),
    builtin('edit.find', '查找', 'edit', 'edit.find', { shortcut: 'Ctrl+F', keywords: ['查找', '搜索', 'find'] }),
    builtin('edit.replace', '替换', 'edit', 'edit.replace', { shortcut: 'Ctrl+H', keywords: ['替换', 'replace'] }),
    builtin('edit.copy', '复制节点', 'edit', 'edit.copy', { shortcut: 'Ctrl+C', disabledReason: hasSelection }),
    builtin('edit.cut', '剪切节点', 'edit', 'edit.cut', { shortcut: 'Ctrl+X', disabledReason: hasSelection }),
    builtin('edit.paste', '粘贴节点', 'edit', 'edit.paste', { shortcut: 'Ctrl+V' }),
    builtin('node.delete', '删除当前节点', 'node', 'node.delete', { keywords: ['删除', 'delete'], disabledReason: hasSelection, riskLevel: 'medium' }),
    builtin('node.edit', '编辑当前节点', 'node', 'node.edit', { keywords: ['编辑', 'edit'], disabledReason: hasPrimarySelection }),

    builtin('node.addChild', '新建子节点', 'node', 'node.addChild', { shortcut: 'Tab', keywords: ['新建', '添加', '子节点'], disabledReason: hasPrimarySelection }),
    builtin('node.addSibling', '新建同级节点', 'node', 'node.addSibling', { shortcut: 'Enter', keywords: ['新建', '添加', '同级'], disabledReason: notRootSelection }),
    builtin('node.remark', '打开节点备注', 'node', 'node.remark', { keywords: ['备注', 'remark', 'markdown'], disabledReason: hasPrimarySelection }),
    builtin('node.collapse', '折叠当前分支', 'node', 'node.collapse', { keywords: ['折叠', '收起'], disabledReason: hasPrimarySelection }),
    builtin('node.expand', '展开当前分支', 'node', 'node.expand', { keywords: ['展开'], disabledReason: hasPrimarySelection }),
    builtin('node.focus', '聚焦当前分支', 'navigation', 'node.focus', { keywords: ['聚焦', 'focus'], disabledReason: hasPrimarySelection }),
    builtin('node.exitFocus', '退出分支聚焦', 'navigation', 'node.exitFocus', { keywords: ['退出', '聚焦', 'focus'], disabledReason: hasFocusRoot }),
    builtin('node.saveStyleAsType', '保存当前样式为节点类型', 'node-type', 'node.saveStyleAsType', { disabledReason: hasPrimarySelection }),
    builtin('node.resetStyle', '重置为节点类型默认样式', 'node-type', 'node.resetStyle', { disabledReason: hasPrimarySelection }),
    builtin('node.manageTypes', '管理全局节点类型', 'node-type', 'node.manageTypes', { keywords: ['节点类型', '类型', '管理'] }),
    builtin('node.locate', '定位当前节点', 'navigation', 'node.locate', { keywords: ['定位', 'locate'], disabledReason: hasPrimarySelection }),
    builtin('node.selectParent', '选择父节点', 'navigation', 'node.selectParent', { disabledReason: (context) => {
      if (!context.selectedNodeId) return '请先选择节点';
      return context.mindmapIndex.parentById.get(context.selectedNodeId) ? undefined : '中心主题没有父节点';
    } }),
    builtin('node.selectFirstChild', '选择第一个子节点', 'navigation', 'node.selectFirstChild', { disabledReason: (context) => {
      if (!context.selectedNodeId) return '请先选择节点';
      return context.mindmapIndex.childrenById.get(context.selectedNodeId)?.length ? undefined : '当前节点没有子节点';
    } }),

    builtin('view.outline', '打开 / 关闭大纲', 'view', 'view.outline', { keywords: ['大纲', 'outline'] }),
    builtin('view.minimap', '打开 / 关闭小地图', 'view', 'view.minimap', { keywords: ['小地图', 'minimap'] }),
    builtin('view.inspector', '打开 / 关闭右侧属性栏', 'view', 'view.inspector', { keywords: ['右侧', '属性', '备注'] }),
    builtin('view.center', '居中画布', 'view', 'view.center', { keywords: ['居中', 'center'] }),
    builtin('view.zoomIn', '放大', 'view', 'view.zoomIn', { keywords: ['放大', 'zoom in'] }),
    builtin('view.zoomOut', '缩小', 'view', 'view.zoomOut', { keywords: ['缩小', 'zoom out'] }),
    builtin('view.zoomReset', '重置缩放', 'view', 'view.zoomReset', { keywords: ['重置', '缩放', '100%'] }),
    builtin('view.expandAll', '全部展开', 'view', 'view.expandAll', { keywords: ['全部', '展开'] }),
    builtin('view.collapseAll', '全部折叠', 'view', 'view.collapseAll', { keywords: ['全部', '折叠', '收起'] }),
    builtin('view.expandDepth1', '展开到第 1 层', 'view', 'view.expandDepth1'),
    builtin('view.expandDepth2', '展开到第 2 层', 'view', 'view.expandDepth2'),
    builtin('view.expandDepth3', '展开到第 3 层', 'view', 'view.expandDepth3'),
    builtin('view.performance', '打开性能信息', 'view', 'view.performance', { keywords: ['性能', 'performance'] }),
    builtin('view.autoPerformance', '切换自动性能模式', 'view', 'view.autoPerformance', { keywords: ['自动', '性能'] }),
    builtin('view.layout', '重新自动布局', 'view', 'view.layout', { keywords: ['布局', 'layout', '结构'] }),

    builtin('template.library', '打开模板库', 'template', 'template.library', { keywords: ['模板', 'template'] }),
    builtin('plugin.manager', '打开插件管理', 'plugin', 'plugin.manager', { keywords: ['插件', 'plugin', '管理'] }),
    builtin('plugin.gallery', '打开本地插件中心', 'plugin', 'plugin.gallery', { keywords: ['插件', '本地', '中心'] }),
    builtin('plugin.workbench', '打开插件开发者工作台', 'developer', 'plugin.workbench', { keywords: ['插件', '开发', 'workbench'] }),
    builtin('plugin.diagnostics', '打开插件诊断中心', 'developer', 'plugin.diagnostics', { keywords: ['插件', '诊断'] }),
    builtin('plugin.logs', '打开插件日志', 'developer', 'plugin.logs', { keywords: ['插件', '日志', 'log'] }),
    builtin('help.guide', '打开使用指南', 'help', 'help.guide', { keywords: ['帮助', '指南', 'guide'] }),
    builtin('help.shortcuts', '打开快捷键说明', 'help', 'help.shortcuts', { keywords: ['快捷键', 'shortcuts'] }),
    builtin('help.about', '关于 Local Mindmap', 'help', 'help.about', { keywords: ['关于', 'about'] }),
    builtin('settings.commandPalette', '打开命令面板设置', 'help', 'settings.commandPalette', { keywords: ['设置', '命令面板'] }),
  ];
}
