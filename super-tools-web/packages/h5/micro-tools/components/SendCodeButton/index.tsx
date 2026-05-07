/**
 * 验证码发送按钮
 * 含倒计时（基于 useSendCodeStore 全局持久化，刷新/切页保留）
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useSendCodeStore } from '../../store/sendCode';
import { sendCode } from '../../service/auth';
import { mapErrorCode } from '../../utils/errorMap';
import './SendCodeButton.less';

export interface SendCodeButtonProps {
  /** 目标（手机号/邮箱） */
  target: string;
  /** 验证码类型 */
  type: 'login' | 'register' | 'reset' | 'bind';
  /** 自定义校验函数，返回错误信息或 null */
  validator?: (target: string) => string | null;
  /** 倒计时秒数，默认 60 */
  countdown?: number;
  /** 发送成功回调 */
  onSuccess?: () => void;
  /** 发送失败回调（接收提示文案） */
  onError?: (msg: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义 idle 态文案 */
  idleText?: string;
}

const SendCodeButton: React.FC<SendCodeButtonProps> = ({
  target,
  type,
  validator,
  countdown = 60,
  onSuccess,
  onError,
  className = '',
  idleText = '获取验证码',
}) => {
  const key = `${target}:${type}`;
  const startCountdown = useSendCodeStore(s => s.startCountdown);
  const endsAt = useSendCodeStore(s => s.countdownMap[key] || 0);

  // 通过 endsAt 派生 remaining，并按 1s 节奏重渲染（zustand 不感知时间流逝）
  const computeRemaining = () => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const [remaining, setRemaining] = useState<number>(computeRemaining());

  useEffect(() => {
    setRemaining(computeRemaining());
    if (endsAt <= Date.now()) return;
    const t = setInterval(() => {
      const r = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  const [sending, setSending] = useState(false);

  const handleClick = useCallback(async () => {
    if (sending || remaining > 0) return;
    if (!target?.trim()) {
      onError?.('请先输入号码');
      return;
    }
    if (validator) {
      const err = validator(target);
      if (err) { onError?.(err); return; }
    }
    setSending(true);
    try {
      const res: any = await sendCode(target, type);
      if (res?.code === 200) {
        startCountdown(key, countdown);
        onSuccess?.();
      } else {
        onError?.(mapErrorCode(res?.code, res?.message || '发送失败'));
      }
    } catch (e: any) {
      const code = e?.data?.code || e?.response?.status;
      onError?.(mapErrorCode(code, e?.data?.message || '发送失败，请稍后重试'));
    } finally {
      setSending(false);
    }
  }, [target, type, sending, remaining, validator, countdown, key, startCountdown, onSuccess, onError]);

  const disabled = sending || remaining > 0 || !target?.trim();
  let label = idleText;
  if (sending) label = '发送中...';
  else if (remaining > 0) label = `${remaining}s 后重发`;

  return (
    <button
      type="button"
      className={`send-code-btn ${disabled ? 'send-code-btn--disabled' : ''} ${className}`}
      disabled={disabled}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

export default SendCodeButton;
