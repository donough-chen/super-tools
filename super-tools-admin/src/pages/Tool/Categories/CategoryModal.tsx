import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, message } from 'antd';
import { createCategory, updateCategory, CategoryDTO } from '@/services/tool';

interface Category extends CategoryDTO {
  id?: number;
}

interface Props {
  visible: boolean;
  editing: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CategoryModal: React.FC<Props> = ({ visible, editing, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!editing?.id;

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        status: editing.status === 1,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: true, sort: 0 });
    }
  }, [visible, editing, form]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const dto: CategoryDTO = { ...v, status: v.status ? 1 : 0 };
      const res: any = isEdit
        ? await updateCategory(editing!.id!, dto)
        : await createCategory(dto);
      if (res?.code === 200 || res?.code === 201) {
        message.success(isEdit ? '更新成功' : '创建成功');
        onSuccess();
        onClose();
      } else if (res?.code === 100805) {
        message.error('分类编码已存在');
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('请求异常');
    }
  };

  return (
    <Modal
      open={visible}
      title={isEdit ? '编辑分类' : '新建分类'}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="code"
          label="编码"
          rules={[
            { required: true, message: '请输入编码' },
            { pattern: /^[A-Z][A-Z0-9_]{1,29}$/, message: '需以大写字母开头，2-30 位（A-Z, 0-9, _）' },
          ]}
        >
          <Input disabled={isEdit} placeholder="如 DAILY" />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如 日常应用" />
        </Form.Item>
        <Form.Item name="icon" label="图标 URL">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
        <Form.Item name="sort" label="排序" tooltip="数值越小越靠前">
          <InputNumber min={0} max={9999} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="status" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CategoryModal;
