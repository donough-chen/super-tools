import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch, message } from 'antd';
import {
  createPermission,
  updatePermission,
  PermissionDTO,
  PermissionTreeNode,
} from '@/services/permission';

interface Props {
  visible: boolean;
  editing: PermissionTreeNode | null;
  parentNode: PermissionTreeNode | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_OPTIONS = [
  { label: '目录', value: 1 },
  { label: '菜单', value: 2 },
  { label: '按钮', value: 3 },
  { label: 'API', value: 4 },
];

const MODULE_OPTIONS = [
  'dashboard', 'system', 'user', 'category', 'tool', 'feedback', 'stats', 'member',
].map((m) => ({ label: m, value: m }));

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ label: m, value: m }));

const PermissionFormModal: React.FC<Props> = ({ visible, editing, parentNode, onClose, onSuccess }) => {
  const [form] = Form.useForm<PermissionDTO>();
  const [submitting, setSubmitting] = React.useState(false);

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          code: editing.code,
          name: editing.name,
          type: editing.type,
          module: editing.module,
          platform: editing.platform || 'admin',
          path: editing.path,
          method: editing.method,
          parentId: editing.parentId ?? 0,
          sort: editing.sort,
          status: editing.status,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: 1,
          sort: 0,
          platform: 'admin',
          parentId: parentNode?.id ?? 0,
          module: parentNode?.module || '',
          type: parentNode ? (parentNode.type === 1 ? 2 : 4) : 1,
        });
      }
    }
  }, [visible, editing, parentNode, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res: any = editing
        ? await updatePermission(editing.id, values)
        : await createPermission(values);
      if (res?.code === 200 || res?.code === 201) {
        message.success(editing ? '更新成功' : '创建成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editing ? `编辑权限：${editing.code}` : '新建权限'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="code"
          label="权限编码"
          rules={[
            { required: true, message: '请输入权限编码' },
            { pattern: /^[a-z][a-z0-9:_-]*$/, message: '小写字母开头，仅含小写字母/数字/冒号/下划线/短横' },
          ]}
        >
          <Input placeholder="如：tool:export" disabled={!!editing} />
        </Form.Item>
        <Form.Item name="name" label="权限名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如：导出工具" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="module" label="所属模块">
          <Select options={MODULE_OPTIONS} allowClear placeholder="选择模块" />
        </Form.Item>
        <Form.Item name="platform" label="平台">
          <Select
            options={[
              { label: 'admin', value: 'admin' },
              { label: 'all', value: 'all' },
              { label: 'web', value: 'web' },
            ]}
          />
        </Form.Item>
        <Form.Item name="path" label="路径">
          <Input placeholder="如：/api/admin/tools/export" />
        </Form.Item>
        <Form.Item name="method" label="HTTP 方法">
          <Select options={METHOD_OPTIONS} allowClear placeholder="API 类型必填" />
        </Form.Item>
        <Form.Item name="parentId" label="父节点 ID">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="sort" label="排序">
          <InputNumber min={0} max={9999} />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态"
          valuePropName="checked"
          getValueFromEvent={(checked: boolean) => checked ? 1 : 0}
          getValueProps={(value: number) => ({ checked: value === 1 })}
        >
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PermissionFormModal;
