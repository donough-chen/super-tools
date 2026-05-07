import React, { useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import * as Icons from '@ant-design/icons';
import {
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch, history, useLocation } from 'umi';
import type { MenuProps } from 'antd';
import type { UserModelState } from '@/models/user';
import type { GlobalModelState } from '@/models/global';
import routes from '../../config/routes';
import styles from './BasicLayout.less';

const { Header, Sider, Content } = Layout;

interface RouteMeta {
  path?: string;
  name?: string;
  icon?: string;
  redirect?: string;
  routes?: RouteMeta[];
}

/** 从路由配置动态构建 AntD Menu items */
function buildMenuFromRoutes(list: RouteMeta[]): MenuProps['items'] {
  return list
    .filter((r) => !!r.name && !!r.path)
    .map((r) => {
      const IconComp: any = r.icon ? (Icons as any)[r.icon] : null;
      const icon = IconComp ? <IconComp /> : undefined;
      const childRoutes = (r.routes || []).filter((c) => !!c.name && !!c.path);
      if (childRoutes.length > 0) {
        return {
          key: r.path!,
          icon,
          label: r.name,
          children: buildMenuFromRoutes(childRoutes),
        };
      }
      return {
        key: r.path!,
        icon,
        label: r.name,
        onClick: () => history.push(r.path!),
      };
    });
}

/** 提取 BasicLayout 下所有有 name 的子路由，作为顶层菜单输入 */
function getMenuRoutes(): RouteMeta[] {
  const sec = (routes as any[]).find(
    (r) => r.component === '@/layouts/SecurityLayout',
  );
  const basic = sec?.routes?.find(
    (r: any) => r.component === '@/layouts/BasicLayout',
  );
  return (basic?.routes || []) as RouteMeta[];
}

/**
 * BasicLayout — 主框架布局
 * 包含侧边菜单（路由驱动）、顶部工具栏和内容区域
 */
const BasicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector(
    (state: { user: UserModelState }) => state.user,
  );
  const { collapsed } = useSelector(
    (state: { global: GlobalModelState }) => state.global,
  );
  const { pathname } = useLocation();

  const menuRoutes = useMemo(() => getMenuRoutes(), []);
  const menuItems = useMemo(() => buildMenuFromRoutes(menuRoutes), [menuRoutes]);

  /** 当前选中菜单项 */
  const selectedKeys = useMemo(() => {
    const allLeafPaths = menuRoutes
      .flatMap((r) => (r.routes && r.routes.length > 0 ? r.routes : [r]))
      .map((r) => r.path)
      .filter(Boolean) as string[];
    const exact = allLeafPaths.find((p) => p === pathname);
    if (exact) return [exact];
    const prefix =
      allLeafPaths.find((p) => pathname.startsWith(p + '/')) ||
      allLeafPaths.find((p) => pathname.startsWith(p));
    return prefix ? [prefix] : [];
  }, [pathname, menuRoutes]);

  /** 默认展开的父菜单 */
  const openKeys = useMemo(() => {
    return menuRoutes
      .filter(
        (r) =>
          r.routes &&
          r.routes.length > 0 &&
          r.path &&
          pathname.startsWith(r.path),
      )
      .map((r) => r.path!);
  }, [pathname, menuRoutes]);

  const handleLogout = () => {
    dispatch({ type: 'user/logout' });
  };

  const toggleCollapsed = () => {
    dispatch({ type: 'global/setCollapsed', payload: !collapsed });
  };

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Layout className={styles.layout}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div className={styles.logo}>{collapsed ? 'ST' : 'Super Tools'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <span className={styles.trigger} onClick={toggleCollapsed}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <div className={styles.right}>
            <Dropdown menu={userMenu}>
              <Space className={styles.userInfo}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{currentUser?.nickname || currentUser?.username || '用户'}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>{children}</Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
