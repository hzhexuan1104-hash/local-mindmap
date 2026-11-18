import { useState } from 'react';
import type { NodeAttachment } from './types';
import { FeedbackDialog } from '../plugins/FeedbackDialog';
import { attachmentBytes, normalizeAttachment, readAttachment } from './nodeAttachments';
import { saveLocalFile } from './localFileOperations';

export function AttachmentDialog({ attachment, onSave, onClose }: { attachment?: NodeAttachment; onSave: (value?: NodeAttachment) => void; onClose: () => void }) {
  const [kind, setKind] = useState<NodeAttachment['kind']>(attachment?.kind ?? 'file');
  const [name, setName] = useState(attachment?.name ?? '');
  const [url, setUrl] = useState(attachment?.kind === 'link' ? attachment.url : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <FeedbackDialog title={attachment ? '修改附件' : '添加附件'} onClose={onClose}>
    <div className="attachment-form">
    <p>每个节点保存一个附件，文件和图片随导图保存（最大 20 MB）。</p>
    <label>附件类型 <select value={kind} onChange={(event) => { setKind(event.target.value as NodeAttachment['kind']); setError(''); }}><option value="file">文件</option><option value="image">图片</option><option value="link">链接</option></select></label>
    {kind === 'link' ? <div className="stacked-control">
      <label>链接名称 <input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>链接地址 <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
      <button type="button" className="secondary-action" onClick={() => { try { onSave(normalizeAttachment({ kind, name: name.trim() || url, url })); } catch (e) { setError(String(e)); } }}>保存链接</button>
    </div> : <label>选择{kind === 'image' ? '图片' : '文件'} <input type="file" disabled={busy} accept={kind === 'image' ? 'image/png,image/jpeg,image/gif,image/webp,image/bmp' : undefined} onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      setBusy(true); setError('');
      try { onSave(await readAttachment(file, kind)); } catch (e) { setError(String(e)); } finally { setBusy(false); }
    }} /></label>}
    {attachment ? <p>当前附件：{attachment.name} <button type="button" className="secondary-action" disabled={busy} onClick={() => onSave(undefined)}>删除附件</button>
      {attachment.kind !== 'link' ? <button type="button" className="secondary-action" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await saveLocalFile({ content: attachmentBytes(attachment), defaultFileName: attachment.name, mimeType: 'application/octet-stream', filterName: '附件', extensions: [attachment.name.split('.').pop() || 'bin'], forceDialog: true }); }
        catch (e) { setError(String(e)); } finally { setBusy(false); }
      }}>另存附件</button> : null}
    </p> : null}
    {error ? <p role="alert">{error}</p> : null}
    </div>
  </FeedbackDialog>;
}
