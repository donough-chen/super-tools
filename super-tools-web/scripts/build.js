#!/bin/node
'use strict';

const { spawn } = require('child_process');

const appRoot = process.argv[2];
if (!appRoot) {
  throw new Error(`
    请输入正确的项目目录!
    eg.
    $ yarn build h5/my-project
  `);
}

process.env.APP_ROOT = `packages/${appRoot}`;

spawn('umi', ['build'], { shell: true, stdio: 'inherit' });
