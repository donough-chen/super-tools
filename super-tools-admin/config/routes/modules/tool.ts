import type { IRoute } from 'umi';

/**
 * 工具管理路由（DB 顶级目录 tool，type=1）
 * - /tool → 重定向到 /tool/list
 * - /tool/list 对应 DB 权限码 tool:menu（type=2）
 */
const toolRoutes: IRoute[] = [
  {
    path: '/tool',
    routes: [
      { path: '/tool', redirect: '/tool/list' },
      {
        path: '/tool/list',
        component: '@/pages/Tool/List',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default toolRoutes;
