import type { NodeAttachment } from './types';

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export function normalizeAttachment(value: unknown): NodeAttachment | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') throw new Error('附件格式无效。');
  const item = value as Record<string, unknown>;
  if (typeof item.name !== 'string' || !item.name.trim()) throw new Error('附件名称不能为空。');
  if (item.kind === 'link' && typeof item.url === 'string') {
    const url = new URL(item.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('附件链接只支持 HTTP/HTTPS。');
    return { kind: 'link', name: item.name, url: url.href };
  }
  if ((item.kind === 'image' || item.kind === 'file') && typeof item.dataUrl === 'string') {
    const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(item.dataUrl);
    if (!match || match[2].length % 4 !== 0 || match[2].length > Math.ceil(ATTACHMENT_MAX_BYTES / 3) * 4) throw new Error('附件数据无效或超过 20 MB。');
    const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
    if (match[2].length / 4 * 3 - padding > ATTACHMENT_MAX_BYTES) throw new Error('附件不能超过 20 MB。');
    if (item.kind === 'image' && !/^image\/(png|jpeg|gif|webp|bmp)$/.test(match[1])) throw new Error('图片附件支持 PNG、JPG、GIF、WebP、BMP。');
    return { kind: item.kind, name: item.name, dataUrl: item.dataUrl };
  }
  throw new Error('附件格式无效。');
}

export async function readAttachment(file: File, kind: 'file' | 'image'): Promise<NodeAttachment> {
  if (file.size > ATTACHMENT_MAX_BYTES) throw new Error('附件不能超过 20 MB。');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取附件失败。'));
    reader.readAsDataURL(file);
  });
  return normalizeAttachment({ kind, name: file.name, dataUrl })!;
}

export function attachmentBytes(attachment: Exclude<NodeAttachment, { kind: 'link' }>) {
  return Uint8Array.from(atob(attachment.dataUrl.split(',')[1]), (char) => char.charCodeAt(0));
}

export function attachmentIcon(attachment: NodeAttachment): string {
  if (attachment.kind === 'link') return '🔗';
  if (attachment.kind === 'image') return '🖼';
  const extension = attachment.name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv', 'ods'].includes(extension ?? '')) return '▦';
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'odt'].includes(extension ?? '')) return '📄';
  if (['zip', '7z', 'rar'].includes(extension ?? '')) return '▣';
  return '📎';
}
