import React, { useEffect } from 'react';
import { Modal, Form, Input, Switch, InputNumber, message } from 'antd';
import { createRole, updateRole, Role, RoleDTO } from '@/services/role';

interface Props {
  visible: boolean;
  editing: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RoleModal: React.FC<Props> = ({ visible, editing, onClose, onSuccess }) => {
  const [form] = Form.useForm<RoleDTO>();
  const [submitting, setSubmitting] = React.useState(false);

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          code: editing.code,
          name: editing.name,
          description: editing.description,
          status: editing.status,
          sort: editing.sort,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 1, sort: 0 });
      }
    }
  }, [visible, editing, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res: any = editing
        ? await updateRole(editing.id, values)
        : await createRole(values);
      if (res?.code === 200 || res?.code === 201) {
        message.success(editing ? '更新成功' : '创建成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (e: any) {
      // form 校验失败由 antd 自动展示
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editing ? `编辑角色：${editing.code}` : '新建角色'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="code"
          label="编码"
          rules={[
            { required: true, message: '请输入编码' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母开头，仅含小写字母/数字/下划线' },
          ]}
        >
          <Input placeholder="如：operator" disabled={!!editing} />
        </Form.Item>
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="如：运营管理员" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} placeholder="角色职责说明（可选）" />
        </Form.Item>
        <Form.Item name="status" label="启用" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
        <Form.Item name="sort" label="排序（数字越小越靠前）">
          <InputNumber min={0} max={9999} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleModal;
