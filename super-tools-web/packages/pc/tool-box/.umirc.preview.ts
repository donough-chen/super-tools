import { defineConfig } from 'umi';

export default defineConfig({
  // 预发布环境：publicPath 指向预发布路径
  publicPath: '/fepreview/pc/tool-box/',
  // 代理配置
  proxy: {
    '/api': {
      target: 'https://preview-api.super-tools.com',
      changeOrigin: true,
    },
  },
});
