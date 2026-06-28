import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_FILE_COMMANDS,
  openFileLocation,
  openLocalTextFile,
  saveLocalFile,
  setLocalFileInvokerForTests,
} from '../localFileOperations';

describe('desktop local file operations', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
    } as unknown as Window);
    setLocalFileInvokerForTests(invoke);
  });

  afterEach(() => {
    setLocalFileInvokerForTests(null);
    invoke.mockReset();
    vi.unstubAllGlobals();
  });

  it('uses the save dialog for a first save and returns the full path', async () => {
    invoke.mockResolvedValueOnce('C:\\Users\\test\\Documents\\竞赛方案.lmind');

    await expect(
      saveLocalFile({
        content: '{}',
        defaultFileName: '竞赛方案.lmind',
        mimeType: 'application/json',
        filterName: 'Local Mindmap',
        extensions: ['lmind'],
      }),
    ).resolves.toEqual({
      kind: 'desktop',
      path: 'C:\\Users\\test\\Documents\\竞赛方案.lmind',
      fileName: '竞赛方案.lmind',
    });
    expect(invoke).toHaveBeenCalledWith(
      LOCAL_FILE_COMMANDS.saveWithDialog,
      expect.objectContaining({ defaultFileName: '竞赛方案.lmind' }),
    );
  });

  it('overwrites currentFilePath without reopening the dialog', async () => {
    const path = 'C:\\maps\\opened.lmind';
    invoke.mockResolvedValueOnce(path);

    await saveLocalFile({
      content: '{}',
      defaultFileName: 'ignored.lmind',
      mimeType: 'application/json',
      filterName: 'Local Mindmap',
      extensions: ['lmind'],
      currentPath: path,
    });

    expect(invoke).toHaveBeenCalledWith(
      LOCAL_FILE_COMMANDS.write,
      expect.objectContaining({ path }),
    );
  });

  it('returns null when the user cancels the save dialog', async () => {
    invoke.mockResolvedValueOnce(null);
    await expect(
      saveLocalFile({
        content: 'text',
        defaultFileName: 'map.txt',
        mimeType: 'text/plain',
        filterName: 'Text',
        extensions: ['txt'],
      }),
    ).resolves.toBeNull();
  });

  it('returns opened content and currentFilePath', async () => {
    invoke.mockResolvedValueOnce({
      path: 'C:\\maps\\opened.lmind',
      fileName: 'opened.lmind',
      bytes: Array.from(new TextEncoder().encode('{"version":"1.0"}')),
    });

    await expect(
      openLocalTextFile({
        accept: '.lmind',
        filterName: 'Local Mindmap',
        extensions: ['lmind'],
      }),
    ).resolves.toEqual({
      content: '{"version":"1.0"}',
      fileName: 'opened.lmind',
      path: 'C:\\maps\\opened.lmind',
    });
  });

  it('opens the current file location through the desktop command', async () => {
    invoke.mockResolvedValueOnce(undefined);
    await expect(openFileLocation('C:\\maps\\opened.lmind')).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith(LOCAL_FILE_COMMANDS.openLocation, {
      path: 'C:\\maps\\opened.lmind',
    });
  });
});

describe('web local file fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads with the requested filename without claiming a local path', async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    vi.stubGlobal('window', {} as Window);
    vi.stubGlobal('document', {
      createElement: () => ({
        href: '',
        download: '',
        style: {},
        click,
        remove,
      }),
      body: { appendChild },
    } as unknown as Document);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });

    await expect(
      saveLocalFile({
        content: 'hello',
        defaultFileName: '竞赛方案.txt',
        mimeType: 'text/plain',
        filterName: 'Text',
        extensions: ['txt'],
      }),
    ).resolves.toEqual({ kind: 'web', fileName: '竞赛方案.txt' });
    expect(click).toHaveBeenCalledOnce();
  });
});
