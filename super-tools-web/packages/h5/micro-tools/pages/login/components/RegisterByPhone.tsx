/**
 * 手机号注册子组件
 * 后端：POST /api/auth/phone-login（注册场景下后端会自动创建用户）
 * 文案与按钮上的 type 与 LoginByPhone 不同，逻辑一致
 */
import React, { useState } from 'react';
import { useUserStore } from '../../../store';
import { SendCodeButton } from '../../../components';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export interface RegisterByPhoneProps {
  onSuccess: (result: { isNewUser?: boolean }) => void;
  onError: (msg: string) => void;
}

const RegisterByPhone: React.FC<RegisterByPhoneProps> = ({ onSuccess, onError }) => {
  const { loginByPhone, loading } = useUserStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const validatePhone = (v: string) =>
    !v ? '请输入手机号' : (!PHONE_REGEX.test(v) ? '手机号格式不正确' : null);

  const handleSubmit = async () => {
    const err = validatePhone(phone);
    if (err) { onError(err); return; }
    if (code.length !== 6) { onError('请输入 6 位验证码'); return; }
    const result = await loginByPhone({ phone, code });
    if (result.success) onSuccess({ isNewUser: result.isNewUser });
    else onError(result.message);
  };

  return (
    <div className="login-form login-form--phone">
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="tel"
          placeholder="请输入手机号"
          value={phone}
          maxLength={11}
          autoComplete="tel"
          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
        />
      </div>
      <div className="login-form__field login-form__field--with-action">
        <input
          className="login-form__input"
          type="tel"
          placeholder="6 位验证码"
          value={code}
          maxLength={6}
          autoComplete="one-time-code"
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <SendCodeButton
          target={phone}
          type="register"
          validator={validatePhone}
          onError={onError}
        />
      </div>
      <button
        type="button"
        className="login-form__submit"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? '注册中...' : '注册并登录'}
      </button>
    </div>
  );
};

export default RegisterByPhone;
