import { defineConfig } from 'umi';
import umirc from './config';
import { join } from 'path';

export default defineConfig({
  ...umirc,
  base: '/fe/<%= parent %>/<%= projectName %>/',
  publicPath: '/fe/<%= parent %>/<%= projectName %>/',
  nodeModulesTransform: {
    type: 'none',
  },
  alias: {
    '@/utils': join(process.cwd(), 'packages/shared/utils'),
    '@/appsdk': join(process.cwd(), 'packages/shared/appsdk'),
    '@/hooks': join(process.cwd(), 'packages/shared/hooks'),
    '@/constants': join(process.cwd(), 'packages/shared/constants'),
    '@/contexts': join(process.cwd(), 'packages/shared/contexts'),
    '@/components': join(process.cwd(), 'packages/shared/components'),
  },
  chainWebpack(memo) {
    umirc.chainWebpack(memo);
  },
});
