import type { MindmapNode } from './types';
import type { MindmapTemplate } from './templates';

type OfficialTemplateDefinition = {
  templateId: string;
  name: string;
  category: string;
  description: string;
  presetOrder: number;
  rootText: string;
  children: Array<{ text: string; remark?: string }>;
  themeId?: string;
};

function createNode(id: string, text: string, remark = ''): MindmapNode {
  return {
    id,
    text,
    remark,
    children: [],
  };
}

function createOfficialTemplate(
  definition: OfficialTemplateDefinition,
): MindmapTemplate {
  const rootNode = createNode(
    `${definition.templateId}-root`,
    definition.rootText,
    `# ${definition.rootText}\n\n可在这里补充整体说明、目标和背景。`,
  );

  rootNode.children = definition.children.map((child, index) =>
    createNode(
      `${definition.templateId}-${index + 1}`,
      child.text,
      child.remark ?? `### ${child.text}\n- 要点：\n- 补充说明：`,
    ),
  );

  return {
    id: definition.templateId,
    templateId: definition.templateId,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    createTime: `2026-06-24T00:${String(definition.presetOrder).padStart(
      2,
      '0',
    )}:00.000Z`,
    presetOrder: definition.presetOrder,
    isOfficial: true,
    rootNode,
    nodeTypes: [],
    themeId: definition.themeId ?? 'default-blue',
    thumbnail: `${definition.name}\n${definition.children.length + 1} 个节点`,
  };
}

export const OFFICIAL_TEMPLATES: MindmapTemplate[] = [
  createOfficialTemplate({
    templateId: 'official-project-management',
    name: '项目管理模板',
    category: '项目管理',
    description: '用于项目启动、计划、风险和验收的通用项目管理结构。',
    presetOrder: 1,
    rootText: '项目总览',
    children: [
      { text: '项目背景' },
      { text: '需求分析' },
      { text: '任务分解' },
      { text: '时间计划' },
      {
        text: '风险管理',
        remark:
          '### 风险清单\n- 风险项：\n- 影响：\n- 应对措施：',
      },
      {
        text: '测试验收',
        remark:
          '### 验收清单\n- 验收项：\n- 负责人：\n- 完成标准：',
      },
    ],
  }),
  createOfficialTemplate({
    templateId: 'official-meeting-notes',
    name: '会议纪要模板',
    category: '办公协作',
    description: '用于记录会议主题、议程、讨论要点、决议和待办任务。',
    presetOrder: 2,
    rootText: '会议纪要',
    children: [
      { text: '会议主题' },
      { text: '参会人员' },
      { text: '会议议程' },
      { text: '讨论要点' },
      {
        text: '决议事项',
        remark: '### 决议\n- 决议内容：\n- 负责人：\n- 截止时间：',
      },
      {
        text: '待办任务',
        remark: '### 待办\n- 任务：\n- 负责人：\n- 截止时间：',
      },
    ],
    themeId: 'simple-gray',
  }),
  createOfficialTemplate({
    templateId: 'official-study-notes',
    name: '学习笔记模板',
    category: '学习成长',
    description: '用于梳理知识结构、重点难点、案例和复习安排。',
    presetOrder: 3,
    rootText: '学习笔记',
    children: [
      { text: '核心概念' },
      { text: '知识结构' },
      {
        text: '重点难点',
        remark: '### 重点难点\n- 重点：\n- 难点：\n- 解决方法：',
      },
      { text: '案例分析' },
      { text: '复习计划' },
    ],
    themeId: 'fresh-green',
  }),
  createOfficialTemplate({
    templateId: 'official-product-requirements',
    name: '产品需求模板',
    category: '产品设计',
    description: '用于组织用户画像、场景、功能需求和迭代计划。',
    presetOrder: 4,
    rootText: '产品需求',
    children: [
      { text: '用户画像' },
      { text: '使用场景' },
      { text: '功能需求' },
      { text: '非功能需求' },
      {
        text: '验收标准',
        remark: '### 验收标准\n- 场景：\n- 操作：\n- 预期结果：',
      },
      { text: '迭代计划' },
    ],
  }),
  createOfficialTemplate({
    templateId: 'official-problem-analysis',
    name: '问题分析模板',
    category: '分析决策',
    description: '用于拆解问题、影响、原因、解决方案和复盘总结。',
    presetOrder: 5,
    rootText: '问题分析',
    children: [
      { text: '问题描述' },
      { text: '影响范围' },
      { text: '原因分析' },
      { text: '解决方案' },
      { text: '行动计划' },
      { text: '复盘总结' },
    ],
    themeId: 'active-orange',
  }),
  createOfficialTemplate({
    templateId: 'official-personal-plan',
    name: '个人计划模板',
    category: '个人效率',
    description: '用于规划年度目标、月度计划、每周任务和习惯养成。',
    presetOrder: 6,
    rootText: '个人计划',
    children: [
      { text: '年度目标' },
      { text: '月度计划' },
      { text: '每周任务' },
      {
        text: '习惯养成',
        remark: '### 习惯追踪\n- 习惯：\n- 频率：\n- 复盘：',
      },
      { text: '复盘总结' },
    ],
    themeId: 'fresh-green',
  }),
  createOfficialTemplate({
    templateId: 'official-reading-notes',
    name: '读书笔记模板',
    category: '学习成长',
    description: '用于沉淀书籍信息、核心观点、章节摘要和行动启发。',
    presetOrder: 7,
    rootText: '读书笔记',
    children: [
      { text: '书籍信息' },
      { text: '核心观点' },
      { text: '章节摘要' },
      { text: '金句摘录' },
      { text: '个人思考' },
      { text: '行动启发' },
    ],
  }),
  createOfficialTemplate({
    templateId: 'official-competition-plan',
    name: '竞赛方案模板',
    category: '方案设计',
    description: '用于竞赛方案设计、建模思路、技术路线和验收指标。',
    presetOrder: 8,
    rootText: '竞赛方案',
    children: [
      { text: '赛题理解' },
      { text: '方案目标' },
      { text: '数据来源' },
      { text: '建模思路' },
      { text: '技术路线' },
      { text: '创新亮点' },
      {
        text: '验收指标',
        remark: '### 指标\n- 指标名称：\n- 计算方式：\n- 达成标准：',
      },
    ],
    themeId: 'default-blue',
  }),
];

