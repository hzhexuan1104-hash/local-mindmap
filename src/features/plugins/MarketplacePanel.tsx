import marketplaceDocs from '../../../docs/marketplace-api.md?raw';
import { FeedbackDialog } from './FeedbackDialog';
import { useEffect, useState } from 'react';
import { readUserJson, writeUserJson } from '../storage/userDataStorage';
import { saveLocalFile } from '../mindmap/localFileOperations';
import { fetchPublicResource, parseMarketplaceCatalog, publicResourceUrl, type MarketplaceItem } from './marketplace';

const SETTINGS_PATH = 'config/marketplace.json';
export function MarketplacePanel() {
  const [showDocs, setShowDocs] = useState(false);
  const [address, setAddress] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void readUserJson<{ address?: string }>(SETTINGS_PATH, {}).then((value) => { if (active) { setAddress(typeof value?.address === 'string' ? value.address : ''); setReady(true); } }).catch((e) => { if (active) { setStatus(String(e)); setReady(true); } });
    return () => { active = false; };
  }, []);
  const run = async (work: () => Promise<void>) => { setBusy(true); setStatus(''); try { await work(); } catch (e) { setStatus(`操作失败：${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); } };
  return <section className="plugin-manager-section">
    <h3>公共资源商城</h3>
    <button type="button" className="secondary-action" onClick={() => setShowDocs(true)}>商城开发说明</button>
    {showDocs ? <FeedbackDialog title="商城开发说明" content={marketplaceDocs} markdown onClose={() => setShowDocs(false)} /> : null}
    <p>地址默认留空。仅点击查询或下载时联网；不发送导图、附件或用户数据。下载后通过对应导入入口安装。</p>
    <label>商城清单地址 <input aria-label="商城清单地址" type="url" value={address} disabled={!ready || busy} onChange={(event) => { setAddress(event.target.value); setItems([]); }} placeholder="https://example.com/catalog.json" /></label>
    <div className="plugin-manager-actions">
      <button type="button" className="secondary-action" disabled={!ready || busy} onClick={() => void run(async () => { const url = address.trim() ? publicResourceUrl(address.trim()) : ''; await writeUserJson(SETTINGS_PATH, { address: url }); setAddress(url); setStatus('商城地址已保存。'); })}>保存地址</button>
      <button type="button" className="secondary-action" disabled={!address.trim() || busy || !ready} onClick={() => void run(async () => { setItems([]); const url = publicResourceUrl(address.trim()); const data = await fetchPublicResource(url, 2 * 1024 * 1024); const result = parseMarketplaceCatalog(JSON.parse(new TextDecoder().decode(data)), url); setItems(result); setStatus(`查询到 ${result.length} 个公共资源。`); })}>查询公共资源</button>
    </div>
    <input aria-label="搜索公共资源" placeholder="搜索插件、节点类型、模板" value={query} onChange={(event) => setQuery(event.target.value)} />
    {status ? <p role="status">{status}</p> : null}
    <div className="plugin-gallery-grid">{items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())).map((item) => <article key={item.id} className="plugin-gallery-card"><strong>{item.name}</strong><span>{item.kind === 'plugin' ? '插件' : item.kind === 'template' ? '模板' : '节点类型'}</span><p>{item.description}</p><button type="button" className="secondary-action" disabled={busy} onClick={() => void run(async () => {
      const bytes = await fetchPublicResource(item.url, 20 * 1024 * 1024);
      const result = await saveLocalFile({ content: bytes, defaultFileName: item.fileName, mimeType: 'application/octet-stream', filterName: '公共资源', extensions: [item.fileName.split('.').pop()!], forceDialog: true });
      setStatus(result ? `已下载 ${item.name}，可从对应导入入口导入。` : '已取消保存。');
    })}>下载</button></article>)}</div>
  </section>;
}
