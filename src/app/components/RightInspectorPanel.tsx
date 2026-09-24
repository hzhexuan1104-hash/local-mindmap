import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import { findNodeTypeById } from '../../features/mindmap/nodeTypes';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type { MindmapNode, MindmapNodeType } from '../../features/mindmap/types';

export type RemarkFocusRequest = { id: number; nodeId: string };

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  nodeTypes?: MindmapNodeType[];
  remarkMode: 'edit' | 'preview';
  activeRemarkMatch: SearchMatch | null;
  remarkFocusRequest?: RemarkFocusRequest | null;
  onRemarkModeChange: (mode: 'edit' | 'preview') => void;
  onRemarkChange: (remark: string) => void;
  onCollapse: () => void;
  siblings?: MindmapNode[];
  onNavigate?: (nodeId: string) => void;
};

/** The inspector is deliberately remark-only; node style controls live on the canvas. */
export function RightInspectorPanel({
  selectedNode,
  nodeTypes = [],
  remarkMode,
  activeRemarkMatch,
  remarkFocusRequest = null,
  onRemarkModeChange,
  onRemarkChange,
  onCollapse,
  siblings,
  onNavigate,
}: RightInspectorPanelProps) {
  const nodeTypeName = findNodeTypeById(nodeTypes, selectedNode.nodeTypeId)?.name ?? '普通节点';

  return (
    <aside className="inspector-panel inspector-panel-remark" aria-label="节点备注">
      <div className="inspector-content">
        <RemarkPanel
          selectedNode={selectedNode}
          siblings={siblings}
          onNavigate={onNavigate}
          mode={remarkMode}
          onModeChange={onRemarkModeChange}
          onRemarkChange={onRemarkChange}
          activeMatch={activeRemarkMatch}
          focusRequestId={remarkFocusRequest?.nodeId === selectedNode.id ? remarkFocusRequest.id : undefined}
          onCollapse={onCollapse}
          embeddedTitle={nodeTypeName}
          embedded
        />
      </div>
    </aside>
  );
}
