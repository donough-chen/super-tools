import { defineConfig } from 'umi';
import routes from './config/routes';

const BUILD_ENV = process.env.BUILD_ENV || 'development';

const envConfig: Record<string, any> = {
  development: {
    base: '/',
    publicPath: '/',
    define: {
      API_BASE_URL: 'http://localhost:7001',
    },
  },
  test: {
    base: '/test',
    publicPath: '/test/',
    define: {
      API_BASE_URL: 'https://api-stag.example.com',
    },
  },
  production: {
    base: '/pro',
    publicPath: '/pro/',
    define: {
      API_BASE_URL: 'https://api.example.com',
    },
  },
};

export default defineConfig({
  ...envConfig[BUILD_ENV],
  routes,
  nodeModulesTransform: {
    type: 'none',
  },
  dynamicImport: {
    loading: '@/components/PageLoading',
  },
  dva: {
    immer: true,
    hmr: true,
  },
  title: 'Super Tools 管理端',
  proxy: {
    '/api': {
      target: 'http://localhost:7001',
      changeOrigin: true,
    },
  },
  fastRefresh: {},
});
