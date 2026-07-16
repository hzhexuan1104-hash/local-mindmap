/**
 * Remarks use `***` as a visible checklist separator. Escape only a standalone
 * three-asterisk line so Markdown does not reinterpret it as a horizontal rule.
 */
export function preserveStandaloneTripleAsterisks(content: string) {
  let isInsideFence = false;

  return content
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        isInsideFence = !isInsideFence;
        return line;
      }

      if (!isInsideFence && /^([ \t]*)\*{3}([ \t]*)$/.test(line)) {
        return line.replace(/\*/g, '\\*');
      }

      return line;
    })
    .join('\n');
}
