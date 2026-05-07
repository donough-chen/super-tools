import React, { useCallback } from 'react';
import { Form, Input, Button, Card, Typography, Divider, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useDispatch, useSelector, history } from 'umi';
import type { UserModelState } from '@/models/user';
import type { RegisterParams } from '@/services/auth';
import styles from './index.less';

const { Title, Text, Link } = Typography;

const RegisterPage: React.FC = () => {
  const dispatch = useDispatch();
  const { registerLoading } = useSelector((state: { user: UserModelState }) => state.user);
  const [form] = Form.useForm();

  const handleSubmit = useCallback(
    async (values: RegisterParams & { confirmPassword: string }) => {
      const { confirmPassword, ...params } = values;
      dispatch({
        type: 'user/register',
        payload: params,
      });
    },
    [dispatch],
  );

  return (
    <div className={styles.container}>
      <Card className={styles.card} bordered={false}>
        <div className={styles.header}>
          <Title level={2} className={styles.title}>
            创建账号
          </Title>
          <Text type="secondary">注册 Super Tools 管理端账号</Text>
        </div>

        <Divider />

        <Form
          form={form}
          name="register"
          size="large"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 个字符' },
              { max: 50, message: '用户名最多 50 个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" autoFocus />
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
            name="nickname"
          >
            <Input prefix={<UserOutlined />} placeholder="昵称（选填）" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 个字符' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 8 位）" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={registerLoading}
              block
            >
              注册
            </Button>
          </Form.Item>

          <div className={styles.footer}>
            <Space>
              <Text type="secondary">已有账号？</Text>
              <Link onClick={() => history.push('/login')}>返回登录</Link>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
