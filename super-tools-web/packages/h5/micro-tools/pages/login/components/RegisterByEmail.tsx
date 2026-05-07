/**
 * 邮箱+密码注册子组件
 * 后端：POST /api/auth/register
 * 校验：用户名 3-50 字（字母/数字/下划线）、邮箱格式、密码 ≥8 位含大小写+数字、两次一致
 */
import React, { useState } from 'react';
import { useUserStore } from '../../../store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,50}$/;

export interface RegisterByEmailProps {
  onSuccess: (username: string) => void;
  onError: (msg: string) => void;
}

const RegisterByEmail: React.FC<RegisterByEmailProps> = ({ onSuccess, onError }) => {
  const { registerByEmail, loading } = useUserStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');

  const handleSubmit = async () => {
    if (!USERNAME_REGEX.test(username.trim())) { onError('用户名 3-50 字符，仅支持字母/数字/下划线'); return; }
    if (!EMAIL_REGEX.test(email.trim())) { onError('邮箱格式不正确'); return; }
    if (!PASSWORD_REGEX.test(password)) { onError('密码至少 8 位，需包含大小写字母和数字'); return; }
    if (password !== confirmPassword) { onError('两次密码不一致'); return; }

    const result = await registerByEmail({
      username: username.trim(),
      email: email.trim(),
      password,
      nickname: nickname.trim() || undefined,
    });
    if (result.success) onSuccess(username.trim());
    else onError(result.message);
  };

  return (
    <div className="login-form login-form--email-register">
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="text"
          placeholder="用户名（3-50 字符）"
          value={username}
          maxLength={50}
          autoComplete="username"
          onChange={e => setUsername(e.target.value)}
        />
      </div>
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="email"
          placeholder="邮箱"
          value={email}
          maxLength={100}
          autoComplete="email"
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="text"
          placeholder="昵称（可选）"
          value={nickname}
          maxLength={50}
          onChange={e => setNickname(e.target.value)}
        />
      </div>
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="password"
          placeholder="密码（≥8位，含大小写+数字）"
          value={password}
          autoComplete="new-password"
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      <div className="login-form__field">
        <input
          className="login-form__input"
          type="password"
          placeholder="再次输入密码"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={e => setConfirmPassword(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="login-form__submit"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? '注册中...' : '注册'}
      </button>
    </div>
  );
};

export default RegisterByEmail;
