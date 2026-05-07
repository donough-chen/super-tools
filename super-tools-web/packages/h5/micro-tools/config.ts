import path from 'path';
import { defineConfig } from 'umi';
import autoprefixer from 'autoprefixer';
import pxtorem from 'postcss-pxtorem';

// 根据 APP_ROOT 计算输出路径
const appRoot = process.env.APP_ROOT || 'packages';
const distPath = appRoot.replace(/^packages/, 'dist');
const outputPath = path.relative(appRoot, distPath);

export default defineConfig({
  targets: {
    chrome: 49,
    ios: 10,
  },
  outputPath,
  exportStatic: {},
  // 开启路由级代码分割
  dynamicImport: {
    // 路径相对于 .umi/core/routes.ts，需要回退两级到项目根目录
    loading: '../../Loading',
  },
  // 开启文件名 hash（非路由 hash）
  hash: true,
  // 媒体文件支持
  chainWebpack(memo: any) {
    memo.module
      .rule('media')
      .test(/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/)
      .use('file')
      .loader('file-loader');
  },
  extraPostCSSPlugins: [
    // 注意：UmiJS 3 内置 PostCSS 7，必须使用 autoprefixer@9 和 postcss-pxtorem@5
    autoprefixer({
      overrideBrowserslist: ['> 0.5%', 'last 2 versions', 'iOS >= 10'],
    }),
    // H5 rem 适配：750px 设计稿 → rootValue: 20（1rem = 20px）
    pxtorem({
      rootValue: 20,
      propList: ['*'],
      exclude: /node_modules/i,
    }),
  ],
});
