import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type { MindmapNode, MindmapNodeType } from '../../features/mindmap/types';

export type RemarkFocusRequest = { id: number; nodeId: string };

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  /** Kept in the panel contract so existing callers remain compatible. */
  nodeTypes?: MindmapNodeType[];
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
  nodeTypes: _nodeTypes,
  remarkMode,
  activeRemarkMatch,
  remarkFocusRequest = null,
  onRemarkModeChange,
  onRemarkChange,
  onCollapse,
}: RightInspectorPanelProps) {
  return (
    <aside className="inspector-panel inspector-panel-remark" aria-label="节点备注">
      <header className="inspector-header inspector-remark-header">
        <div>
          <span>节点</span>
          <h2>备注面板</h2>
        </div>
        <button
          type="button"
          className="panel-collapse-action inspector-remark-collapse"
          onClick={onCollapse}
          aria-label="收起右侧备注面板"
          title="收起右侧备注面板"
        >
          ‹
        </button>
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
