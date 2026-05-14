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
  {
    path: '/dashboard/department',
    component: '@/pages/Dashboard/Department',
    wrappers: ['@/components/AuthWrapper'],
  },
  {
    path: '/dashboard/alerts',
    component: '@/pages/Dashboard/Alerts',
    wrappers: ['@/components/AuthWrapper'],
  },
  {
    path: '/dashboard/alerts/rules',
    component: '@/pages/Dashboard/Alerts/Rules',
    wrappers: ['@/components/AuthWrapper'],
  },
  {
    path: '/dashboard/config',
    component: '@/pages/Dashboard/Config',
    wrappers: ['@/components/AuthWrapper'],
  },
];

export default dashboardRoutes;
