/**
 * 登录设备管理 /settings/devices
 *
 * Tab 1 - 设备：当前账号注册的所有设备，支持推送开关、移除
 * Tab 2 - 会话：当前账号所有活跃登录会话，支持踢下线
 *
 * 「本机」标记：
 *   - 设备 Tab：device.deviceId === useDeviceInfo().deviceId
 *   - 会话 Tab：session.sessionId === useUserStore.currentSessionId
 *
 * 安全：本机会话不显示「踢下线」按钮（防止误踢自己）
 */
import React, { useEffect, useState } from 'react';
import { useHistory } from 'umi';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import AppTabs from '../../../components/AppTabs';
import Switch from '../../../components/Switch';
import { useUserStore, useDeviceStore } from '../../../store';
import { useDeviceInfo } from '../../../hooks/useDeviceInfo';
import { showToast } from '../../../utils/toast';
import type { DeviceInfo, SessionInfo } from '../../../types/auth';
import './index.less';

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}天前`;
  return d.toLocaleDateString();
};

const deviceIcon = (type: string): string => {
  switch (type) {
    case 'ios': return '🍎';
    case 'android': return '🤖';
    case 'h5': return '🌐';
    case 'web': return '💻';
    case 'miniprogram': return '📱';
    default: return '📱';
  }
};

const DevicesPage: React.FC = () => {
  const history = useHistory();
  const currentSessionId = useUserStore(s => s.currentSessionId);
  const { devices, sessions, fetchDevices, fetchSessions, removeDevice, updateDevicePush, kickSession } = useDeviceStore();
  const currentDevice = useDeviceInfo();

  const [tabIndex, setTabIndex] = useState(0);
  const [removeConfirm, setRemoveConfirm] = useState<DeviceInfo | null>(null);
  const [kickConfirm, setKickConfirm] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetchDevices();
    fetchSessions();
  }, [fetchDevices, fetchSessions]);

  const handleTogglePush = async (d: DeviceInfo) => {
    const res = await updateDevicePush(d.deviceId, !d.pushEnabled);
    if (!res.success) showToast(res.message, 'error');
  };

  const handleRemoveConfirm = async () => {
    if (!removeConfirm) return;
    const target = removeConfirm;
    setRemoveConfirm(null);
    const res = await removeDevice(target.deviceId);
    showToast(res.message || (res.success ? '设备已移除' : '移除失败'), res.success ? 'success' : 'error');
  };

  const handleKickConfirm = async () => {
    if (!kickConfirm) return;
    const target = kickConfirm;
    setKickConfirm(null);
    const res = await kickSession(target.sessionId);
    showToast(res.message || (res.success ? '会话已终止' : '操作失败'), res.success ? 'success' : 'error');
  };

  const tabs = [
    { key: 'devices', name: `设备 (${devices.length})` },
    { key: 'sessions', name: `会话 (${sessions.length})` },
  ];

  return (
    <div className="page-devices">
      <AppHeader title="登录设备" showBack onBack={() => history.goBack()} />
      <main className="page-devices__content">
        <AppTabs
          mode="double"
          tabs={tabs}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />

        {tabIndex === 0 ? (
          <div className="device-list">
            {devices.length === 0 && (
              <div className="device-empty">暂无登录设备</div>
            )}
            {devices.map(d => {
              const isCurrent = d.deviceId === currentDevice.deviceId;
              return (
                <div key={d.deviceId} className="device-card">
                  <div className="device-card__head">
                    <span className="device-card__icon">{deviceIcon(d.deviceType)}</span>
                    <div className="device-card__title">
                      {d.deviceName || d.deviceType}
                      {isCurrent && <span className="device-card__badge">本机</span>}
                    </div>
                  </div>
                  <div className="device-card__sub">
                    {d.osVersion || d.deviceType}
                    {d.appVersion && ` · v${d.appVersion}`}
                    {d.lastActiveAt && ` · 上次活跃 ${formatTime(d.lastActiveAt)}`}
                  </div>
                  <div className="device-card__actions">
                    <div className="device-card__push">
                      <span>推送</span>
                      <Switch
                        checked={d.pushEnabled === 1}
                        onChange={() => handleTogglePush(d)}
                        ariaLabel="推送开关"
                      />
                    </div>
                    <button
                      type="button"
                      className="device-card__remove"
                      onClick={() => setRemoveConfirm(d)}
                    >移除</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="device-list">
            {sessions.length === 0 && (
              <div className="device-empty">暂无活跃会话</div>
            )}
            {sessions.map(s => {
              const isCurrent = s.sessionId === currentSessionId;
              return (
                <div key={s.sessionId} className="device-card">
                  <div className="device-card__head">
                    <span className="device-card__icon">{deviceIcon(s.platform)}</span>
                    <div className="device-card__title">
                      {s.platform}
                      {s.location && ` · ${s.location}`}
                      {isCurrent && <span className="device-card__badge">本机</span>}
                    </div>
                  </div>
                  <div className="device-card__sub">
                    {s.ip || '-'} · {formatTime(s.createdAt)}
                  </div>
                  {!isCurrent && (
                    <div className="device-card__actions">
                      <button
                        type="button"
                        className="device-card__remove"
                        onClick={() => setKickConfirm(s)}
                      >踢下线</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 移除设备确认 */}
      <AppModal
        visible={!!removeConfirm}
        title="移除设备"
        contentType="text"
        content={`确定移除设备「${removeConfirm?.deviceName || ''}」？该设备将无法再接收推送，但此次操作不会终止其登录会话。`}
        confirmText="确认移除"
        cancelText="取消"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveConfirm(null)}
        onClose={() => setRemoveConfirm(null)}
      />

      {/* 踢下线确认 */}
      <AppModal
        visible={!!kickConfirm}
        title="终止会话"
        contentType="text"
        content={`确定踢下线「${kickConfirm?.platform || ''}${kickConfirm?.location ? ' · ' + kickConfirm.location : ''}」吗？该会话将立即失效。`}
        confirmText="确认踢下线"
        cancelText="取消"
        onConfirm={handleKickConfirm}
        onCancel={() => setKickConfirm(null)}
        onClose={() => setKickConfirm(null)}
      />
    </div>
  );
};

export default DevicesPage;
