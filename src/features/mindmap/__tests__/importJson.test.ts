import { describe, expect, it } from 'vitest';
import { parseLmindProject } from '../openMindmap';

describe('parseLmindProject', () => {
  it('parses a valid lmind JSON document', () => {
    const project = parseLmindProject(
      JSON.stringify({
        version: '1.0',
        meta: {
          createTime: '2026-06-24T00:00:00.000Z',
          updateTime: '2026-06-24T00:00:00.000Z',
          theme: 'default-blue',
        },
        nodeTypes: [],
        rootNode: {
          id: 'root',
          text: '中心主题',
          remark: '',
          children: [],
        },
      }),
    );

    expect(project.rootNode.text).toBe('中心主题');
    expect(project.themeId).toBe('default-blue');
  });

  it('rejects invalid JSON documents', () => {
    expect(() => parseLmindProject('{bad json')).toThrow('Invalid JSON');
    expect(() => parseLmindProject(JSON.stringify({ version: '1.0' }))).toThrow(
      'Invalid lmind document',
    );
  });
});

