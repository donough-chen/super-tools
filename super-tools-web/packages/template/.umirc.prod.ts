import { defineConfig } from 'umi';

export default defineConfig({
  base: '/fe/<%= parent %>/<%= projectName %>/',
  publicPath: 'https://your-cdn.com/fe/<%= parent %>/<%= projectName %>/',
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
});
