/**
 * 注：本测试避开 jest.mock(...)，因为项目当前 ts-jest@26 与 typescript@5.4 的
 * hoist-jest transformer 不兼容（'ts.getMutableClone is not a function'）。
 * 改用 require + 手工替换 module 实现。
 */
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// 在 import AuthButton 之前替换 umi 模块（避开 hoist-jest）
const umi = require('umi');
const originalUseSelector = umi.useSelector;
let __mockPermissions: string[] = [];
umi.useSelector = (fn: any) => fn({ global: { permissions: __mockPermissions } });

// 之后再 require AuthButton（让它在 useSelector 被替换后加载）
const AuthButton = require('./index').default;

afterAll(() => {
  umi.useSelector = originalUseSelector;
});

describe('<AuthButton>', () => {
  beforeEach(() => {
    __mockPermissions = ['tool:list', 'tool:create'];
  });

  it('有权限渲染 children', () => {
    const { getByText } = render(
      <AuthButton permCode="tool:create"><button>新建</button></AuthButton>,
    );
    expect(getByText('新建')).toBeInTheDocument();
  });

  it('无权限默认 fallback 渲染 null', () => {
    const { container } = render(
      <AuthButton permCode="tool:delete"><button>删除</button></AuthButton>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('无权限带自定义 fallback 渲染 fallback', () => {
    const { getByText } = render(
      <AuthButton permCode="tool:delete" fallback={<span>无权操作</span>}>
        <button>删除</button>
      </AuthButton>,
    );
    expect(getByText('无权操作')).toBeInTheDocument();
  });

  it('数组权限码 OR 语义任一命中即渲染', () => {
    const { getByText } = render(
      <AuthButton permCode={['tool:delete', 'tool:create']}><button>操作</button></AuthButton>,
    );
    expect(getByText('操作')).toBeInTheDocument();
  });
});
