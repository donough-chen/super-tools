const path = require('path');
const { defineConfig } = require('umi');

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
  // 开启路由级代码分割
  dynamicImport: {
    // 路径相对于 .umi/core/routes.ts，需要回退两级到项目根目录
    loading: '../../Loading',
  },
  // 开启文件名 hash（非路由 hash）
  hash: true,
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
    // H5 rem 适配：750px 设计稿 → rootValue: 20（1rem = 20px）
    require('postcss-pxtorem')({
      rootValue: <%= designWidth === '750' ? 20 : 10 %>,
      propList: ['*'],
      exclude: /node_modules/i,
    }),
  ],
});
