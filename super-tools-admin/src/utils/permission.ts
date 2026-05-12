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
 * DFS 在菜单树中按 pathname 查找节点（精确 path 匹配）
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
 * 把树展平为节点列表（含所有层级）
 */
function flattenTree(tree: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/**
 * 在菜单树中按 pathname 查找节点（带"父目录前缀"回退）
 *
 * 用途：前端可能存在数据库菜单未列出的扩展子页（如 /member/stats、/member/config，
 * DB 仅有 /member/list）。精确匹配失败时回退用最长前缀匹配父级目录节点，
 * 以"父目录的权限码"作为兜底校验依据，避免硬性 403。
 *
 * 例：path=/member/stats，DB 仅有 member(/member, type=1) 与 member:menu(/member/list)，
 *     精确未命中 → 用前缀匹配命中 member(/member) → 用 'member' code 校验。
 */
export function findMenuByPathWithFallback(
  tree: MenuNode[],
  pathname: string,
): MenuNode | null {
  const exact = findMenuByPath(tree, pathname);
  if (exact) return exact;

  const flat = flattenTree(tree);
  // 选最长前缀（确保命中最近的父级目录而不是根 '/'）
  let best: MenuNode | null = null;
  for (const n of flat) {
    if (!n.path) continue;
    // 必须是真前缀（避免 '/member' 误匹配 '/member-x'）
    if (pathname === n.path || pathname.startsWith(n.path + '/')) {
      if (!best || (n.path.length > best.path.length)) best = n;
    }
  }
  return best;
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
