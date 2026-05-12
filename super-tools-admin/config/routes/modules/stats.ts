import type { IRoute } from 'umi';

/**
 * 数据统计路由（DB 顶级目录 stats，type=1；DB 子菜单 stats:menu，path=/stats/overview）
 *
 * 当前 stats 页面尚未开发，临时用 Dashboard/Placeholder 占位。
 * 后续 Spec-C 完成 stats 子页后替换 component。
 */
const statsRoutes: IRoute[] = [
  {
    path: '/stats',
    routes: [
      { path: '/stats', redirect: '/stats/overview' },
      {
        path: '/stats/overview',
        component: '@/pages/Dashboard/Placeholder',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default statsRoutes;
