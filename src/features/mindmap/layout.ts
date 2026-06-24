import type { CSSProperties } from 'react';

const MINDMAP_LAYOUT = {
  canvasPadding: 80,
  childHorizontalGap: 96,
  childVerticalGap: 80,
  nodeMinWidth: 144,
  nodeMaxWidth: 220,
} as const;

type MindmapLayoutStyle = CSSProperties & {
  '--mindmap-canvas-padding': string;
  '--mindmap-child-horizontal-gap': string;
  '--mindmap-child-vertical-gap': string;
  '--mindmap-node-min-width': string;
  '--mindmap-node-max-width': string;
};

export function createMindmapLayoutStyle(): MindmapLayoutStyle {
  return {
    '--mindmap-canvas-padding': `${MINDMAP_LAYOUT.canvasPadding}px`,
    '--mindmap-child-horizontal-gap': `${MINDMAP_LAYOUT.childHorizontalGap}px`,
    '--mindmap-child-vertical-gap': `${MINDMAP_LAYOUT.childVerticalGap}px`,
    '--mindmap-node-min-width': `${MINDMAP_LAYOUT.nodeMinWidth}px`,
    '--mindmap-node-max-width': `${MINDMAP_LAYOUT.nodeMaxWidth}px`,
  };
}
