import { defineConfig } from 'umi';

export default defineConfig({
  // 生产环境：CDN publicPath
  publicPath: 'https://cdn.super-tools.com/pc/tool-box/',
  // 生产环境不开启 Mock
  mock: false,
});
