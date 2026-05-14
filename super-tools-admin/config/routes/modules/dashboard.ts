/**
 * 数据看板路由
 * 路径与 DB permissions.path 对齐：/dashboard/*
 */
const dashboardRoutes = [
  {
    path: '/dashboard',
    redirect: '/dashboard/overview',
  },
  {
    path: '/dashboard/overview',
    component: '@/pages/Dashboard/Overview',
    wrappers: ['@/components/AuthWrapper'],
  },
  {
    path: '/dashboard/analytics',
    component: '@/pages/Dashboard/Analytics',
    wrappers: ['@/components/AuthWrapper'],
  },
];

export default dashboardRoutes;
