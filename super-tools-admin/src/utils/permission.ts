/**
 * 权限码命中判断
 * - required 为 null/undefined/空字符串 → 直接放行（穿透）
 * - required 为字符串 → 校验 owned 是否包含
 * - required 为数组 → OR 语义（任一命中即通过）
 */
export function hasPermission(
  required: string | string[] | null | undefined,
  owned: string[],
): boolean {
  if (!required) return true;
  const set = new Set(owned);
  if (Array.isArray(required)) return required.some(c => set.has(c));
  return set.has(required);
}

/**
 * DFS 在菜单树中按 pathname 查找节点
 */
export function findMenuByPath(tree: MenuNode[], pathname: string): MenuNode | null {
  for (const n of tree) {
    if (n.path === pathname) return n;
    const c = findMenuByPath(n.children || [], pathname);
    if (c) return c;
  }
  return null;
}

/**
 * 找到树中第一个叶子节点（按 sort 顺序）
 */
export function findFirstLeaf(tree: MenuNode[]): MenuNode | null {
  for (const n of tree) {
    if (!n.children?.length) return n;
    const leaf = findFirstLeaf(n.children);
    if (leaf) return leaf;
  }
  return null;
}
