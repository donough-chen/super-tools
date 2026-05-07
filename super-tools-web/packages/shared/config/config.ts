import path from 'path';
import { defineConfig } from 'umi';

// 根据 APP_ROOT 计算输出路径
const appRoot = process.env.APP_ROOT || 'packages';
const distPath = appRoot.replace(/^packages/, 'dist');
const outputPath = path.relative(appRoot, distPath);

module.exports = defineConfig({
  targets: {
    chrome: 49,
    ios: 10,
  },
  outputPath,
  exportStatic: {},
  // 媒体文件支持
  chainWebpack(memo) {
    memo.module
      .rule('media')
      .test(/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/)
      .use('file')
      .loader('file-loader');
  },
  extraPostCSSPlugins: [
    require('autoprefixer')({
      overrideBrowserslist: ['> 0.5%', 'last 2 versions', 'iOS >= 10'],
    }),
  ],
});
