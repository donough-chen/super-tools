/**
 * 隐私设置 /settings/privacy
 *
 * 3 个开关：showPhone / showEmail / showOnlineStatus
 * 实时保存：开关变更后 500ms 防抖合并 → PUT /api/users/profile { privacySettings }
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import Switch from '../../../components/Switch';
import { useUserStore } from '../../../store';
import { showToast } from '../../../utils/toast';
import type { PrivacySettings } from '../../../types/auth';
import './index.less';

const DEFAULTS: Required<PrivacySettings> = {
  showPhone: false,
  showEmail: false,
  showOnlineStatus: true,
};

const PrivacyPage: React.FC = () => {
  const profileExtra = useUserStore(s => s.profileExtra);
  const fetchProfileExtra = useUserStore(s => s.fetchProfileExtra);
  const updateProfile = useUserStore(s => s.updateProfile);

  const [settings, setSettings] = useState<Required<PrivacySettings>>(DEFAULTS);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  useEffect(() => { fetchProfileExtra(); }, [fetchProfileExtra]);

  // store → 本地（仅在用户尚未交互时）
  useEffect(() => {
    if (!profileExtra) return;
    if (syncedRef.current) return;
    setSettings({ ...DEFAULTS, ...(profileExtra.privacySettings || {}) });
    syncedRef.current = true;
  }, [profileExtra]);

  const persist = useCallback(async (next: Required<PrivacySettings>) => {
    const res = await updateProfile({ privacySettings: next });
    if (!res.success) {
      showToast(res.message || '保存失败', 'error');
    }
  }, [updateProfile]);

  const handleChange = (key: keyof PrivacySettings, val: boolean) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => persist(next), 500);
  };

  return (
    <div className="page-privacy">
      <AppHeader title="隐私设置" showBack onBack={() => navigateBack()} />
      <main className="page-privacy__content">
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">显示我的手机号</div>
              <div className="settings-row__sub">其他用户可查看您的手机号</div>
            </div>
            <Switch
              checked={settings.showPhone}
              onChange={v => handleChange('showPhone', v)}
              ariaLabel="显示我的手机号"
            />
          </div>
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">显示我的邮箱</div>
              <div className="settings-row__sub">其他用户可查看您的邮箱</div>
            </div>
            <Switch
              checked={settings.showEmail}
              onChange={v => handleChange('showEmail', v)}
              ariaLabel="显示我的邮箱"
            />
          </div>
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">在线状态可见</div>
              <div className="settings-row__sub">其他用户可看到您是否在线</div>
            </div>
            <Switch
              checked={settings.showOnlineStatus}
              onChange={v => handleChange('showOnlineStatus', v)}
              ariaLabel="在线状态可见"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
