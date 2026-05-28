/**
 * 积分管理路由
 *
 * 路径与 database/028_add_points_admin_permissions.sql 中菜单 path 完全一致。
 * 每个页面通过 AuthWrapper 实现 L3 路由级权限控制（按 path 反查菜单 code）。
 *
 * 顶层 path '/points' 下首页重定向到 /points/dashboard，与 notificationRoutes 同构。
 */
const pointsRoutes = [
  {
    path: '/points',
    routes: [
      { path: '/points', redirect: '/points/dashboard' },
      {
        path: '/points/dashboard',
        component: '@/pages/Points/Dashboard',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/rules',
        component: '@/pages/Points/Rules',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/tasks',
        component: '@/pages/Points/Tasks',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/mall/items',
        component: '@/pages/Points/Mall/Items',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/mall/orders',
        component: '@/pages/Points/Mall/Orders',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/logs',
        component: '@/pages/Points/Logs',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/ops',
        component: '@/pages/Points/Ops',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/adjust',
        component: '@/pages/Points/Adjust',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/events',
        component: '@/pages/Points/Events',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/points/refund-ledger',
        component: '@/pages/Points/RefundLedger',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default pointsRoutes;
