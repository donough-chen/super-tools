import { defineConfig } from 'umi';

export default defineConfig({
  base: '/fepreview/<%= parent %>/<%= projectName %>/',
  publicPath: '/fepreview/<%= parent %>/<%= projectName %>/',
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
