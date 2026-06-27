type CanvasControlsProps = {
  scale: number;
  isFocusMode: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onAutoLayout: () => void;
  onExitFocusMode: () => void;
};

export function CanvasControls({
  scale,
  isFocusMode,
  onZoomIn,
  onZoomOut,
  onCenter,
  onAutoLayout,
  onExitFocusMode,
}: CanvasControlsProps) {
  return (
    <div className="canvas-controls" aria-label="画布控制">
      <button type="button" onClick={onZoomOut} aria-label="缩小" title="缩小">
        −
      </button>
      <span className="canvas-scale">{Math.round(scale * 100)}%</span>
      <button type="button" onClick={onZoomIn} aria-label="放大" title="放大">
        +
      </button>
      <span className="canvas-control-divider" aria-hidden="true" />
      <button type="button" onClick={onCenter} title="一键居中">
        居中
      </button>
      <button type="button" onClick={onAutoLayout} title="重新自动布局">
        布局
      </button>
      {isFocusMode ? (
        <button type="button" onClick={onExitFocusMode}>
          退出专注
        </button>
      ) : null}
    </div>
  );
}
