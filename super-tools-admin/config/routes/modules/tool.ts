import type { IRoute } from 'umi';

/** 工具管理相关路由 */
const toolRoutes: IRoute[] = [
  {
    path: '/tools',
    name: 'Tools管理',
    icon: 'AppstoreOutlined',
    routes: [
      { path: '/tools', redirect: '/tools/list' },
      {
        path: '/tools/categories',
        name: '工具分类管理',
        icon: 'TagsOutlined',
        component: '@/pages/Tool/Categories',
      },
      {
        path: '/tools/list',
        name: '工具列表管理',
        icon: 'ToolOutlined',
        component: '@/pages/Tool/List',
      },
    ],
  },
];

export default toolRoutes;
