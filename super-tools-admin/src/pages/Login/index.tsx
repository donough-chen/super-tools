import React, { useCallback } from 'react';
import { Form, Input, Button, Card, Typography, Divider, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector, history } from 'umi';
import type { UserModelState } from '@/models/user';
import type { LoginParams } from '@/services/auth';
import styles from './index.less';

const { Title, Text, Link } = Typography;

const LoginPage: React.FC = () => {
  const dispatch = useDispatch();
  const { loginLoading } = useSelector((state: { user: UserModelState }) => state.user);
  const [form] = Form.useForm();

  const handleSubmit = useCallback(
    async (values: LoginParams) => {
      dispatch({
        type: 'user/login',
        payload: values,
      });
    },
    [dispatch],
  );

  return (
    <div className={styles.container}>
      <Card className={styles.card} bordered={false}>
        <div className={styles.header}>
          <Title level={2} className={styles.title}>
            Super Tools 管理端
          </Title>
          <Text type="secondary">后台管理系统登录</Text>
        </div>

        <Divider />

        <Form
          form={form}
          name="login"
          size="large"
          onFinish={handleSubmit}
          autoComplete="off"
          initialValues={{ username: '', password: '' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名 / 邮箱 / 手机号"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginLoading}
              block
            >
              登录
            </Button>
          </Form.Item>

          <div className={styles.footer}>
            <Space>
              <Text type="secondary">还没有账号？</Text>
              <Link onClick={() => history.push('/register')}>立即注册</Link>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
