import { downloadBlob, selectLocalFile } from './fileUtils';
import { isDesktopRuntime } from '../storage/userDataStorage';

export const LOCAL_FILE_COMMANDS = {
  saveWithDialog: 'save_local_file_with_dialog',
  write: 'write_local_file',
  openWithDialog: 'open_local_file_with_dialog',
  read: 'read_local_file',
  openLocation: 'open_file_location',
} as const;

export type LocalFileResult =
  | { kind: 'desktop'; path: string; fileName: string }
  | { kind: 'web'; fileName: string };

export type OpenedLocalTextFile = {
  content: string;
  fileName: string;
  path: string | null;
};

type LocalFileInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let invokerOverride: LocalFileInvoker | null = null;

export function setLocalFileInvokerForTests(invoker: LocalFileInvoker | null) {
  invokerOverride = invoker;
}

async function invokeLocalFile<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  if (invokerOverride) {
    return invokerOverride<T>(command, args);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

function toBytes(
  content: string | Uint8Array | ArrayBuffer,
): Uint8Array<ArrayBuffer> {
  const source =
    typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content instanceof Uint8Array
        ? content
        : new Uint8Array(content);
  const bytes = new Uint8Array(new ArrayBuffer(source.byteLength));
  bytes.set(source);
  return bytes;
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function sanitizeFileName(value: string, fallback = 'mindmap') {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  return sanitized || fallback;
}

export async function saveLocalFile(options: {
  content: string | Uint8Array | ArrayBuffer;
  defaultFileName: string;
  mimeType: string;
  filterName: string;
  extensions: string[];
  currentPath?: string | null;
  forceDialog?: boolean;
}): Promise<LocalFileResult | null> {
  const bytes = Array.from(toBytes(options.content));

  if (isDesktopRuntime()) {
    if (options.currentPath && !options.forceDialog) {
      const path = await invokeLocalFile<string>(LOCAL_FILE_COMMANDS.write, {
        path: options.currentPath,
        bytes,
      });
      return { kind: 'desktop', path, fileName: fileNameFromPath(path) };
    }

    const path = await invokeLocalFile<string | null>(
      LOCAL_FILE_COMMANDS.saveWithDialog,
      {
        defaultFileName: options.defaultFileName,
        filterName: options.filterName,
        extensions: options.extensions,
        bytes,
      },
    );
    return path
      ? { kind: 'desktop', path, fileName: fileNameFromPath(path) }
      : null;
  }

  downloadBlob(
    new Blob([toBytes(options.content)], { type: options.mimeType }),
    options.defaultFileName,
  );
  return { kind: 'web', fileName: options.defaultFileName };
}

export async function openLocalTextFile(options: {
  accept: string;
  filterName: string;
  extensions: string[];
}): Promise<OpenedLocalTextFile | null> {
  if (isDesktopRuntime()) {
    const opened = await invokeLocalFile<{
      path: string;
      fileName: string;
      bytes: number[];
    } | null>(LOCAL_FILE_COMMANDS.openWithDialog, {
      filterName: options.filterName,
      extensions: options.extensions,
    });
    if (!opened) {
      return null;
    }
    return {
      content: new TextDecoder().decode(new Uint8Array(opened.bytes)),
      fileName: opened.fileName,
      path: opened.path,
    };
  }

  const selected = await selectLocalFile(options.accept);
  return selected
    ? { content: await selected.text(), fileName: selected.name, path: null }
    : null;
}

export async function openFileLocation(path: string) {
  if (!isDesktopRuntime()) {
    return false;
  }
  await invokeLocalFile<void>(LOCAL_FILE_COMMANDS.openLocation, { path });
  return true;
}

export async function readLocalTextFile(path: string) {
  const bytes = await invokeLocalFile<number[]>(LOCAL_FILE_COMMANDS.read, {
    path,
  });
  return new TextDecoder().decode(new Uint8Array(bytes));
}
