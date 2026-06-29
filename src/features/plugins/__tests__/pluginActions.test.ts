import { describe, expect, it } from 'vitest';
import { validatePluginAction } from '../pluginActions';

describe('Plugin Action Protocol validation', () => {
  it('accepts a valid updateNode action', () => {
    expect(
      validatePluginAction({
        type: 'updateNode',
        nodeId: 'node-1',
        patch: { text: '新标题', remark: '新备注' },
      }),
    ).toMatchObject({
      valid: true,
      action: {
        type: 'updateNode',
        nodeId: 'node-1',
      },
    });
  });

  it('rejects an unknown action type', () => {
    expect(validatePluginAction({ type: 'runShell' })).toMatchObject({
      valid: false,
      action: null,
      errors: ['未知 Plugin action type：runShell'],
    });
  });
});
