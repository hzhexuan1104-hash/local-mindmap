import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type { MindmapNode, MindmapNodeType } from '../../features/mindmap/types';

export type RemarkFocusRequest = { id: number; nodeId: string };

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
  remarkMode: 'edit' | 'preview';
  activeRemarkMatch: SearchMatch | null;
  remarkFocusRequest?: RemarkFocusRequest | null;
  onRemarkModeChange: (mode: 'edit' | 'preview') => void;
  onRemarkChange: (remark: string) => void;
  onCollapse: () => void;
};

/** The inspector is deliberately remark-only; node style controls live on the canvas. */
export function RightInspectorPanel({
  selectedNode,
  nodeTypes,
  remarkMode,
  activeRemarkMatch,
  remarkFocusRequest = null,
  onRemarkModeChange,
  onRemarkChange,
  onCollapse,
}: RightInspectorPanelProps) {
  const selectedNodeType = nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null;

  return (
    <aside className="inspector-panel inspector-panel-remark" aria-label="节点备注">
      <header className="inspector-header inspector-remark-context">
        <div className="inspector-remark-context-details">
          <h2 title={selectedNode.text}>{selectedNode.text}</h2>
          <span className="inspector-node-type">{selectedNodeType?.name ?? '普通节点'}</span>
        </div>
        <button type="button" className="panel-collapse-action" onClick={onCollapse} aria-label="收起右侧备注面板" title="收起右侧备注面板">‹</button>
      </header>

      <div className="inspector-content">
        <RemarkPanel
          selectedNode={selectedNode}
          mode={remarkMode}
          onModeChange={onRemarkModeChange}
          onRemarkChange={onRemarkChange}
          activeMatch={activeRemarkMatch}
          focusRequestId={remarkFocusRequest?.nodeId === selectedNode.id ? remarkFocusRequest.id : undefined}
          embedded
        />
      </div>
    </aside>
  );
}
