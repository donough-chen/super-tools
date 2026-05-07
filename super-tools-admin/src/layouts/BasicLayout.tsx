import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import {
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch, history } from 'umi';
import type { UserModelState } from '@/models/user';
import type { GlobalModelState } from '@/models/global';
import styles from './BasicLayout.less';

const { Header, Sider, Content } = Layout;

/**
 * BasicLayout — 主框架布局
 * 包含侧边菜单、顶部工具栏和内容区域
 */
const BasicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state: { user: UserModelState }) => state.user);
  const { collapsed } = useSelector((state: { global: GlobalModelState }) => state.global);

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
        <div className={styles.logo}>
          {collapsed ? 'ST' : 'Super Tools'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['home']}
          items={[
            {
              key: 'home',
              icon: <HomeOutlined />,
              label: '首页',
              onClick: () => history.push('/home'),
            },
          ]}
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
        <Content className={styles.content}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
