import React from 'react';
import { default as SharedLayout } from '../../../shared/layouts';

export default ({ children, ...restProps }: any) => (
  <SharedLayout {...restProps}>{children}</SharedLayout>
);
