import { defineConfig } from 'umi';
import { UMI_ROUTES } from './routes.config';

export default defineConfig({
  base: '/fepreview/h5/micro-tools/',
  publicPath: '/fepreview/h5/micro-tools/',
  routes: UMI_ROUTES,
});
