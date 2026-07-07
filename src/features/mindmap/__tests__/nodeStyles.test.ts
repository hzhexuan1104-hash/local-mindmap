import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../history';
import {
  DEFAULT_NODE_STYLE,
  applyStyleToNodeType,
  createNodeTypeFromStyle,
  getEffectiveNodeStyle,
  getNodeShapeClassName,
  getNodeStyleCssVariables,
  mergeNodeStyle,
} from '../nodeStyles';
import { parseLmindProject } from '../openMindmap';
import { serializeLmindDocument } from '../saveMindmap';
import type { MindmapNode, MindmapNodeType, MindmapProject } from '../types';

const nodeType: MindmapNodeType = {
  id: 'type-task',
  name: 'Task',
  icon: 'T',
  shape: 'rounded',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
  textColor: '#14315f',
  fontSize: 18,
  bold: true,
  defaultText: 'New task',
  defaultRemark: 'Default remark',
};

const node: MindmapNode = {
  id: 'node-1',
  text: 'Current node',
  remark: 'Node remark',
  nodeTypeId: nodeType.id,
  children: [],
};

describe('node style helpers', () => {
  it('lets current node style override global node type style', () => {
    const styledNode: MindmapNode = {
      ...node,
      style: mergeNodeStyle(node.style, {
        shape: 'diamond',
        backgroundColor: '#dff6ff',
        borderColor: '#2f9e44',
        textColor: '#111111',
        fontSize: 20,
        bold: false,
      }),
    };

    expect(getEffectiveNodeStyle(styledNode, nodeType)).toMatchObject({
      shape: 'diamond',
      backgroundColor: '#dff6ff',
      borderColor: '#2f9e44',
      textColor: '#111111',
      fontSize: 20,
      bold: false,
    });
    expect(nodeType.backgroundColor).toBe('#fff7e8');
    expect(nodeType.borderColor).toBe('#f59f00');
    expect(nodeType.fontSize).toBe(18);
  });

  it('falls back from node type style to system defaults', () => {
    expect(getEffectiveNodeStyle({ ...node, nodeTypeId: undefined }, null)).toEqual(
      DEFAULT_NODE_STYLE,
    );
    expect(getEffectiveNodeStyle(node, nodeType)).toMatchObject({
      shape: nodeType.shape,
      backgroundColor: nodeType.backgroundColor,
      borderColor: nodeType.borderColor,
      textColor: nodeType.textColor,
      fontSize: nodeType.fontSize,
      bold: nodeType.bold,
    });
  });

  it('stores a changed current-node borderColor without changing same-type siblings', () => {
    const sibling: MindmapNode = {
      id: 'node-2',
      text: 'Same type node',
      remark: '',
      nodeTypeId: nodeType.id,
      children: [],
    };
    const styledNode: MindmapNode = {
      ...node,
      style: mergeNodeStyle(node.style, { borderColor: '#7048e8' }),
    };

    expect(styledNode.style?.borderColor).toBe('#7048e8');
    expect(getEffectiveNodeStyle(styledNode, nodeType).borderColor).toBe(
      '#7048e8',
    );
    expect(getEffectiveNodeStyle(sibling, nodeType).borderColor).toBe(
      nodeType.borderColor,
    );
  });

  it('passes the effective borderColor and diamond shape to renderer CSS variables', () => {
    const effectiveStyle = getEffectiveNodeStyle(
      {
        ...node,
        style: {
          shape: 'diamond',
          backgroundColor: '#e7f5ff',
          borderColor: '#1864ab',
          textColor: '#0b7285',
          fontSize: 22,
          bold: true,
        },
      },
      nodeType,
    );

    expect(getNodeShapeClassName(effectiveStyle)).toBe('shape-diamond');
    expect(getNodeStyleCssVariables(effectiveStyle)).toEqual({
      '--node-bg': '#e7f5ff',
      '--node-border': '#1864ab',
      '--node-text': '#0b7285',
      '--node-font-size': '22px',
      '--node-font-weight': 700,
    });
  });

  it('keeps rounded, rectangle, and pill renderer shape class names stable', () => {
    expect(
      ['rounded', 'rectangle', 'pill'].map((shape) =>
        getNodeShapeClassName({
          ...DEFAULT_NODE_STYLE,
          shape: shape as MindmapNodeType['shape'],
        }),
      ),
    ).toEqual(['shape-rounded', 'shape-rectangle', 'shape-pill']);
  });

  it('uses a separate diamond shape layer so text remains horizontal', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toContain('.mindmap-node-shape');
    expect(css).toContain('.mindmap-node-content');
    expect(css).toContain('.mindmap-node.shape-diamond .mindmap-node-shape');
    expect(css).toContain('clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)');
    expect(css).toContain('.mindmap-node.shape-diamond.is-selected');
    expect(css).toContain('drop-shadow(0 0 9px rgb(55 124 246 / 34%))');
    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond\.is-selected[\s\S]*?box-shadow: none;[\s\S]*?outline: 0;/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond \.mindmap-node-shape[\s\S]*?box-shadow: none;[\s\S]*?filter: drop-shadow/,
    );
    expect(css).not.toMatch(/\.mindmap-node\.shape-diamond\s*\{[^}]*transform:/);
    expect(css).not.toMatch(
      /\.mindmap-node\.shape-diamond\s*\{[^}]*box-shadow:/,
    );
    expect(css).not.toMatch(/\.mindmap-node-content\s*\{[^}]*transform:/);
  });

  it('keeps diamond selected styles off the visible outer hitbox', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');
    const finalDropTargetRuleIndex = css.lastIndexOf('.mindmap-node.is-drop-target');
    const finalDiamondRuleIndex = css.lastIndexOf(
      '.mindmap-node.shape-diamond.is-selected,',
    );
    const diamondStateRule = /\.mindmap-node\.shape-diamond\.is-selected,[\s\S]*?\.mindmap-node\.shape-diamond\.is-dragging\s*\{([\s\S]*?)\}/.exec(
      css,
    )?.[1];

    expect(finalDiamondRuleIndex).toBeGreaterThan(finalDropTargetRuleIndex);
    expect(diamondStateRule).toContain('border: 0;');
    expect(diamondStateRule).toContain('background: transparent;');
    expect(diamondStateRule).toContain('box-shadow: none;');
    expect(diamondStateRule).toContain('outline: 0;');
    expect(diamondStateRule).toContain('outline-offset: 0;');
  });

  it('uses diamond shape-layer highlights for selected, box-select, and drop states', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond\.is-selected \.mindmap-node-shape,[\s\S]*?\.mindmap-node\.shape-diamond\.is-primary-selected \.mindmap-node-shape\s*\{[\s\S]*?drop-shadow\(0 0 9px rgb\(55 124 246 \/ 34%\)\)/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond\.is-box-selection-preview \.mindmap-node-shape\s*\{[\s\S]*?drop-shadow\(0 0 7px rgb\(55 124 246 \/ 24%\)\)/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond\.is-search-match \.mindmap-node-shape,[\s\S]*?\.mindmap-node\.shape-diamond\.is-drop-target \.mindmap-node-shape\s*\{[\s\S]*?drop-shadow\(0 0 8px rgb\(96 170 122 \/ 28%\)\)/,
    );
  });

  it('renders diamond borderColor through the visible diamond shape layer', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond \.mindmap-node-shape,[\s\S]*?\.mindmap-node\.shape-diamond\.has-node-type \.mindmap-node-shape\s*\{[\s\S]*?background: var\(--node-border, #1f6feb\);/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-diamond \.mindmap-node-shape::after\s*\{[\s\S]*?inset: var\(--node-diamond-border-width, 2px\);[\s\S]*?background: var\(--node-bg, #eef5ff\);/,
    );
    expect(getNodeStyleCssVariables({
      ...DEFAULT_NODE_STYLE,
      shape: 'diamond',
      backgroundColor: '#ffe8cc',
      borderColor: '#d9480f',
      textColor: '#212529',
    })).toMatchObject({
      '--node-bg': '#ffe8cc',
      '--node-border': '#d9480f',
      '--node-text': '#212529',
    });
  });

  it('keeps non-diamond selected and shape styles stable', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(
      /\.mindmap-node\.is-selected,[\s\S]*?\.mindmap-node\.has-node-type\.is-selected\s*\{[\s\S]*?box-shadow:/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.is-primary-selected,[\s\S]*?\.mindmap-node\.is-selected\.is-primary-selected\s*\{[\s\S]*?outline:/,
    );
    expect(css).toMatch(
      /\.mindmap-node \.mindmap-node-shape\s*\{[\s\S]*?border-radius: var\(--radius-md\);/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-rectangle \.mindmap-node-shape\s*\{[\s\S]*?border-radius: 0;/,
    );
    expect(css).toMatch(
      /\.mindmap-node\.shape-pill \.mindmap-node-shape\s*\{[\s\S]*?border-radius: 999px;/,
    );
  });

  it('creates an explicit global node type from current node style', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'generated-type-id',
    });

    expect(
      createNodeTypeFromStyle(
        ' Current style ',
        getEffectiveNodeStyle(
          {
            ...node,
            style: {
              shape: 'diamond',
              borderColor: '#2f9e44',
              textColor: '#111111',
            },
          },
          nodeType,
        ),
        node,
      ),
    ).toMatchObject({
      id: 'generated-type-id',
      name: 'Current style',
      shape: 'diamond',
      borderColor: '#2f9e44',
      textColor: '#111111',
      defaultText: 'Current node',
      defaultRemark: 'Node remark',
    });

    vi.unstubAllGlobals();
  });

  it('only changes the target node type when explicitly applying current style', () => {
    const otherNodeType: MindmapNodeType = {
      ...nodeType,
      id: 'type-other',
      name: 'Other',
      borderColor: '#000000',
    };
    const nextStyle = getEffectiveNodeStyle(
      {
        ...node,
        style: {
          shape: 'diamond',
          backgroundColor: '#fff0f6',
          borderColor: '#a61e4d',
        },
      },
      nodeType,
    );
    const nextNodeTypes = [nodeType, otherNodeType].map((item) =>
      item.id === nodeType.id ? applyStyleToNodeType(item, nextStyle) : item,
    );

    expect(nextNodeTypes[0]).toMatchObject({
      shape: 'diamond',
      backgroundColor: '#fff0f6',
      borderColor: '#a61e4d',
    });
    expect(nextNodeTypes[1]).toEqual(otherNodeType);
  });

  it('clears custom borderColor and shape when resetting to node type defaults', () => {
    const styledNode: MindmapNode = {
      ...node,
      style: { shape: 'diamond', borderColor: '#7048e8' },
    };
    const resetNode: MindmapNode = {
      ...styledNode,
      style: undefined,
    };

    expect(getEffectiveNodeStyle(styledNode, nodeType)).toMatchObject({
      shape: 'diamond',
      borderColor: '#7048e8',
    });
    expect(getEffectiveNodeStyle(resetNode, nodeType)).toMatchObject({
      shape: nodeType.shape,
      borderColor: nodeType.borderColor,
    });
  });

  it('restores borderColor and shape through undo and redo', () => {
    const before: MindmapProject = {
      rootNode: node,
      nodeTypes: [nodeType],
      themeId: 'default-blue',
    };
    const after: MindmapProject = {
      ...before,
      rootNode: {
        ...node,
        style: { borderColor: '#1971c2', shape: 'diamond' },
      },
    };
    const history = pushHistory(createHistoryState(), before);
    const undoResult = undoHistory(history, after)!;
    const redoResult = redoHistory(undoResult.history, undoResult.project)!;

    expect(undoResult.project.rootNode.style).toBeUndefined();
    expect(redoResult.project.rootNode.style).toMatchObject({
      borderColor: '#1971c2',
      shape: 'diamond',
    });
  });

  it('preserves current-node borderColor and shape after save and reopen', () => {
    const styledNode: MindmapNode = {
      ...node,
      style: {
        shape: 'diamond',
        backgroundColor: '#ebfbee',
        borderColor: '#2b8a3e',
      },
    };
    const serialized = serializeLmindDocument(
      styledNode,
      [{ ...nodeType, shape: 'pill', borderColor: '#f59f00' }],
      'default-blue',
    );
    const reopened = parseLmindProject(serialized);

    expect(reopened.rootNode.style).toMatchObject({
      shape: 'diamond',
      backgroundColor: '#ebfbee',
      borderColor: '#2b8a3e',
    });
    expect(
      getEffectiveNodeStyle(reopened.rootNode, reopened.nodeTypes[0]),
    ).toMatchObject({
      shape: 'diamond',
      borderColor: '#2b8a3e',
    });
  });
});
