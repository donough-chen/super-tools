import type { IRoute } from 'umi';

/**
 * 反馈管理路由（DB 顶级目录 feedback，type=1）
 * - /feedback → 重定向到 /feedback/list
 * - /feedback/list 对应 DB 权限码 feedback:menu（type=2，path=/feedback/list）
 */
const feedbackRoutes: IRoute[] = [
  {
    path: '/feedback',
    routes: [
      { path: '/feedback', redirect: '/feedback/list' },
      {
        path: '/feedback/list',
        component: '@/pages/Feedback/List',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default feedbackRoutes;
