export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const bridge = (window as Window & { localMindmap?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }).localMindmap;
  if (!bridge) return Promise.reject(new Error('本地桌面服务不可用。'));
  return bridge.invoke(command, args) as Promise<T>;
}
