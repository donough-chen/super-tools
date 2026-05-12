import type { IRoute } from 'umi';

/**
 * 会员管理路由（DB 顶级目录 member，type=1 已存在 — 见 008 迁移）
 * Spec-C2b 填充 3 二级页：
 * - /member/stats   权限码 member:stats:view
 * - /member/config  权限码 member:level:list / member:plan:list（Tab 内分别校验）
 * - /member/users   权限码 member:user:list / member:points:log:view（Tab 内分别校验）
 */
const memberRoutes: IRoute[] = [
  {
    path: '/member',
    routes: [
      { path: '/member', redirect: '/member/stats' },
      {
        path: '/member/stats',
        component: '@/pages/Member/Stats',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/config',
        component: '@/pages/Member/Config',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/member/users',
        component: '@/pages/Member/Users',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default memberRoutes;
