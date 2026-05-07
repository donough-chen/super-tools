import React, { useState, useRef, useEffect, useCallback } from 'react';
import { navigateTo } from '@/utils/navigator';
import {
  Input,
  Tooltip,
  Dropdown,
  Drawer,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  CloseOutlined,
  MenuOutlined,
  CloudOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import classNames from 'classnames';
import { useThemeStore } from '@/store/theme';
import { useTabsStore, MAX_TABS, type TabItem } from '@/store/tabs';
import { searchTools, type ToolItem } from '@/utils/toolsData';
import Sidebar from '@/components/Sidebar';
import { useLayoutContext } from '@/layouts/BasicLayout';
import { useGlobalModal } from '@/utils/useGlobalModal';
import { useUserStore } from '@/store/user';
import './index.less';

interface WeatherInfo {
  city: string;
  temp: string;
  weather: string;
  icon: string;
}

const Header: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<ToolItem[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { mainRef } = useLayoutContext();
  const { showToast } = useGlobalModal();

  // Zustand store
  const { theme, toggleTheme } = useThemeStore();
  const { tabs, activeKey, addTab, removeTab, setActiveKey } = useTabsStore();
  const { userInfo, logout } = useUserStore();

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // tabs 过多时 toast 提示
  useEffect(() => {
    if (tabs.length > MAX_TABS) {
      showToast({
        content: '⚠️ 窗口缓存过多影响加载，请关闭闲置窗口',
        duration: 3000,
      });
    }
  }, [tabs.length > MAX_TABS]);

  // 获取天气信息
  useEffect(() => {
    fetch('/api/weather')
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) setWeather(data.data);
      })
      .catch(() => { });
  }, []);

  // 点击外部关闭搜索下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 更新 Tab 指示器位置
  useEffect(() => {
    if (!tabsRef.current || !indicatorRef.current) return;
    const activeTab = tabsRef.current.querySelector(
      '.header__tab--active',
    ) as HTMLElement;
    if (activeTab) {
      indicatorRef.current.style.width = `${activeTab.offsetWidth}px`;
      indicatorRef.current.style.left = `${activeTab.offsetLeft}px`;
    }
  }, [activeKey, tabs]);

  // 搜索处理
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    if (value.trim()) {
      const results = searchTools(value);
      setSearchResults(results);
      setSearchVisible(true);
    } else {
      setSearchResults([]);
      setSearchVisible(false);
    }
  }, []);

  // 点击搜索结果
  const handleSearchResultClick = (tool: ToolItem) => {
    setSearchVisible(false);
    setSearchValue('');
    addTab({ key: tool.path, title: tool.name, path: tool.path, closable: true });
    navigateTo(tool.path);
  };

  // 关闭标签
  const handleCloseTab = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const idx = tabs.findIndex((t) => t.key === key);
    const newTabs = tabs.filter((t) => t.key !== key);
    removeTab(key);
    if (activeKey === key) {
      const nextTab = newTabs[Math.max(0, idx - 1)];
      if (nextTab) navigateTo(nextTab.path);
    }
  };

  // 切换标签
  const handleTabClick = (tab: TabItem) => {
    setActiveKey(tab.key);
    navigateTo(tab.path);
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    showToast({ content: '已退出登录', duration: 2000 });
    navigateTo('/');
  };

  // 已登录用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: userInfo?.nickname || userInfo?.username || '个人中心',
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const isDark = theme === 'dark';
  const totalTools = 160;

  return (
    <div className="header">
      {/* ===== 左侧：Logo 区域 ===== */}
      <div className="header__left">
        {isMobile ? (
          <button
            className="header__menu-btn"
            onClick={() => setMobileDrawerVisible(true)}
          >
            <MenuOutlined />
          </button>
        ) : (
          <div
            className="header__logo"
            onClick={() => navigateTo('/')}
          >
            <div className="header__logo-icon">
              <span className="iconfont icon-tools" />
            </div>
            <div className="header__logo-text">
              <span className="header__logo-name">Super Tools</span>
              <span className="header__logo-slogan">在线工具箱</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== 中间：天气 + 搜索 + 标签栏 ===== */}
      <div className="header__center">
        {/* 上栏：天气 + 搜索框 */}
        <div className="header__top-bar">
          {!isMobile && weather && (
            <div className="header__weather">
              <CloudOutlined className="header__weather-icon" />
              <span className="header__weather-city">{weather.city}</span>
              <span className="header__weather-temp">{weather.temp}</span>
              <span className="header__weather-desc">{weather.weather}</span>
            </div>
          )}

          <div className="header__search-wrap" ref={searchRef}>
            {isMobile ? (
              <button
                className="header__search-icon-btn"
                onClick={() => navigateTo('/search')}
              >
                <SearchOutlined />
              </button>
            ) : (
              <>
                <Input
                  className="header__search-input"
                  prefix={<SearchOutlined className="header__search-prefix" />}
                  placeholder={`搜索 ${totalTools}+ 款工具...`}
                  value={searchValue}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchValue && setSearchVisible(true)}
                  allowClear
                />
                {searchVisible && searchResults.length > 0 && (
                  <div className="header__search-dropdown glass">
                    <div className="header__search-dropdown-inner">
                      {searchResults.map((tool) => (
                        <div
                          key={tool.key}
                          className="header__search-item"
                          onClick={() => handleSearchResultClick(tool)}
                        >
                          <span className="header__search-item-name">
                            {tool.name}
                          </span>
                          <span className="header__search-item-category">
                            {tool.category}
                          </span>
                          <span className="header__search-item-desc">
                            {tool.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {searchVisible && searchValue && searchResults.length === 0 && (
                  <div className="header__search-dropdown glass">
                    <div className="header__search-empty">未找到相关工具</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 下栏：窗口标签列表 */}
        <div className="header__tabs-bar">
          <div className="header__tabs" ref={tabsRef}>
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={classNames('header__tab', {
                  'header__tab--active': activeKey === tab.key,
                })}
                onClick={() => handleTabClick(tab)}
              >
                <span className="header__tab-title">{tab.title}</span>
                {tab.closable && (
                  <CloseOutlined
                    className="header__tab-close"
                    onClick={(e) => handleCloseTab(e, tab.key)}
                  />
                )}
              </div>
            ))}
            <div className="header__tab-indicator" ref={indicatorRef} />
          </div>
        </div>
      </div>

      {/* ===== 右侧：设置 + 主题切换 + 登录/用户 ===== */}
      <div className="header__right">
        <Tooltip title={isDark ? '切换亮色模式' : '切换暗色模式'}>
          <button className="header__action-btn" onClick={toggleTheme}>
            {isDark ? <BulbFilled /> : <BulbOutlined />}
          </button>
        </Tooltip>

        <Tooltip title="设置">
          <button
            className="header__action-btn"
            onClick={() => {
              addTab({ key: '/settings', title: '设置', path: '/settings', closable: true });
              navigateTo('/settings');
            }}
          >
            <SettingOutlined />
          </button>
        </Tooltip>

        {/* 登录 / 用户信息 */}
        {userInfo ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <button className="header__login-btn header__login-btn--logged">
              <UserOutlined />
              <span className="header__login-text">
                {userInfo.nickname || userInfo.username}
              </span>
            </button>
          </Dropdown>
        ) : (
          <button
            className="header__login-btn"
            onClick={() => navigateTo('/login')}
          >
            <UserOutlined />
            <span className="header__login-text">登录</span>
          </button>
        )}
      </div>

      {/* ===== 移动端侧边栏抽屉 ===== */}
      <Drawer
        title={
          <div className="header__drawer-title">
            <span className="iconfont icon-tools" />
            <span>Super Tools</span>
          </div>
        }
        placement="left"
        open={mobileDrawerVisible}
        onClose={() => setMobileDrawerVisible(false)}
        width={260}
        className="header__drawer"
      >
        <Sidebar mainRef={mainRef} onItemClick={() => setMobileDrawerVisible(false)} />
      </Drawer>
    </div>
  );
};

export default Header;
