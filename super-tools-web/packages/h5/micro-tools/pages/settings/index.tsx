/**
 * 设置中心 /settings（重构）
 *
 * 3 大分组：
 *  1) 账号安全：账号绑定 / 修改密码 / 登录设备
 *  2) 偏好设置：语言 / 时区 / 隐私 / 通知
 *  3) 显示偏好（保留旧版）：底部导航 / 工具列表 / 收藏列表 / 主题色
 * + 退出登录按钮
 *
 * 弹窗：修改密码 / 语言 / 时区 / 退出登录确认
 * 子页：账号绑定 / 登录设备 / 隐私 / 通知（独立路由）
 */
import React, { useEffect, useState, useMemo } from 'react';
import { navigateTo, navigateBack, navigateReplace } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import AppModal from '../../components/AppModal';
import { useGlobalStore, useUserStore } from '../../store';
import { TOOL_LIST_MODES, FAV_LIST_MODES } from '../../constants';
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  findOptionLabel,
} from '../../constants/options';
import { showToast } from '../../utils/toast';
import type { ToolListMode, FavListMode, TabBarMode } from '../../store/global';
import './index.less';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** 通用 Row 组件 */
const Row: React.FC<{
  label: string;
  value?: string;
  onClick?: () => void;
  arrow?: boolean;
  danger?: boolean;
}> = ({ label, value, onClick, arrow = true, danger = false }) => (
  <button
    type="button"
    className={`settings-row${danger ? ' settings-row--danger' : ''}`}
    onClick={onClick}
    disabled={!onClick}
  >
    <span className="settings-row__label">{label}</span>
    <span className="settings-row__right">
      {value && <span className="settings-row__value">{value}</span>}
      {arrow && onClick && <span className="settings-row__arrow"></span>}
    </span>
  </button>
);

const SettingsPage: React.FC = () => {
  // 显示偏好（保留旧版）
  const {
    tabBarMode, setTabBarMode,
    toolListMode, setToolListMode,
    favListMode, setFavListMode,
    themeColor, setThemeColor,
  } = useGlobalStore();

  // 鉴权 / 资料
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const profileExtra = useUserStore(s => s.profileExtra);
  const bindStatus = useUserStore(s => s.bindStatus);
  const fetchProfile = useUserStore(s => s.fetchProfile);
  const fetchBindStatus = useUserStore(s => s.fetchBindStatus);
  const updateProfile = useUserStore(s => s.updateProfile);
  const changePassword = useUserStore(s => s.changePassword);
  const logout = useUserStore(s => s.logout);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProfile();
      fetchBindStatus();
    }
  }, [isLoggedIn, fetchProfile, fetchBindStatus]);

  // 修改密码弹窗
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // 语言/时区选项弹窗
  const [optionModal, setOptionModal] = useState<null | 'language' | 'timezone'>(null);

  // 退出登录确认
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const bindCount = useMemo(() => {
    if (!bindStatus) return 0;
    return (bindStatus.phone ? 1 : 0) + (bindStatus.email ? 1 : 0) + (bindStatus.wechat?.length || 0);
  }, [bindStatus]);

  /** 是否为"首次设置密码"模式（手机号/微信注册账号尚未设置过密码） */
  const isSetPasswordMode = !!bindStatus && !bindStatus.hasPassword;
  const pwdModalTitle = isSetPasswordMode ? '设置密码' : '修改密码';
  const pwdRowLabel = isSetPasswordMode ? '设置密码' : '修改密码';

  const resetPwdForm = () => {
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
  };

  const handleChangePassword = async () => {
    if (!isSetPasswordMode && !oldPwd) { showToast('请输入原密码', 'error'); return; }
    if (!PASSWORD_REGEX.test(newPwd)) { showToast('新密码至少 8 位，需含大小写字母+数字', 'error'); return; }
    if (!isSetPasswordMode && newPwd === oldPwd) { showToast('新密码不能与原密码相同', 'error'); return; }
    if (newPwd !== confirmPwd) { showToast('两次密码不一致', 'error'); return; }

    setPwdSubmitting(true);
    const res = await changePassword(isSetPasswordMode ? undefined : oldPwd, newPwd);
    setPwdSubmitting(false);
    if (res.success) {
      const successMsg = isSetPasswordMode ? '密码设置成功，请重新登录' : '密码修改成功，请重新登录';
      showToast(successMsg, 'success');
      setPwdModalVisible(false);
      resetPwdForm();
      // 自动登出 + 跳登录
      setTimeout(async () => {
        await logout();
        navigateReplace('/login');
      }, 1200);
    } else {
      showToast(res.message || (isSetPasswordMode ? '设置失败' : '修改失败'), 'error');
    }
  };

  const closePwdModal = () => {
    if (pwdSubmitting) return;
    setPwdModalVisible(false);
    resetPwdForm();
  };

  const handleSelectOption = async (key: 'language' | 'timezone', value: string) => {
    setOptionModal(null);
    const res = await updateProfile({ [key]: value } as any);
    if (res.success) {
      showToast('已保存', 'success');
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  };

  const handleLogoutConfirm = async () => {
    setLogoutConfirm(false);
    await logout();
    showToast('已退出登录', 'success');
    navigateReplace('/');
  };

  return (
    <div className="page-settings">
      <AppHeader title="设置" showBack onBack={() => navigateBack()} />
      <main className="page-settings__content">
        {/* === 账号安全（仅登录态显示） === */}
        {isLoggedIn && (
          <>
            <div className="settings-group-title">账号安全</div>
            <div className="settings-group-card">
              <Row
                label="账号绑定管理"
                value={bindCount > 0 ? `${bindCount} 项已绑` : undefined}
                onClick={() => navigateTo('/settings/binding')}
              />
              <Row
                label={pwdRowLabel}
                onClick={() => setPwdModalVisible(true)}
              />
              <Row
                label="登录设备管理"
                onClick={() => navigateTo('/settings/devices')}
              />
            </div>

            {/* === 偏好设置 === */}
            <div className="settings-group-title">偏好设置</div>
            <div className="settings-group-card">
              <Row
                label="语言"
                value={findOptionLabel(LANGUAGE_OPTIONS, profileExtra?.language || 'zh-CN')}
                onClick={() => setOptionModal('language')}
              />
              <Row
                label="时区"
                value={findOptionLabel(TIMEZONE_OPTIONS, profileExtra?.timezone || 'Asia/Shanghai')}
                onClick={() => setOptionModal('timezone')}
              />
              <Row
                label="隐私设置"
                onClick={() => navigateTo('/settings/privacy')}
              />
              <Row
                label="通知设置"
                onClick={() => navigateTo('/settings/notification')}
              />
            </div>
          </>
        )}

        {/* === 显示偏好（保留旧版，登录与否都显示） === */}
        <div className="settings-group-title">显示偏好</div>
        <section className="page-settings__section">
          <h3 className="page-settings__title">底部导航栏模式</h3>
          <div className="page-settings__options">
            {(['float', 'flat'] as TabBarMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                className={`page-settings__option ${tabBarMode === mode ? 'page-settings__option--active' : ''}`}
                onClick={() => setTabBarMode(mode)}
              >{mode === 'float' ? '悬浮' : '平铺'}</button>
            ))}
          </div>
        </section>

        <section className="page-settings__section">
          <h3 className="page-settings__title">工具列表展示模式</h3>
          <div className="page-settings__options">
            {TOOL_LIST_MODES.map(mode => (
              <button
                key={mode.key}
                type="button"
                className={`page-settings__option ${toolListMode === mode.key ? 'page-settings__option--active' : ''}`}
                onClick={() => setToolListMode(mode.key as ToolListMode)}
              >{mode.name}</button>
            ))}
          </div>
        </section>

        <section className="page-settings__section">
          <h3 className="page-settings__title">收藏列表展示模式</h3>
          <div className="page-settings__options">
            {FAV_LIST_MODES.map(mode => (
              <button
                key={mode.key}
                type="button"
                className={`page-settings__option ${favListMode === mode.key ? 'page-settings__option--active' : ''}`}
                onClick={() => setFavListMode(mode.key as FavListMode)}
              >{mode.name}</button>
            ))}
          </div>
        </section>

        <section className="page-settings__section">
          <h3 className="page-settings__title">主题色</h3>
          <div className="page-settings__colors">
            {['#1677ff', '#52c41a', '#eb2f96', '#fa8c16', '#722ed1', '#13c2c2'].map(color => (
              <button
                key={color}
                type="button"
                className={`page-settings__color ${themeColor === color ? 'page-settings__color--active' : ''}`}
                style={{ background: color }}
                onClick={() => setThemeColor(color)}
                aria-label={`主题色 ${color}`}
              />
            ))}
          </div>
        </section>

        {/* === 退出登录 === */}
        {isLoggedIn && (
          <button
            type="button"
            className="page-settings__logout"
            onClick={() => setLogoutConfirm(true)}
          >退出登录</button>
        )}
      </main>

      {/* 修改/设置密码弹窗 */}
      <AppModal
        visible={pwdModalVisible}
        title={pwdModalTitle}
        contentType="text"
        content={
          <div className="pwd-form">
            {isSetPasswordMode && (
              <div className="pwd-form__tip">
                检测到您尚未设置密码，请设置一个用于账号密码登录的密码。
              </div>
            )}
            {!isSetPasswordMode && (
              <input
                className="pwd-form__input"
                type="password"
                placeholder="原密码"
                value={oldPwd}
                autoComplete="current-password"
                onChange={e => setOldPwd(e.target.value)}
              />
            )}
            <input
              className="pwd-form__input"
              type="password"
              placeholder="新密码（≥8位，含大小写+数字）"
              value={newPwd}
              autoComplete="new-password"
              onChange={e => setNewPwd(e.target.value)}
            />
            <input
              className="pwd-form__input"
              type="password"
              placeholder="确认新密码"
              value={confirmPwd}
              autoComplete="new-password"
              onChange={e => setConfirmPwd(e.target.value)}
            />
            <div className="pwd-form__hint">
              {isSetPasswordMode
                ? '设置成功后会自动退出，请用新密码重新登录'
                : '修改成功后会自动退出，请用新密码重新登录'}
            </div>
          </div>
        }
        confirmText={pwdSubmitting ? '提交中...' : '确认'}
        cancelText="取消"
        showClose={!pwdSubmitting}
        maskClosable={!pwdSubmitting}
        onConfirm={handleChangePassword}
        onCancel={closePwdModal}
        onClose={closePwdModal}
      />

      {/* 语言/时区选项弹窗 */}
      <AppModal
        visible={!!optionModal}
        title={optionModal === 'language' ? '选择语言' : '选择时区'}
        contentType="text"
        content={
          <div className="profile-options">
            {(optionModal === 'language' ? LANGUAGE_OPTIONS : TIMEZONE_OPTIONS).map(opt => {
              const current = optionModal === 'language' ? profileExtra?.language : profileExtra?.timezone;
              const active = current === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`profile-options__item ${active ? 'profile-options__item--active' : ''}`}
                  onClick={() => optionModal && handleSelectOption(optionModal, opt.value)}
                >{opt.label}</button>
              );
            })}
          </div>
        }
        showClose
        confirmText=""
        cancelText="取消"
        onCancel={() => setOptionModal(null)}
        onClose={() => setOptionModal(null)}
      />

      {/* 退出登录确认 */}
      <AppModal
        visible={logoutConfirm}
        title="退出登录"
        contentType="text"
        content="确定要退出登录吗？"
        confirmText="退出"
        cancelText="取消"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirm(false)}
        onClose={() => setLogoutConfirm(false)}
      />
    </div>
  );
};

export default SettingsPage;
