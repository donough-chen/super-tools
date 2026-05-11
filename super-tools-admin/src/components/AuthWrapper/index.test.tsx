import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// jest.mock 工厂内引用的外部变量必须以 mock 开头才被允许
let mockState: any = {};
let mockPathname = '/dashboard';
let mockRedirectTarget: string | null = null;

jest.mock('umi', () => ({
  useSelector: (fn: any) => fn(mockState),
  useLocation: () => ({ pathname: mockPathname }),
  Redirect: ({ to }: { to: string }) => {
    mockRedirectTarget = to;
    return null;
  },
}));

jest.mock('@/components/PageLoading', () => ({
  __esModule: true,
  default: () => <div data-testid="loading" />,
}));

import AuthWrapper from './index';

const sampleMenus: MenuNode[] = [
  {
    id: 1, code: 'dashboard', name: '仪表盘', module: 'dashboard',
    path: '/dashboard', icon: null, sort: 10, children: [],
  },
];

describe('<AuthWrapper>', () => {
  beforeEach(() => {
    mockRedirectTarget = null;
  });

  it('rbacReady=false 渲染 PageLoading', () => {
    mockState = { global: { menus: [], permissions: [], rbacReady: false } };
    mockPathname = '/dashboard';
    const { getByTestId } = render(
      <AuthWrapper><div>page</div></AuthWrapper>,
    );
    expect(getByTestId('loading')).toBeInTheDocument();
  });

  it('路由在菜单中且有权限 → 渲染 children', () => {
    mockState = { global: { menus: sampleMenus, permissions: ['dashboard'], rbacReady: true } };
    mockPathname = '/dashboard';
    const { getByText } = render(
      <AuthWrapper><div>page</div></AuthWrapper>,
    );
    expect(getByText('page')).toBeInTheDocument();
  });

  it('路由不在菜单中 → 重定向到 /403?required=...', () => {
    mockState = { global: { menus: sampleMenus, permissions: ['dashboard'], rbacReady: true } };
    mockPathname = '/system/role';
    render(<AuthWrapper><div>page</div></AuthWrapper>);
    expect(mockRedirectTarget).toContain('/403?required=');
    expect(mockRedirectTarget).toContain('unmapped');
  });
});
