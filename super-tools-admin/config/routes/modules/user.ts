import type { IRoute } from 'umi';

/**
 * 用户管理路由（DB 顶级目录 user，type=1 已存在）
 * Spec-C2a 填充：
 * - /users  权限码 user:list（AuthWrapper 内部判定）
 */
const userRoutes: IRoute[] = [
  {
    path: '/users',
    component: '@/pages/User/List',
    wrappers: ['@/components/AuthWrapper'],
  },
];

export default userRoutes;
