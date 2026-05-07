/**
 * 开发环境代理配置
 * 将 /api 开头的请求代理到后端服务
 */
export default {
  '/api': {
    target: 'http://localhost:7001',
    changeOrigin: true,
  },
};
