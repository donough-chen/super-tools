import type { IRoute } from 'umi';

/**
 * 反馈管理路由
 * Spec-C2a 填充：
 * - /feedback  权限码 feedback:list（AuthWrapper 内部判定）
 */
const feedbackRoutes: IRoute[] = [
  {
    path: '/feedback',
    component: '@/pages/Feedback/List',
    wrappers: ['@/components/AuthWrapper'],
  },
];

export default feedbackRoutes;
