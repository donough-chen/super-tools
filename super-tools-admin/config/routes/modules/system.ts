/**
 * 系统管理路由（DB 顶级目录 system，type=1）
 *
 * 路径与 DB permissions.path 严格对齐（单数）：
 * - /system/role            → 权限码 system:role
 * - /system/permission      → 权限码 system:permission
 * - /system/audit-log       → 权限码 system:audit-log
 * - /system/permission-test → 权限码 system:permission-test
 */
const systemRoutes = [
  {
    path: '/system',
    routes: [
      { path: '/system', redirect: '/system/role' },
      {
        path: '/system/role',
        component: '@/pages/System/Roles',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/system/permission',
        component: '@/pages/System/Permissions',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/system/audit-log',
        component: '@/pages/System/AuditLogs',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/system/permission-test',
        component: '@/pages/System/PermissionTest',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default systemRoutes;
