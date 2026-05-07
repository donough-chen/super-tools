/**
 * 登录注册页（重构）
 *
 * 结构：
 * - 顶部 Tab：登录 / 注册
 * - 子模式 Tab：
 *     登录：📱 手机号 / 🔑 账号密码
 *     注册：📱 手机号 / 📧 邮箱
 * - 子表单：4 个独立组件（LoginByPhone/LoginByPassword/RegisterByPhone/RegisterByEmail）
 * - 协议勾选 + 错误/成功消息提示
 * - URL 参数：?mode=login|register&type=phone|password|email&redirect=/path
 * - 登录成功跳转：isNewUser 走 /profile?from=register；否则 redirect → goBack
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useHistory, useLocation } from 'umi';
import AppHeader from '../../components/AppHeader';
import LoginByPhone from './components/LoginByPhone';
import LoginByPassword from './components/LoginByPassword';
import RegisterByPhone from './components/RegisterByPhone';
import RegisterByEmail from './components/RegisterByEmail';
import './index.less';

type Mode = 'login' | 'register';
type LoginType = 'phone' | 'password';
type RegisterType = 'phone' | 'email';

/** 仅允许内部相对路径，防止开放重定向 */
const isSafeRedirect = (path?: string | null): boolean =>
  !!path && path.startsWith('/') && !path.includes('://');

const LoginPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const query = (location as any).query || {};
  const initialMode: Mode = query.mode === 'register' ? 'register' : 'login';
  const initialType = query.type || 'phone';
  const redirect: string | null = isSafeRedirect(query.redirect) ? query.redirect : null;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginType, setLoginType] = useState<LoginType>(
    initialMode === 'login' && initialType === 'password' ? 'password' : 'phone',
  );
  const [registerType, setRegisterType] = useState<RegisterType>(
    initialMode === 'register' && initialType === 'email' ? 'email' : 'phone',
  );
  const [agreed, setAgreed] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isLogin = mode === 'login';

  const showMsg = useCallback((type: 'error' | 'success', text: string) => {
    setMessage({ type, text });
    if (type === 'success') setTimeout(() => setMessage(null), 2000);
  }, []);

  const guardAgreement = useCallback((): boolean => {
    if (!agreed) {
      showMsg('error', '请先阅读并同意《用户协议》');
      return false;
    }
    return true;
  }, [agreed, showMsg]);

  const onLoginSuccess = useCallback((extra?: { isNewUser?: boolean }) => {
    if (extra?.isNewUser) {
      showMsg('success', '欢迎加入 Super Tools');
      setTimeout(() => history.replace('/profile?from=register'), 600);
    } else if (redirect) {
      history.replace(redirect);
    } else {
      history.goBack();
    }
  }, [history, redirect, showMsg]);

  const onRegisterPhoneSuccess = useCallback(() => {
    showMsg('success', '注册成功，欢迎加入');
    setTimeout(() => history.replace('/profile?from=register'), 600);
  }, [history, showMsg]);

  const onRegisterEmailSuccess = useCallback(() => {
    showMsg('success', '注册成功，请登录');
    setTimeout(() => {
      setMode('login');
      setLoginType('password');
      setMessage(null);
    }, 1200);
  }, [showMsg]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setMessage(null);
    if (newMode === 'login') setLoginType('phone');
    else setRegisterType('phone');
  };

  const formNode = useMemo(() => {
    const onErr = (m: string) => showMsg('error', m);
    if (isLogin) {
      return loginType === 'phone' ? (
        <LoginByPhone
          onSuccess={(r) => { if (guardAgreement()) onLoginSuccess(r); }}
          onError={onErr}
        />
      ) : (
        <LoginByPassword
          onSuccess={() => { if (guardAgreement()) onLoginSuccess(); }}
          onError={onErr}
        />
      );
    }
    return registerType === 'phone' ? (
      <RegisterByPhone
        onSuccess={() => { if (guardAgreement()) onRegisterPhoneSuccess(); }}
        onError={onErr}
      />
    ) : (
      <RegisterByEmail
        onSuccess={() => { if (guardAgreement()) onRegisterEmailSuccess(); }}
        onError={onErr}
      />
    );
  }, [isLogin, loginType, registerType, guardAgreement, onLoginSuccess, onRegisterPhoneSuccess, onRegisterEmailSuccess, showMsg]);

  return (
    <div className="page-login">
      <AppHeader title={isLogin ? '登录' : '注册'} showBack onBack={() => history.goBack()} />
      <main className="page-login__content">
        <div className="page-login__logo">
          <div className="page-login__logo-icon">S</div>
          <div className="page-login__logo-text">Super Tools</div>
        </div>

        {/* 顶级 Tab：登录 / 注册 */}
        <div className="page-login__tabs">
          <button
            type="button"
            className={`page-login__tab ${isLogin ? 'page-login__tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >登录</button>
          <button
            type="button"
            className={`page-login__tab ${!isLogin ? 'page-login__tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >注册</button>
        </div>

        {/* 子模式 Tab */}
        <div className="page-login__subtabs">
          {isLogin ? (
            <>
              <button
                type="button"
                className={`page-login__subtab ${loginType === 'phone' ? 'page-login__subtab--active' : ''}`}
                onClick={() => { setLoginType('phone'); setMessage(null); }}
              >📱 手机号</button>
              <button
                type="button"
                className={`page-login__subtab ${loginType === 'password' ? 'page-login__subtab--active' : ''}`}
                onClick={() => { setLoginType('password'); setMessage(null); }}
              >🔑 账号密码</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`page-login__subtab ${registerType === 'phone' ? 'page-login__subtab--active' : ''}`}
                onClick={() => { setRegisterType('phone'); setMessage(null); }}
              >📱 手机号</button>
              <button
                type="button"
                className={`page-login__subtab ${registerType === 'email' ? 'page-login__subtab--active' : ''}`}
                onClick={() => { setRegisterType('email'); setMessage(null); }}
              >📧 邮箱</button>
            </>
          )}
        </div>

        {/* 表单容器 */}
        <div className="page-login__form-wrapper">
          {formNode}
          <label className="page-login__agreement">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <span>我已阅读并同意《用户协议》和《隐私政策》</span>
          </label>
          {message && (
            <div className={`page-login__message page-login__message--${message.type}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* 底部切换链接 */}
        <div className="page-login__footer">
          {isLogin ? (
            <span>还没有账号？
              <button
                type="button"
                className="page-login__link"
                onClick={() => switchMode('register')}
              >立即注册</button>
            </span>
          ) : (
            <span>已有账号？
              <button
                type="button"
                className="page-login__link"
                onClick={() => switchMode('login')}
              >去登录</button>
            </span>
          )}
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
