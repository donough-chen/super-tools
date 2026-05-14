import React, { useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import * as Icons from '@ant-design/icons';
import {
  LogoutOutlined,
  UserOutlined,
  ReloadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch, history, useLocation, Outlet } from 'umi';
import type { MenuProps } from 'antd';
import type { UserModelState } from '@/models/user';
import type { GlobalModelState } from '@/models/global';
import styles from './BasicLayout.less';

const { Header, Sider, Content } = Layout;

/**
 * 静态前置「首页」菜单项（不入库、不走 RBAC，登录用户必见）
 * - code 用 __home__ 占位避免与 DB 权限码冲突
 */
const HOME_MENU: MenuNode = {
  id: -1,
  code: '__home__',
  name: '首页',
  module: '__home__',
  path: '/home',
  icon: 'HomeOutlined',
  sort: 0,
  children: [],
};

/** 把 MenuNode[] 转成 AntD Menu items（递归） */
function buildMenuFromAPI(nodes: MenuNode[]): MenuProps['items'] {
  return nodes.map((n) => {
    const IconComp: any = n.icon ? (Icons as any)[n.icon] : null;
    const icon = IconComp ? <IconComp /> : undefined;
    if (n.children && n.children.length > 0) {
      return {
        key: n.path,
        icon,
        label: n.name,
        children: buildMenuFromAPI(n.children),
      };
    }
    return {
      key: n.path,
      icon,
      label: n.name,
      onClick: () => history.push(n.path),
    };
  });
}

/** 收集所有叶子菜单的 path（用于 selectedKeys 匹配） */
function collectLeafPaths(nodes: MenuNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.children && n.children.length > 0) {
      out.push(...collectLeafPaths(n.children));
    } else {
      out.push(n.path);
    }
  }
  return out;
}

/**
 * BasicLayout — 主框架布局
 * - 菜单：首页（静态前置）+ 后端 RBAC 菜单树
 * - 用户下拉：刷新菜单 + 退出登录
 */
const BasicLayout: React.FC = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector(
    (state: { user: UserModelState }) => state.user,
  );
  const { collapsed, menus } = useSelector(
    (state: { global: GlobalModelState }) => state.global,
  );
  const { pathname } = useLocation();

  const finalMenus = useMemo(() => [HOME_MENU, ...menus], [menus]);
  const menuItems = useMemo(() => buildMenuFromAPI(finalMenus), [finalMenus]);

  /** 当前选中菜单项 */
  const selectedKeys = useMemo(() => {
    const all = collectLeafPaths(finalMenus);
    const exact = all.find((p) => p === pathname);
    if (exact) return [exact];
    const prefix =
      all.find((p) => pathname.startsWith(p + '/')) ||
      all.find((p) => pathname.startsWith(p));
    return prefix ? [prefix] : [];
  }, [pathname, finalMenus]);

  /** 默认展开的父菜单 */
  const openKeys = useMemo(
    () =>
      finalMenus
        .filter(
          (n) =>
            n.children &&
            n.children.length > 0 &&
            pathname.startsWith(n.path),
        )
        .map((n) => n.path),
    [pathname, finalMenus],
  );

  const toggleCollapsed = () => {
    dispatch({ type: 'global/setCollapsed', payload: !collapsed });
  };

  const userMenu = {
    items: [
      {
        key: 'refresh-menu',
        icon: <ReloadOutlined />,
        label: '刷新菜单',
        onClick: () => dispatch({ type: 'global/refreshRBAC' }),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => dispatch({ type: 'user/logout' }),
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
        <Content className={styles.content}><Outlet /></Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
