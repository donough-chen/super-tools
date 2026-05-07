import { defineConfig } from 'umi';

const proxy = {
  target: 'https://test.your-api-server.com/',
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
        {
          path: '/',
          component: '@/pages/home',
          title: '<%= parent %>-<%= projectName %>',
        },
      ],
    },
  ],
  proxy: {
    '/api': {
      ...proxy,
    },
  },
});
