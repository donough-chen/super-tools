'use strict';

module.exports = {
  // 测试文件匹配规则
  spec: 'test/**/*.test.ts',
  // 超时时间（ms）：接口测试需要较长时间
  timeout: 30000,
  // 使用 ts-node 执行 TypeScript 测试文件
  require: ['ts-node/register'],
  // 测试报告格式
  reporter: 'spec',
  // 退出进程（防止异步操作阻塞）
  exit: true,
};
