import { describe, expect, it } from 'vitest';
import type { PluginManifest } from '../../mindmap/plugins';
import {
  appendPluginLog,
  clearPluginLogs,
  createPluginDiagnosticLogs,
  createPluginLog,
} from '../pluginLogs';

describe('plugin developer logs', () => {
  it('records reload success and clears logs', () => {
    const log = createPluginLog({
      timestamp: '2026-06-29T00:00:00.000Z',
      level: 'info',
      event: 'reload-success',
      message: '插件已重新加载。',
    });
    const logs = appendPluginLog([], log);

    expect(logs).toEqual([expect.objectContaining({ event: 'reload-success' })]);
    expect(clearPluginLogs()).toEqual([]);
  });

  it('records a missing installed manifest diagnostic', () => {
    const plugin = {
      pluginId: 'localmindmap.test.missing',
      source: 'manifest-missing',
      manifestError: 'manifest.json 缺失。',
    } as PluginManifest;

    expect(createPluginDiagnosticLogs([plugin])).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'manifest-missing',
        pluginId: plugin.pluginId,
        message: 'manifest.json 缺失。',
      }),
    ]);
  });

  it('stores structured workflow execution metadata', () => {
    const log = createPluginLog({
      timestamp: '2026-07-01T00:00:00.000Z',
      level: 'info',
      event: 'workflow-execution-succeeded',
      pluginId: 'localmindmap.workflow.meeting-outline',
      menuId: 'createMeetingOutline',
      actionCount: 2,
      durationMs: 4,
      message: 'workflow execution succeeded',
    });
    expect(log).toMatchObject({
      event: 'workflow-execution-succeeded',
      menuId: 'createMeetingOutline',
      actionCount: 2,
      durationMs: 4,
    });
  });
});
