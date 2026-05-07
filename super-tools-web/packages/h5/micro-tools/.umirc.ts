import { defineConfig } from 'umi';
import umirc from './config';
import { join } from 'path';

export default defineConfig({
  ...umirc,
  base: '/fe/h5/micro-tools/',
  publicPath: '/fe/h5/micro-tools/',
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
    '@/assets': join(process.cwd(), 'packages/h5/micro-tools/assets'),
  },
  chainWebpack(memo: any) {
    umirc.chainWebpack(memo);
  },
});
