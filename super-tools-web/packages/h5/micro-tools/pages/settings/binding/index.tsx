/**
 * 账号绑定管理 /settings/binding
 *
 * 两区分组：已绑定 / 未绑定
 * 操作：绑定手机/邮箱（弹窗 + SendCodeButton type=bind）、解绑（二次确认）
 * 安全：剩余登录方式 ≤ 1 时禁用解绑（前端预判 + 后端 100503 兜底）
 * 微信：V1 显示"敬请期待"按钮 disabled
 */
import React, { useEffect, useState, useMemo } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import { SendCodeButton } from '../../../components';
import { useUserStore } from '../../../store';
import { showToast } from '../../../utils/toast';
import './index.less';

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 简单脱敏 */
const maskPhone = (p: string) => p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p;
const maskEmail = (e: string) => {
  const [name, domain] = e.split('@');
  if (!domain) return e;
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

type BindType = 'phone' | 'email';

const BindingPage: React.FC = () => {
  const { bindStatus, fetchBindStatus, bindPhone, bindEmail, unbind } = useUserStore();

  // 绑定弹窗
  const [bindModal, setBindModal] = useState<null | BindType>(null);
  const [bindTarget, setBindTarget] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 解绑确认
  const [unbindConfirm, setUnbindConfirm] = useState<null | { type: 'phone' | 'email' | 'wechat'; platform?: string; label: string }>(null);

  useEffect(() => { fetchBindStatus(); }, [fetchBindStatus]);

  const totalLoginMethods = useMemo(() => {
    if (!bindStatus) return 0;
    return (bindStatus.hasPassword ? 1 : 0) +
      (bindStatus.phone ? 1 : 0) +
      (bindStatus.email ? 1 : 0) +
      (bindStatus.wechat?.length || 0);
  }, [bindStatus]);
  const canUnbind = totalLoginMethods > 1;

  const openBindModal = (type: BindType) => {
    setBindModal(type);
    setBindTarget('');
    setBindCode('');
  };
  const closeBindModal = () => {
    if (submitting) return;
    setBindModal(null);
  };

  const validateTarget = (v: string) => {
    if (bindModal === 'phone') {
      if (!v) return '请输入手机号';
      if (!PHONE_REGEX.test(v)) return '手机号格式不正确';
    } else {
      if (!v) return '请输入邮箱';
      if (!EMAIL_REGEX.test(v)) return '邮箱格式不正确';
    }
    return null;
  };

  const handleBindConfirm = async () => {
    const err = validateTarget(bindTarget);
    if (err) { showToast(err, 'error'); return; }
    if (bindCode.length !== 6) { showToast('请输入 6 位验证码', 'error'); return; }
    setSubmitting(true);
    const res = bindModal === 'phone'
      ? await bindPhone(bindTarget, bindCode)
      : await bindEmail(bindTarget, bindCode);
    setSubmitting(false);
    if (res.success) {
      showToast(res.message || '绑定成功', 'success');
      setBindModal(null);
    } else {
      showToast(res.message || '绑定失败', 'error');
    }
  };

  const handleUnbindConfirm = async () => {
    if (!unbindConfirm) return;
    const res = await unbind(unbindConfirm.type, unbindConfirm.platform);
    if (res.success) {
      showToast(res.message || '解绑成功', 'success');
    } else {
      showToast(res.message || '解绑失败', 'error');
    }
    setUnbindConfirm(null);
  };

  const wechatList = bindStatus?.wechat || [];

  return (
    <div className="page-binding">
      <AppHeader title="账号绑定管理" showBack onBack={() => navigateBack()} />
      <main className="page-binding__content">
        {/* 已绑定区 */}
        <div className="binding-section">
          <div className="binding-section__title">已绑定</div>
          <div className="binding-section__card">
            {bindStatus?.phone && (
              <div className="binding-row">
                <span className="binding-row__icon">📱</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">手机号</div>
                  <div className="binding-row__sub">{maskPhone(bindStatus.phone)}</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action binding-row__action--danger"
                  disabled={!canUnbind}
                  onClick={() => setUnbindConfirm({ type: 'phone', label: maskPhone(bindStatus.phone!) })}
                >解绑</button>
              </div>
            )}
            {bindStatus?.email && (
              <div className="binding-row">
                <span className="binding-row__icon">📧</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">邮箱</div>
                  <div className="binding-row__sub">{maskEmail(bindStatus.email)}</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action binding-row__action--danger"
                  disabled={!canUnbind}
                  onClick={() => setUnbindConfirm({ type: 'email', label: maskEmail(bindStatus.email!) })}
                >解绑</button>
              </div>
            )}
            {wechatList.map(w => (
              <div className="binding-row" key={w.platform}>
                <span className="binding-row__icon">💬</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">微信 ({w.platform.replace('wechat_', '')})</div>
                  <div className="binding-row__sub">{w.nickname || '微信用户'}</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action binding-row__action--danger"
                  disabled={!canUnbind}
                  onClick={() => setUnbindConfirm({ type: 'wechat', platform: w.platform, label: w.nickname || '微信用户' })}
                >解绑</button>
              </div>
            ))}
            {bindStatus?.hasPassword && (
              <div className="binding-row">
                <span className="binding-row__icon">🔑</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">登录密码</div>
                  <div className="binding-row__sub">已设置</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action"
                  onClick={() => showToast('请到「设置 → 修改密码」操作', 'info')}
                >修改</button>
              </div>
            )}
            {bindStatus && !bindStatus.phone && !bindStatus.email && wechatList.length === 0 && !bindStatus.hasPassword && (
              <div className="binding-empty">尚未绑定任何登录方式</div>
            )}
          </div>
        </div>

        {/* 未绑定区 */}
        <div className="binding-section">
          <div className="binding-section__title">未绑定</div>
          <div className="binding-section__card">
            {!bindStatus?.phone && (
              <div className="binding-row">
                <span className="binding-row__icon">📱</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">手机号</div>
                  <div className="binding-row__sub">未绑定</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action binding-row__action--primary"
                  onClick={() => openBindModal('phone')}
                >立即绑定</button>
              </div>
            )}
            {!bindStatus?.email && (
              <div className="binding-row">
                <span className="binding-row__icon">📧</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">邮箱</div>
                  <div className="binding-row__sub">未绑定</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action binding-row__action--primary"
                  onClick={() => openBindModal('email')}
                >立即绑定</button>
              </div>
            )}
            {wechatList.length === 0 && (
              <div className="binding-row">
                <span className="binding-row__icon">💬</span>
                <div className="binding-row__info">
                  <div className="binding-row__name">微信</div>
                  <div className="binding-row__sub">未绑定</div>
                </div>
                <button
                  type="button"
                  className="binding-row__action"
                  disabled
                >敬请期待</button>
              </div>
            )}
          </div>
        </div>

        <div className="binding-tip">💡 至少保留一种登录方式</div>
      </main>

      {/* 绑定弹窗 */}
      <AppModal
        visible={!!bindModal}
        title={bindModal === 'phone' ? '绑定手机号' : '绑定邮箱'}
        contentType="text"
        content={
          <div className="binding-form">
            <input
              className="binding-form__input"
              type={bindModal === 'phone' ? 'tel' : 'email'}
              placeholder={bindModal === 'phone' ? '请输入手机号' : '请输入邮箱'}
              value={bindTarget}
              maxLength={bindModal === 'phone' ? 11 : 100}
              onChange={e => {
                const v = bindModal === 'phone'
                  ? e.target.value.replace(/\D/g, '').slice(0, 11)
                  : e.target.value;
                setBindTarget(v);
              }}
            />
            <div className="binding-form__row">
              <input
                className="binding-form__input binding-form__input--code"
                type="tel"
                placeholder="6 位验证码"
                value={bindCode}
                maxLength={6}
                onChange={e => setBindCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <SendCodeButton
                target={bindTarget}
                type="bind"
                validator={validateTarget}
                onError={(m) => showToast(m, 'error')}
                onSuccess={() => showToast('验证码已发送', 'success')}
              />
            </div>
          </div>
        }
        confirmText={submitting ? '提交中...' : '确认绑定'}
        cancelText="取消"
        showClose={!submitting}
        maskClosable={!submitting}
        onConfirm={handleBindConfirm}
        onCancel={closeBindModal}
        onClose={closeBindModal}
      />

      {/* 解绑确认 */}
      <AppModal
        visible={!!unbindConfirm}
        title="确认解绑"
        contentType="text"
        content={`确定要解绑 ${unbindConfirm?.label} 吗？解绑后将无法用此方式登录。`}
        confirmText="确认解绑"
        cancelText="取消"
        onConfirm={handleUnbindConfirm}
        onCancel={() => setUnbindConfirm(null)}
        onClose={() => setUnbindConfirm(null)}
      />
    </div>
  );
};

export default BindingPage;
