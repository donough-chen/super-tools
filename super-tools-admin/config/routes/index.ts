import dashboardRoutes from './modules/dashboard';
import systemRoutes from './modules/system';
import userRoutes from './modules/user';
import categoryRoutes from './modules/category';
import toolRoutes from './modules/tool';
import feedbackRoutes from './modules/feedback';
import statsRoutes from './modules/stats';
import memberRoutes from './modules/member';

const routes = [
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
          // 首页不挂 AuthWrapper - 登录用户必见（公告 / 业务模块 / 快捷入口）
          { path: '/home', component: '@/pages/Home' },

          ...dashboardRoutes,
          ...systemRoutes,
          ...userRoutes,
          ...categoryRoutes,
          ...toolRoutes,
          ...feedbackRoutes,
          ...statsRoutes,
          ...memberRoutes,

          { path: '/403', component: '@/pages/403' },
          { component: '@/pages/404' },
        ],
      },
    ],
  },
];

export default routes;
