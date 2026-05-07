import React, { useState } from 'react';
import { Form, Input, Button, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SmileOutlined } from '@ant-design/icons';
import { useHistory } from 'umi';
import { authLogin, register } from '@/services/api';
import { useUserStore } from '@/store/user';
import type { UserInfo } from '@/store/user';
import './index.less';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const { setUserInfo } = useUserStore();
  const history = useHistory();

  /** 保存 token 到 localStorage（7天有效期） */
  const saveToken = (token: string, expiresIn: number) => {
    localStorage.setItem('token', token);
    localStorage.setItem('token_expire', String(Date.now() + expiresIn * 1000));
  };

  /** 登录成功处理 */
  const handleAuthSuccess = (data: { token: string; expiresIn: number; userInfo: any }) => {
    saveToken(data.token, data.expiresIn);
    const userInfo: UserInfo = {
      id: data.userInfo.id,
      username: data.userInfo.username,
      nickname: data.userInfo.nickname,
      email: data.userInfo.email,
      avatar: data.userInfo.avatar,
      role: data.userInfo.role,
      settings: {
        notificationEnabled: data.userInfo.settings?.notificationEnabled ?? true,
        theme: data.userInfo.settings?.theme,
        language: data.userInfo.settings?.language,
      },
    };
    setUserInfo(userInfo);
    message.success('登录成功，欢迎回来！');
    history.push('/');
  };

  /** 登录提交 */
  const handleLogin = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authLogin({ account: values.account, password: values.password });
      handleAuthSuccess(res.data);
    } catch {
      // 错误已由 request 统一处理
    } finally {
      setLoading(false);
    }
  };

  /** 注册提交 */
  const handleRegister = async (values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    nickname?: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await register({
        username: values.username,
        email: values.email,
        password: values.password,
        nickname: values.nickname,
      });
      handleAuthSuccess(res.data);
    } catch {
      // 错误已由 request 统一处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__card">
        {/* Logo & 标题 */}
        <div className="login-page__header">
          <div className="login-page__logo">🛠️</div>
          <h1 className="login-page__title">Super Tools</h1>
          <p className="login-page__subtitle">您的在线工具箱</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'login' | 'register')}
          centered
          className="login-page__tabs"
        >
          {/* 登录 Tab */}
          <TabPane tab="登录" key="login">
            <Form
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              size="large"
              className="login-page__form"
            >
              <Form.Item
                name="account"
                rules={[{ required: true, message: '请输入用户名或邮箱' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-page__submit"
                >
                  登录
                </Button>
              </Form.Item>

              <div className="login-page__hint">
                <span>测试账号：admin / admin123</span>
              </div>
            </Form>
          </TabPane>

          {/* 注册 Tab */}
          <TabPane tab="注册" key="register">
            <Form
              name="register"
              onFinish={handleRegister}
              autoComplete="off"
              size="large"
              className="login-page__form"
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少 3 个字符' },
                  { max: 20, message: '用户名最多 20 个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名（字母/数字/下划线）" />
              </Form.Item>

              <Form.Item
                name="nickname"
                rules={[{ max: 20, message: '昵称最多 20 个字符' }]}
              >
                <Input prefix={<SmileOutlined />} placeholder="昵称（可选）" />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="邮箱" />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少 6 个字符' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 6 位）" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                rules={[{ required: true, message: '请再次输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-page__submit"
                >
                  注册并登录
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Login;
