import { defineConfig } from 'umi';
import { UMI_ROUTES } from './routes.config';

export default defineConfig({
  base: '/fe/h5/micro-tools/',
  publicPath: 'https://your-cdn.com/fe/h5/micro-tools/',
  routes: UMI_ROUTES,
});
