#!/bin/node
'use strict';

const { spawn } = require('child_process');

const appRoot = process.argv[2];
if (!appRoot) {
  throw new Error(`
    请输入正确的项目目录!
    eg.
    $ yarn start h5/my-project
  `);
}

process.env.APP_ROOT = `packages/${appRoot}`;

// 兼容 Node.js 17+ 的 OpenSSL 3.x，解决 webpack 旧版本加密算法不支持问题
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --openssl-legacy-provider';

spawn('umi', ['dev'], { shell: true, stdio: 'inherit' });
