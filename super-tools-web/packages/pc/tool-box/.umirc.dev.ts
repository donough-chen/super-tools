import { defineConfig } from 'umi';

export default defineConfig({
  // 开发环境代理
  proxy: {
    '/api': {
      target: 'http://localhost:7001',
      changeOrigin: true,
    },
  },
});
