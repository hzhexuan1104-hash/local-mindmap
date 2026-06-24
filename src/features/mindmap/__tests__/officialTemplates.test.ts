import { describe, expect, it } from 'vitest';
import { OFFICIAL_TEMPLATES } from '../officialTemplates';
import type { MindmapNode } from '../types';

function isValidNode(node: MindmapNode): boolean {
  return (
    Boolean(node.id) &&
    Boolean(node.text) &&
    typeof node.remark === 'string' &&
    Array.isArray(node.children) &&
    node.children.every(isValidNode)
  );
}

describe('OFFICIAL_TEMPLATES', () => {
  it('contains at least eight official templates', () => {
    expect(OFFICIAL_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });

  it('marks official templates as non-custom presets', () => {
    expect(
      OFFICIAL_TEMPLATES.every(
        (template) => template.isOfficial && template.templateId && template.presetOrder,
      ),
    ).toBe(true);
  });

  it('contains valid root nodes', () => {
    expect(OFFICIAL_TEMPLATES.every((template) => isValidNode(template.rootNode))).toBe(
      true,
    );
    expect(
      OFFICIAL_TEMPLATES.every((template) => template.rootNode.children.length > 0),
    ).toBe(true);
  });
});

