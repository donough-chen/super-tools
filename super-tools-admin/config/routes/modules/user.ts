import type { IRoute } from 'umi';

/**
 * 用户管理路由（DB 顶级目录 user，type=1）
 * - /user → 重定向到 /user/list
 * - /user/list 对应 DB 权限码 user:menu（type=2，path=/user/list）
 *
 * 注意：路径必须与数据库 permissions.path 严格一致，否则 BasicLayout 渲染的菜单
 * 跳转目标在前端找不到对应路由 / AuthWrapper 在菜单树里找不到节点 → 403。
 */
const userRoutes: IRoute[] = [
  {
    path: '/user',
    routes: [
      { path: '/user', redirect: '/user/list' },
      {
        path: '/user/list',
        component: '@/pages/User/List',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default userRoutes;
