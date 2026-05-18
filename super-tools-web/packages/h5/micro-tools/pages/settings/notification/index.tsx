/**
 * 通知设置 /settings/notification
 *
 * 三区分组：
 *  1) 通知渠道：push / sms / email → user_profiles.notificationSettings（500ms 防抖）
 *  2) 当前设备推送：单独写入 user_devices.pushEnabled（针对 useDeviceInfo().deviceId）
 *  3) 分类偏好：使用 notification SDK 管理每个通知类型的订阅设置
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import Switch from '../../../components/Switch';
import { useUserStore, useDeviceStore, notificationSdk } from '../../../store';
import { useDeviceInfo } from '../../../hooks/useDeviceInfo';
import { showToast } from '../../../utils/toast';
import { usePreferences } from '../../../../../shared/notification';
import type { NotificationSettings } from '../../../types/auth';
import './index.less';

const DEFAULTS: Required<NotificationSettings> = {
  push: true,
  sms: true,
  email: true,
};

/** 渠道显示名 */
const CHANNEL_LABELS: Record<string, string> = {
  in_app: '站内信',
  email: '邮件',
  sms: '短信',
};

const NotificationPage: React.FC = () => {
  const profileExtra = useUserStore(s => s.profileExtra);
  const fetchProfileExtra = useUserStore(s => s.fetchProfileExtra);
  const updateProfile = useUserStore(s => s.updateProfile);

  const { devices, fetchDevices, updateDevicePush } = useDeviceStore();
  const currentDevice = useDeviceInfo();

  const [settings, setSettings] = useState<Required<NotificationSettings>>(DEFAULTS);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  // SDK 偏好设置 hook
  const { list: preferences, loading: prefLoading, saving: prefSaving, update: updatePreference } = usePreferences({
    fetchAll: () => notificationSdk.preferences.list(),
    saveOne: (input) => notificationSdk.preferences.upsert(input),
  });

  useEffect(() => {
    fetchProfileExtra();
    fetchDevices();
  }, [fetchProfileExtra, fetchDevices]);

  useEffect(() => {
    if (!profileExtra) return;
    if (syncedRef.current) return;
    setSettings({ ...DEFAULTS, ...(profileExtra.notificationSettings || {}) });
    syncedRef.current = true;
  }, [profileExtra]);

  const persistChannel = useCallback(async (next: Required<NotificationSettings>) => {
    const res = await updateProfile({ notificationSettings: next });
    if (!res.success) showToast(res.message || '保存失败', 'error');
  }, [updateProfile]);

  const handleChannelChange = (key: keyof NotificationSettings, val: boolean) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => persistChannel(next), 500);
  };

  // 当前设备推送状态：从 devices 列表中查找当前 deviceId
  const currentDeviceRecord = useMemo(
    () => devices.find(d => d.deviceId === currentDevice.deviceId),
    [devices, currentDevice.deviceId],
  );
  const currentDevicePush = currentDeviceRecord ? currentDeviceRecord.pushEnabled === 1 : true;

  const handleDevicePushChange = async (val: boolean) => {
    if (!currentDeviceRecord) {
      showToast('当前设备未注册，请刷新页面后重试', 'error');
      return;
    }
    const res = await updateDevicePush(currentDevice.deviceId, val);
    if (!res.success) showToast(res.message || '更新失败', 'error');
  };

  // 将偏好按 typeId 分组
  const groupedPreferences = useMemo(() => {
    const groups: Record<number, {
      typeId: number;
      typeName: string;
      channels: { channel: string; isSubscribed: boolean }[];
    }> = {};
    for (const p of preferences) {
      if (!groups[p.typeId]) {
        groups[p.typeId] = {
          typeId: p.typeId,
          typeName: p.typeName,
          channels: [],
        };
      }
      groups[p.typeId].channels.push({
        channel: p.channel,
        isSubscribed: p.isSubscribed,
      });
    }
    return Object.values(groups);
  }, [preferences]);

  const handlePreferenceChange = async (typeId: number, channel: string, isSubscribed: boolean) => {
    try {
      await updatePreference({ typeId, channel, isSubscribed });
    } catch {
      showToast('更新失败', 'error');
    }
  };

  return (
    <div className="page-privacy">
      <AppHeader title="通知设置" showBack onBack={() => navigateBack()} />
      <main className="page-privacy__content">
        {/* 通知渠道 */}
        <div className="settings-section-title">通知渠道</div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">推送通知</div>
              <div className="settings-row__sub">系统推送（移动端 / 浏览器）</div>
            </div>
            <Switch checked={settings.push} onChange={v => handleChannelChange('push', v)} ariaLabel="推送通知" />
          </div>
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">短信通知</div>
              <div className="settings-row__sub">重要事件与安全提醒</div>
            </div>
            <Switch checked={settings.sms} onChange={v => handleChannelChange('sms', v)} ariaLabel="短信通知" />
          </div>
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">邮件通知</div>
              <div className="settings-row__sub">订阅摘要与通知</div>
            </div>
            <Switch checked={settings.email} onChange={v => handleChannelChange('email', v)} ariaLabel="邮件通知" />
          </div>
        </div>

        {/* 当前设备推送 */}
        <div className="settings-section-title">当前设备推送</div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="settings-row__name">当前设备推送</div>
              <div className="settings-row__sub">关闭后此设备将不再收到推送</div>
            </div>
            <Switch
              checked={currentDevicePush}
              onChange={handleDevicePushChange}
              disabled={!currentDeviceRecord}
              ariaLabel="当前设备推送"
            />
          </div>
        </div>

        {/* 分类偏好设置 */}
        <div className="settings-section-title">
          分类订阅
          {prefLoading && <span className="settings-section-hint">加载中...</span>}
        </div>
        {groupedPreferences.length === 0 && !prefLoading && (
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row__main">
                <div className="settings-row__sub">暂无可配置的通知类型</div>
              </div>
            </div>
          </div>
        )}
        {groupedPreferences.map((group) => (
          <div className="settings-card" key={group.typeId}>
            <div className="settings-row settings-row--group-title">
              <div className="settings-row__main">
                <div className="settings-row__name">{group.typeName}</div>
              </div>
            </div>
            {group.channels.map((ch) => (
              <div className="settings-row" key={`${group.typeId}-${ch.channel}`}>
                <div className="settings-row__main">
                  <div className="settings-row__sub">{CHANNEL_LABELS[ch.channel] || ch.channel}</div>
                </div>
                <Switch
                  checked={ch.isSubscribed}
                  onChange={(val) => handlePreferenceChange(group.typeId, ch.channel, val)}
                  disabled={prefSaving}
                  ariaLabel={`${group.typeName} ${CHANNEL_LABELS[ch.channel] || ch.channel}`}
                />
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
};

export default NotificationPage;
