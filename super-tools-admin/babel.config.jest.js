/**
 * 仅供 jest 测试用的 babel 配置（package.json 的 jest.transform 显式引用）
 * UmiJS 构建用自己内置的 babel 配置，不读这个文件
 *
 * 引入原因：项目当前 ts-jest@26 与 typescript@5.4.0 的 hoist-jest transformer
 * 不兼容（'ts.getMutableClone is not a function'），导致 .tsx 测试无法跑 jest.mock。
 * 改用 babel-jest 处理 .tsx 文件以绕开此问题，.ts 文件继续走 ts-jest。
 *
 * 后续应升级 ts-jest 到 >=29 适配 typescript@5+，届时可移除本文件。
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
};
