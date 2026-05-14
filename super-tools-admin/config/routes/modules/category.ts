/**
 * 分类管理路由（DB 顶级目录 category，type=1）
 * - /category → 重定向到 /category/list
 * - /category/list 对应 DB 权限码 category:menu（type=2）
 */
const categoryRoutes = [
  {
    path: '/category',
    routes: [
      { path: '/category', redirect: '/category/list' },
      {
        path: '/category/list',
        component: '@/pages/Tool/Categories',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default categoryRoutes;
