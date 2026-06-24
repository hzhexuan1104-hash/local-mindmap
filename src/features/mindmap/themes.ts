import type { CSSProperties } from 'react';

export type MindmapTheme = {
  id: string;
  name: string;
  canvasBackground: string;
  gridColor: string;
  nodeBackground: string;
  nodeBorder: string;
  nodeText: string;
  lineColor: string;
};

export const MINDMAP_THEMES: MindmapTheme[] = [
  {
    id: 'default-blue',
    name: '默认蓝',
    canvasBackground: '#ffffff',
    gridColor: '#edf2f8',
    nodeBackground: '#eef5ff',
    nodeBorder: '#1f6feb',
    nodeText: '#14315f',
    lineColor: '#b7c5d8',
  },
  {
    id: 'fresh-green',
    name: '清新绿',
    canvasBackground: '#fbfff8',
    gridColor: '#e4f3df',
    nodeBackground: '#eefbe9',
    nodeBorder: '#2da44e',
    nodeText: '#174a28',
    lineColor: '#9bcf9d',
  },
  {
    id: 'active-orange',
    name: '活力橙',
    canvasBackground: '#fffaf2',
    gridColor: '#f6e7ce',
    nodeBackground: '#fff2df',
    nodeBorder: '#f08c00',
    nodeText: '#693d00',
    lineColor: '#e4b466',
  },
  {
    id: 'dark-black',
    name: '暗色黑',
    canvasBackground: '#171a1f',
    gridColor: '#2b313a',
    nodeBackground: '#252c36',
    nodeBorder: '#8ea2c6',
    nodeText: '#edf2f8',
    lineColor: '#667085',
  },
  {
    id: 'simple-gray',
    name: '简洁灰',
    canvasBackground: '#f7f7f8',
    gridColor: '#e5e7eb',
    nodeBackground: '#f3f4f6',
    nodeBorder: '#6b7280',
    nodeText: '#1f2937',
    lineColor: '#9ca3af',
  },
];

export function getMindmapTheme(
  themeId: string,
  themes: MindmapTheme[] = MINDMAP_THEMES,
) {
  return (
    themes.find((theme) => theme.id === themeId) ?? MINDMAP_THEMES[0]
  );
}

export function createThemeStyle(
  themeId: string,
  themes: MindmapTheme[] = MINDMAP_THEMES,
): CSSProperties {
  const theme = getMindmapTheme(themeId, themes);

  return {
    '--canvas-bg': theme.canvasBackground,
    '--grid-color': theme.gridColor,
    '--node-bg': theme.nodeBackground,
    '--node-border': theme.nodeBorder,
    '--node-text': theme.nodeText,
    '--line-color': theme.lineColor,
  } as CSSProperties;
}
