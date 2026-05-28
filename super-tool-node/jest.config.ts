import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }],
  },
  // 体系隔离 (B 阶段 ε task)：本仓库测试体系混用，mocha+egg-bin 与 jest 双轨并存。
  // 以下文件依赖 egg-mock/bootstrap（mocha 风格，注入 before/beforeEach 等钩子），
  // 由 `npm run cov` (egg-bin/mocha) 跑；jest 必须排除以避免误跑。
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/test/api/',
    '<rootDir>/test/e2e/',
    '<rootDir>/test/app/integration/',
    '<rootDir>/test/app/middleware/idempotency\\.test\\.ts$',
    '<rootDir>/test/app/model/points_v2\\.test\\.ts$',
    '<rootDir>/test/app/service/member\\.points\\.test\\.ts$',
    '<rootDir>/test/app/service/member\\.refund\\.test\\.ts$',
    '<rootDir>/test/app/service/pointsExpire\\.test\\.ts$',
    '<rootDir>/test/app/service/pointsExpire\\.b5\\.test\\.ts$',
    '<rootDir>/test/app/service/pointsMall\\.test\\.ts$',
    '<rootDir>/test/app/service/pointsReconcile\\.test\\.ts$',
    '<rootDir>/test/app/service/pointsRule\\.test\\.ts$',
    '<rootDir>/test/app/service/sign\\.test\\.ts$',
    '<rootDir>/test/app/service/task\\.test\\.ts$',
    '<rootDir>/test/app/service/task\\.claim\\.test\\.ts$',
  ],
};

export default config;
