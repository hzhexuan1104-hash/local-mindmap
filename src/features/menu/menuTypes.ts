export type MenuExecute = () => void | Promise<void>;

export interface MenuItemDefinition {
  id: string;
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  children?: MenuItemDefinition[];
  execute?: MenuExecute;
  /** Temporary compatibility alias for existing menu call sites. */
  onSelect?: MenuExecute;
  /** Temporary compatibility alias for existing menu call sites. */
  dividerBefore?: boolean;
}

export interface MenuGroupDefinition {
  id: string;
  label: string;
  items: MenuItemDefinition[];
}

export function getAllLeafMenuItems(items: MenuItemDefinition[]): MenuItemDefinition[] {
  return items.flatMap((item) => item.children?.length ? getAllLeafMenuItems(item.children) : [item]);
}

export function validateMenuDefinition(groups: MenuGroupDefinition[]) {
  const leaves = getAllLeafMenuItems(groups.flatMap((group) => group.items));
  const ids = new Set<string>();
  const errors: string[] = [];
  const visit = (items: MenuItemDefinition[], depth: number) => {
    if (depth > 3) errors.push('菜单层级不能超过三级。');
    items.forEach((item) => {
      if (item.children?.length && (item.execute || item.onSelect)) errors.push(`${item.id} 不能同时拥有 children 和 execute。`);
      if (!item.children?.length && !(item.execute || item.onSelect) && !item.disabled) errors.push(`${item.id} 是空菜单项。`);
      if (item.children?.length) visit(item.children, depth + 1);
    });
  };
  visit(groups.flatMap((group) => group.items), 1);
  leaves.forEach((item) => {
    if (ids.has(item.id)) errors.push(`重复菜单叶子 id：${item.id}`);
    ids.add(item.id);
  });
  return { valid: errors.length === 0, errors, leaves };
}
