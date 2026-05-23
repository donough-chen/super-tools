/**
 * 会员管理路由（DB 顶级目录 member，type=1；DB 子菜单仅 member:menu，path=/member/list）
 *
 * 前端实际拆了 Stats / Config / Users 三页，但数据库菜单只有一项入口 /member/list。
 * 所以：
 * - /member       → 重定向到 /member/list
 * - /member/list  → Users 页（业务最常用入口，也是 DB 菜单实际指向）
 * - /member/stats / /member/config / /member/users 作为同模块的扩展页保留，
 *   AuthWrapper 找不到精确菜单节点时会按"前缀回退到父目录 member"判定权限。
 */
const memberRoutes = [
  {
    path: '/member',
    routes: [
      { path: '/member', redirect: '/member/list' },
      {
        path: '/member/list',
        component: '@/pages/Member/Users',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/stats',
        component: '@/pages/Member/Stats',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/config',
        component: '@/pages/Member/Config',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/users',
        component: '@/pages/Member/Users',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/orders',
        component: '@/pages/Member/Orders',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default memberRoutes;
