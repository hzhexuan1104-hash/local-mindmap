import { readUserJson, writeUserJson } from '../storage/userDataStorage';

export type MarketplaceItem = { id: string; name: string; kind: 'plugin' | 'node-type' | 'template'; description: string; url: string; fileName: string };
export function publicResourceUrl(value: string, base?: string) {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('商城资源必须使用不含账号密码的 HTTPS 地址。');
  return url.href;
}
export function parseMarketplaceCatalog(value: unknown, base: string): MarketplaceItem[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) throw new Error('商城清单必须包含 items 数组。');
  const items = (value as { items: unknown[] }).items;
  if (items.length > 1000) throw new Error('商城资源数量超过 1000。');
  const ids = new Set<string>();
  return items.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('商城资源格式无效。');
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || !['plugin', 'node-type', 'template'].includes(String(item.kind)) || typeof item.url !== 'string' || typeof item.fileName !== 'string' || !/^[^\\/:*?"<>|\x00-\x1f]+\.(json|lmplugin)$/i.test(item.fileName)) throw new Error('商城资源字段无效或 ID 重复。');
    ids.add(item.id);
    return { id: item.id, name: item.name, kind: item.kind as MarketplaceItem['kind'], description: typeof item.description === 'string' ? item.description : '', url: publicResourceUrl(item.url, base), fileName: item.fileName };
  });
}

export async function fetchPublicResource(url: string, limit: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(publicResourceUrl(url), { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）。`);
    if (Number(response.headers.get('content-length')) > limit) throw new Error('下载文件超过大小限制。');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > limit) throw new Error('下载文件超过大小限制。');
        chunks.push(value);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    const data = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    return data;
  } finally { clearTimeout(timeout); }
}

const SOURCE_PATH = 'config/plugin-install-sources.json';
export type PluginInstallOrigin = 'local' | 'gallery';
export async function loadPluginInstallOrigins(): Promise<Record<string, PluginInstallOrigin>> {
  const value = await readUserJson<Record<string, PluginInstallOrigin>>(SOURCE_PATH, {});
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, origin]) => origin === 'local' || origin === 'gallery'));
}
export async function recordPluginInstallOrigin(id: string, origin: PluginInstallOrigin) {
  const current = await loadPluginInstallOrigins();
  await writeUserJson(SOURCE_PATH, { ...current, [id]: origin });
}
