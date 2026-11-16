import { useState } from 'react';

export function ImageAttachmentPreview({ src, name }: { src: string; name: string }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  return <div>
    <div className="image-preview-controls">
      <button type="button" onClick={() => setScale(value => Math.max(0.1, value - 0.25))} disabled={scale <= 0.1}>缩小</button>
      <output aria-live="polite">{Math.round(scale * 100)}%</output>
      <button type="button" onClick={() => setScale(value => Math.min(4, value + 0.25))} disabled={scale >= 4}>放大</button>
      <button type="button" onClick={() => setRotation(value => (value + 90) % 360)}>旋转 90°</button>
      <button type="button" onClick={() => { setScale(1); setRotation(0); }}>重置</button>
    </div>
    <div className="image-preview-viewport"><img src={src} alt={name} style={{ maxWidth: '100%', transform: `scale(${scale}) rotate(${rotation}deg)` }} /></div>
  </div>;
}
