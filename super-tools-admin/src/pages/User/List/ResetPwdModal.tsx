import React from 'react';
import { Modal, Form, Input, message, Alert } from 'antd';
import { resetUserPassword, User } from '@/services/user';

interface Props {
  visible: boolean;
  target: User | null;
  onClose: () => void;
}

const ResetPwdModal: React.FC<Props> = ({ visible, target, onClose }) => {
  const [form] = Form.useForm();

  const onOk = async () => {
    try {
      const { newPassword } = await form.validateFields();
      const res: any = await resetUserPassword(target!.id, newPassword);
      if (res?.code === 200) {
        message.success('密码已重置');
        form.resetFields();
        onClose();
      } else {
        message.error(res?.message || '重置失败');
      }
    } catch {
      // validate 失败忽略
    }
  };

  return (
    <Modal
      title={`重置 ${target?.username || ''} 的密码`}
      open={visible} onCancel={onClose} onOk={onOk}
      destroyOnClose width={460}
      afterClose={() => form.resetFields()}
    >
      <Alert
        message="重置后用户需用新密码登录"
        type="warning" showIcon style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          label="新密码" name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, max: 50, message: '8-50 字符' },
          ]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          label="确认新密码" name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, v) {
                if (!v || getFieldValue('newPassword') === v) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ResetPwdModal;
