/**
 * 反馈管理路由（DB 顶级目录 feedback，type=1）
 * - /feedback → 重定向到 /feedback/list
 * - /feedback/list 对应 DB 权限码 feedback:list-page
 * - /feedback/stats 对应 DB 权限码 feedback:stats-page
 * - /feedback/snippets 对应 DB 权限码 feedback:snippet-page
 * - /feedback/snippets/stats 对应 DB 权限码 feedback:snippet-stats-page
 */
const feedbackRoutes = [
  {
    path: '/feedback',
    routes: [
      { path: '/feedback', redirect: '/feedback/list' },
      {
        path: '/feedback/list',
        component: '@/pages/Feedback/List',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/feedback/stats',
        component: '@/pages/Feedback/Stats',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/feedback/snippets/stats',
        component: '@/pages/Feedback/Snippets/Stats',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/feedback/snippets',
        component: '@/pages/Feedback/Snippets',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default feedbackRoutes;
