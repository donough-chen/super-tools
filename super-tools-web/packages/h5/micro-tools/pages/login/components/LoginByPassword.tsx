/**
 * 账号密码登录子组件
 * 后端：POST /api/auth/login（username 字段支持 用户名/邮箱/手机号）
 * 安全：5 次失败要求图形验证码（V2 实现），8 次/10 次/15 次锁定（错误码兜底）
 */
import React, { useState } from 'react';
import { useUserStore } from '../../../store';

export interface LoginByPasswordProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

const LoginByPassword: React.FC<LoginByPasswordProps> = ({ onSuccess, onError }) => {
  const { loginByPassword, loading } = useUserStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!username.trim()) { onError('请输入账号（用户名/邮箱/手机号）'); return; }
    if (!password) { onError('请输入密码'); return; }
    const result = await loginByPassword({ username: username.trim(), password });
    if (result.success) onSuccess();
    else onError(result.message);
  };

  return (
    <div
      className="login-form login-form--password"
      onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
    >
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="text"
          placeholder="账号 / 邮箱 / 手机号"
          value={username}
          maxLength={100}
          autoComplete="username"
          onChange={e => setUsername(e.target.value)}
        />
      </div>
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="password"
          placeholder="请输入密码"
          value={password}
          autoComplete="current-password"
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="login-form__submit"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </div>
  );
};

export default LoginByPassword;
