import { defineConfig } from 'umi';

export default defineConfig({
  base: '/fe/h5/micro-tools/',
  publicPath: 'https://your-cdn.com/fe/h5/micro-tools/',
  routes: [
    {
      exact: false,
      path: '/',
      component: '@/layouts',
      routes: [
        { path: '/', component: '@/pages/home', title: '首页' },
        { path: '/favorites', component: '@/pages/favorites', title: '收藏' },
        { path: '/featured', component: '@/pages/featured', title: '特色' },
        { path: '/sites', component: '@/pages/sites', title: '网站' },
        { path: '/mine', component: '@/pages/mine', title: '我的' },
        { path: '/search', component: '@/pages/search', title: '搜索' },
        { path: '/login', component: '@/pages/login', title: '登录' },
        { path: '/settings/binding', component: '@/pages/settings/binding', title: '账号绑定' },
        { path: '/settings/devices', component: '@/pages/settings/devices', title: '登录设备' },
        { path: '/settings/privacy', component: '@/pages/settings/privacy', title: '隐私设置' },
        { path: '/settings/notification', component: '@/pages/settings/notification', title: '通知设置' },
        { path: '/settings', component: '@/pages/settings', title: '设置' },
        { path: '/profile', component: '@/pages/profile', title: '个人信息' },
        { path: '/member', component: '@/pages/member', title: '会员' },
        { path: '/help', component: '@/pages/help', title: '使用帮助' },
        { path: '/about', component: '@/pages/about', title: '关于我们' },
      ],
    },
  ],
});
