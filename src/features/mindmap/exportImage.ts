import { toJpeg, toPng } from 'html-to-image';

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

export async function exportMindmapAsImage(
  element: HTMLElement,
  format: 'png' | 'jpg',
) {
  const options = {
    cacheBust: true,
    pixelRatio: Math.max(2, window.devicePixelRatio || 1),
    backgroundColor: '#ffffff',
  };

  const dataUrl =
    format === 'png'
      ? await toPng(element, options)
      : await toJpeg(element, { ...options, quality: 0.95 });

  downloadDataUrl(dataUrl, format === 'png' ? 'mindmap.png' : 'mindmap.jpg');
}

export async function createMindmapImageBytes(
  element: HTMLElement,
  format: 'png' | 'jpg',
) {
  const options = {
    cacheBust: true,
    pixelRatio: Math.max(2, window.devicePixelRatio || 1),
    backgroundColor: '#ffffff',
  };
  const dataUrl =
    format === 'png'
      ? await toPng(element, options)
      : await toJpeg(element, { ...options, quality: 0.95 });
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}
