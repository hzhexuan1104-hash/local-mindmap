import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicResource, parseMarketplaceCatalog, publicResourceUrl } from '../marketplace';

afterEach(() => vi.unstubAllGlobals());
describe('optional public marketplace', () => {
  it('resolves all supported resource kinds with no document context', () => {
    const items = ['plugin', 'node-type', 'template'].map((kind) => ({ id: kind, kind, name: kind, fileName: `${kind}.json`, url: `./${kind}.json` }));
    expect(parseMarketplaceCatalog({ items }, 'https://example.com/store/catalog.json').map((item) => item.url)).toEqual(items.map((item) => `https://example.com/store/${item.fileName}`));
  });
  it('rejects executable filenames, duplicate ids and unsafe URLs', () => {
    for (const url of ['file:///tmp/a', 'http://example.com', 'https://user:pass@example.com']) expect(() => publicResourceUrl(url)).toThrow();
    const item = { id: 'a', name: 'A', kind: 'plugin', fileName: 'a.exe', url: 'https://example.com/a' };
    expect(() => parseMarketplaceCatalog({ items: [item] }, 'https://example.com')).toThrow();
    item.fileName = 'a.json';
    expect(() => parseMarketplaceCatalog({ items: [item, item] }, 'https://example.com')).toThrow();
  });
  it('uses an anonymous GET without referrer or redirects and enforces the streaming size limit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchPublicResource('https://example.com/catalog.json', 2)).rejects.toThrow('大小限制');
    expect(fetch).toHaveBeenCalledWith('https://example.com/catalog.json', expect.objectContaining({ method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' }));
  });
});
