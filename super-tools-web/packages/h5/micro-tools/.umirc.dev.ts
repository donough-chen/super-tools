import { defineConfig } from 'umi';

const proxy = {
  target: 'http://localhost:7001',
  changeOrigin: true,
  logLevel: 'info',
  secure: false,
  filter: (_pathname: string, req: any) => req.xhr,
};

export default defineConfig({
  routes: [
    {
      exact: false,
      path: '/',
      component: '@/layouts',
      routes: [
        // ==================== 一级页面 ====================
        { path: '/', component: '@/pages/home', title: '首页' },
        { path: '/favorites', component: '@/pages/favorites', title: '收藏' },
        { path: '/featured', component: '@/pages/featured', title: '特色' },
        { path: '/sites', component: '@/pages/sites', title: '网站' },
        { path: '/mine', component: '@/pages/mine', title: '我的' },
        // ==================== 二级页面 ====================
        { path: '/search', component: '@/pages/search', title: '搜索' },
        { path: '/login', component: '@/pages/login', title: '登录' },
        // 子路由必须放在 /settings 之前以匹配优先（exact 路由匹配规则）
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
  proxy: {
    '/api': {
      ...proxy,
    },
  },
});
