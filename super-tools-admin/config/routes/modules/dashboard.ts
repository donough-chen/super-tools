import type { IRoute } from 'umi';

/**
 * 仪表盘路由（DB 顶级菜单 dashboard，type=2 叶子）
 * 路径与 DB permissions.path 对齐：/dashboard
 */
const dashboardRoutes: IRoute[] = [
  {
    path: '/dashboard',
    component: '@/pages/Dashboard/Placeholder',
    wrappers: ['@/components/AuthWrapper'],
  },
];

export default dashboardRoutes;
