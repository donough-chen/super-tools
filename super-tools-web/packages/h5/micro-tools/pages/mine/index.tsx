/**
 * 我的页 Mine
 *
 * 一级页面：用户信息栏 + 功能选项列表
 * 头部按钮：[agent, scan]
 *
 * 徽标显示规则：
 * - 已登录付费会员 → 「付费会员」
 * - 已登录免费会员 → memberInfo.level.name（如「金牌会员」）
 * - memberInfo 未加载 → 「普通用户」
 *
 * 注：原版用 userInfo.userType === 2 判断「会员」是错误的，
 *     userType=2 实际是「管理员」（与会员体系无关）。
 */
import React, { useEffect } from 'react';
import { navigateTo } from '@/utils/navigator';
import { useUserStore, useGlobalStore, useMemberStore } from '../../store';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import AppModal from '../../components/AppModal';
import { TAB_BAR_ITEMS } from '../../constants';
import './index.less';
import { resolveIcon } from '../../utils/icon';

const MENU_ITEMS = [
  { key: 'member', name: '会员中心', path: '/member', icon: '/assets/icons/like.png' },
  { key: 'tasks', name: '任务中心', path: '/tasks', icon: '/assets/icons/crown.png' },
  { key: 'mall', name: '积分商城', path: '/points-mall', icon: '/assets/icons/like.png' },
  { key: 'subscribe', name: '订阅会员', path: '/member/subscribe', icon: '/assets/icons/crown.png' },
  { key: 'orders', name: '我的订单', path: '/member/orders', icon: '/assets/icons/crown.png' },
  { key: 'feedback', name: '意见反馈', path: '/feedback', icon: '/assets/icons/feedback.png' },
  { key: 'about', name: '关于我们', path: '/about', icon: '/assets/icons/about.png' },
  { key: 'settings', name: '设置', path: '/settings', icon: '/assets/icons/setting.png' },
  { key: 'help', name: '使用帮助', path: '/help', icon: '/assets/icons/help.png' },
  { key: 'logout', name: '退出登录', path: '', icon: '/assets/icons/logout.png' },
];

const MinePage: React.FC = () => {
  const { isLoggedIn, userInfo, logout } = useUserStore();
  const memberInfo = useMemberStore(s => s.memberInfo);
  const fetchMemberInfo = useMemberStore(s => s.fetchMemberInfo);
  const { tabBarMode } = useGlobalStore();
  const [logoutModalVisible, setLogoutModalVisible] = React.useState(false);

  // 登录后异步拉取会员信息（5 分钟缓存）
  useEffect(() => {
    if (isLoggedIn) fetchMemberInfo();
  }, [isLoggedIn, fetchMemberInfo]);

  const memberBadge = memberInfo?.paid?.isPaid
    ? '付费会员'
    : (memberInfo?.level?.name || '普通用户');

  const handleMenuClick = (item: typeof MENU_ITEMS[0]) => {
    if (item.key === 'logout') {
      setLogoutModalVisible(true);
      return;
    }
    navigateTo(item.path);
  };

  const handleLogout = async () => {
    await logout();
    setLogoutModalVisible(false);
    navigateTo('/');
  };

  return (
    <div className="page-mine">
      <AppHeader
        title="我的"
        buttons={[
          { type: 'message', onClick: () => navigateTo('/notifications') },
          { type: 'agent' },
          { type: 'scan' },
        ]}
      />

      <main className="page-mine__content">
        {/* 用户信息栏 */}
        <div
          className="page-mine__user-card"
          onClick={() => navigateTo(isLoggedIn ? '/profile' : '/login')}
        >
          <img
            className="page-mine__avatar"
            src={userInfo?.avatar || resolveIcon('/assets/icons/avatar.png')}
            alt="头像"
          />
          <div className="page-mine__user-info">
            {isLoggedIn ? (
              <>
                <span className="page-mine__nickname">
                  {userInfo?.nickname || userInfo?.username || '用户'}
                </span>
                <span className="page-mine__badge">{memberBadge}</span>
              </>
            ) : (
              <span className="page-mine__login-hint">点击登录</span>
            )}
          </div>
        </div>

        {/* 功能选项列表 */}
        <div className="page-mine__menu">
          {MENU_ITEMS
            // 未登录时隐藏「退出登录」
            .filter(item => item.key !== 'logout' || isLoggedIn)
            .map(item => (
              <div
                key={item.key}
                className="page-mine__menu-item"
                onClick={() => handleMenuClick(item)}
              >
                <div className="page-mine__menu-item-content">
                  <img className="page-mine__menu-item-content-icon" src={resolveIcon(item.icon)} alt={item.name} />
                  <span className="page-mine__menu-item-content-name">{item.name}</span>
                </div>
                <span className="page-mine__arrow" />
              </div>
            ))}
        </div>
      </main>

      {/* 退出登录确认弹窗 */}
      <AppModal
        visible={logoutModalVisible}
        title="退出登录"
        content={<p>确定要退出登录吗？</p>}
        onConfirm={handleLogout}
        onCancel={() => setLogoutModalVisible(false)}
        onClose={() => setLogoutModalVisible(false)}
      />

      <AppTabBar mode={tabBarMode} items={TAB_BAR_ITEMS} />
    </div>
  );
};

export default MinePage;
