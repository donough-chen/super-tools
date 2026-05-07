/**
 * 构建配置
 * 包含 pxtorem、代码分割、CDN 等构建相关配置
 */

// PC 端不需要 pxtorem（PC 端使用 px 单位）
export const pxtoremConfig = null;

// 代码分割策略
export const chainWebpackConfig = {
  // 将 antd 单独打包
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      antd: {
        name: 'antd',
        test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
        priority: 10,
      },
      vendors: {
        name: 'vendors',
        test: /[\\/]node_modules[\\/]/,
        priority: 5,
      },
    },
  },
};

// CDN 资源（生产环境）
export const cdnConfig = {
  js: [],
  css: [],
};
