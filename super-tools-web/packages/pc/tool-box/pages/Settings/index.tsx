import React from 'react';
import { Card, Switch, Radio, Divider, Typography, Avatar, Button } from 'antd';
import {
  BulbOutlined,
  GlobalOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useHistory } from 'umi';
import { useThemeStore, type AccentColor } from '@/store/theme';
import { useUserStore } from '@/store/user';
import { updateUserSettings } from '@/services/api';
import './index.less';

const { Title, Text } = Typography;

// 主题色配置
const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'indigo', label: '靛蓝', color: '#4f46e5' },
  { value: 'blue',   label: '蓝色', color: '#2563eb' },
  { value: 'purple', label: '紫色', color: '#7c3aed' },
  { value: 'green',  label: '绿色', color: '#059669' },
];

const Settings: React.FC = () => {
  const { theme, setTheme, accentColor, setAccentColor } = useThemeStore();
  const { userInfo, settings, updateSettings, logout } = useUserStore();
  const history = useHistory();
  const isDark = theme === 'dark';

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleAccentColorChange = (color: AccentColor) => {
    setAccentColor(color);
  };

  /** 切换通知开关 */
  const handleNotificationChange = async (checked: boolean) => {
    updateSettings({ notificationEnabled: checked });
    // 登录用户同步到服务端
    if (userInfo) {
      await updateUserSettings({ notificationEnabled: checked }).catch(() => {});
    }
  };

  /** 退出登录 */
  const handleLogout = () => {
    logout();
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <Title level={3} className="settings__title">
          设置
        </Title>
        <Text type="secondary" className="settings__subtitle">个性化配置您的使用体验</Text>
      </div>

      {/* 账号信息 */}
      <Card className="settings__card" title={
        <div className="settings__card-title">
          <UserOutlined />
          <span>账号</span>
        </div>
      }>
        {userInfo ? (
          <div className="settings__item">
            <div className="settings__user-info">
              <Avatar size={40} icon={<UserOutlined />} src={userInfo.avatar || undefined} />
              <div className="settings__user-detail">
                <div className="settings__item-label">{userInfo.nickname || userInfo.username}</div>
                <div className="settings__item-desc">{userInfo.email}</div>
              </div>
            </div>
            <Button
              icon={<LogoutOutlined />}
              size="small"
              onClick={handleLogout}
              className="settings__logout-btn"
            >
              退出登录
            </Button>
          </div>
        ) : (
          <div className="settings__item">
            <div className="settings__item-info">
              <div className="settings__item-label">未登录</div>
              <div className="settings__item-desc">登录后可同步设置和公告阅读记录</div>
            </div>
            <Button type="primary" size="small" onClick={() => history.push('/login' as any)}>
              去登录
            </Button>
          </div>
        )}
      </Card>

      {/* 外观设置 */}
      <Card className="settings__card" title={
        <div className="settings__card-title">
          <BulbOutlined />
          <span>外观设置</span>
        </div>
      }>
        <div className="settings__item">
          <div className="settings__item-info">
            <div className="settings__item-label">深色模式</div>
            <div className="settings__item-desc">
              切换深色/浅色主题，设置将自动保存
            </div>
          </div>
          <Switch
            checked={isDark}
            onChange={handleThemeChange}
            checkedChildren="🌙"
            unCheckedChildren="☀️"
          />
        </div>

        <Divider className="settings__divider" />

        <div className="settings__item settings__item--accent">
          <div className="settings__item-info">
            <div className="settings__item-label">主题色</div>
            <div className="settings__item-desc">选择您喜欢的主题颜色</div>
          </div>
          <div className="settings__accent-grid">
            {ACCENT_COLORS.map(({ value, label, color }) => (
              <button
                key={value}
                className={`settings__accent-item${accentColor === value ? ' settings__accent-item--active' : ''}`}
                style={{ '--accent-color': color } as React.CSSProperties}
                title={label}
                onClick={() => handleAccentColorChange(value)}
                type="button"
              >
                <span className="settings__accent-dot" />
                <span className="settings__accent-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 语言设置 */}
      <Card className="settings__card" title={
        <div className="settings__card-title">
          <GlobalOutlined />
          <span>语言设置</span>
        </div>
      }>
        <div className="settings__item">
          <div className="settings__item-info">
            <div className="settings__item-label">界面语言</div>
            <div className="settings__item-desc">选择界面显示语言</div>
          </div>
          <Radio.Group defaultValue="zh-CN" size="small">
            <Radio.Button value="zh-CN">简体中文</Radio.Button>
            <Radio.Button value="en-US">English</Radio.Button>
          </Radio.Group>
        </div>
      </Card>

      {/* 通知设置 */}
      <Card className="settings__card" title={
        <div className="settings__card-title">
          <BellOutlined />
          <span>通知设置</span>
        </div>
      }>
        <div className="settings__item">
          <div className="settings__item-info">
            <div className="settings__item-label">接收更新通知</div>
            <div className="settings__item-desc">
              开启后，有新工具上线或版本更新时将弹窗提醒
              {!userInfo && <span className="settings__item-tip">（游客设置保存 7 天）</span>}
            </div>
          </div>
          <Switch
            checked={settings.notificationEnabled}
            onChange={handleNotificationChange}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        </div>
      </Card>
    </div>
  );
};

export default Settings;
