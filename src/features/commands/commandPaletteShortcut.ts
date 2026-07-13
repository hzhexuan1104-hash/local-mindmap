export function isCommandPaletteShortcut(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}) {
  if (event.isComposing) return false;
  const commandKey = Boolean(event.ctrlKey || event.metaKey);
  if (!commandKey) return false;
  const key = event.key.toLocaleLowerCase();
  return (key === 'k' && !event.shiftKey) || (key === 'p' && Boolean(event.shiftKey));
}
