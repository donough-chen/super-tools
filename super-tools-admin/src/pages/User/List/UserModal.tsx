import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createUser, updateUser, User } from '@/services/user';

interface Props {
  visible: boolean;
  editing: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UserModal: React.FC<Props> = ({ visible, editing, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          username: editing.username,
          email: editing.email,
          phone: editing.phone,
          nickname: editing.nickname,
          userType: editing.userType,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ userType: 1 });
      }
    }
  }, [visible, editing, form]);

  const onOk = async () => {
    try {
      const values = await form.validateFields();
      let res: any;
      if (editing) {
        // 编辑模式：username 不允许改（DB 唯一约束）；password 通过 ResetPwdModal
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { username, password, ...rest } = values;
        res = await updateUser(editing.id, rest);
      } else {
        res = await createUser(values);
      }
      if (res?.code === 200 || res?.code === 201) {
        message.success(editing ? '更新成功' : '创建成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch {
      // validate 失败忽略
    }
  };

  return (
    <Modal
      title={editing ? `编辑用户 #${editing.id}` : '新建用户'}
      open={visible} onCancel={onClose} onOk={onOk}
      destroyOnClose width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="用户名" name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, max: 50, message: '3-50 字符' },
          ]}
        >
          <Input disabled={!!editing} />
        </Form.Item>
        {!editing && (
          <Form.Item
            label="密码" name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, max: 50, message: '8-50 字符' },
            ]}
          >
            <Input.Password />
          </Form.Item>
        )}
        <Form.Item
          label="邮箱" name="email"
          rules={[{ type: 'email', message: '邮箱格式不正确' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="手机" name="phone">
          <Input />
        </Form.Item>
        <Form.Item label="昵称" name="nickname">
          <Input />
        </Form.Item>
        <Form.Item label="用户类型" name="userType">
          <Select options={[
            { label: '普通用户', value: 1 },
            { label: '管理员', value: 2 },
          ]} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserModal;
