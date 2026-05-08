import { defineConfig } from 'umi';
import { UMI_ROUTES } from './routes.config';

const proxy = {
  target: 'http://localhost:7001',
  changeOrigin: true,
  logLevel: 'info',
  secure: false,
  filter: (_pathname: string, req: any) => req.xhr,
};

export default defineConfig({
  routes: UMI_ROUTES,
  proxy: {
    '/api': {
      ...proxy,
    },
  },
});
