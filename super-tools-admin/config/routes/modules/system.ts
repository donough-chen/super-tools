import type { IRoute } from 'umi';

/**
 * 系统管理路由（DB 顶级目录 system，type=1）
 * Spec-C1 填充 4 个二级页：
 * - /system/roles            权限码 role:menu
 * - /system/permissions      权限码 permission:menu
 * - /system/audit-logs       权限码 system:audit-log:menu
 * - /system/permission-test  权限码 system:permission-test:menu
 */
const systemRoutes: IRoute[] = [
  {
    path: '/system',
    routes: [
      { path: '/system', redirect: '/system/roles' },
      {
        path: '/system/roles',
        component: '@/pages/System/Roles',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/system/permissions',
        component: '@/pages/System/Permissions',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/system/audit-logs',
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
