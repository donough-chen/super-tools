import type { IRoute } from 'umi';
import authRoutes from './modules/auth';
import toolRoutes from './modules/tool';

const routes: IRoute[] = [
  {
    path: '/login',
    component: '@/pages/Login',
    title: '登录',
  },
  {
    path: '/register',
    component: '@/pages/Register',
    title: '注册',
  },
  {
    path: '/',
    component: '@/layouts/SecurityLayout',
    routes: [
      {
        path: '/',
        component: '@/layouts/BasicLayout',
        routes: [
          { path: '/', redirect: '/home' },
          {
            path: '/home',
            name: '首页',
            icon: 'HomeOutlined',
            component: '@/pages/Home',
          },
          ...toolRoutes,
          ...authRoutes,
          { path: '/403', component: '@/pages/403' },
          { component: '@/pages/404' },
        ],
      },
    ],
  },
];

export default routes;
