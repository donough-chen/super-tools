import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch, message, TreeSelect } from 'antd';
import {
  createSnippetCategory, updateSnippetCategory,
  SnippetCategory, CategoryCreatePayload,
} from '@/services/feedbackSnippet';

interface Props {
  visible: boolean;
  category: SnippetCategory | null;
  parentCategories: SnippetCategory[];
  onClose: () => void;
  onSaved: () => void;
}

const FEEDBACK_TYPE_OPTIONS = [
  { label: '不关联', value: '' },
  { label: 'Bug', value: 'bug' },
  { label: '建议', value: 'suggestion' },
  { label: '表扬', value: 'praise' },
  { label: '其它', value: 'other' },
];

/** 把树扁平化为 TreeSelect 数据 */
function flatten(nodes: SnippetCategory[]): any[] {
  return (nodes || []).map((n) => ({
    title: n.name,
    value: n.id,
    children: n.children && n.children.length > 0 ? flatten(n.children) : undefined,
  }));
}

const CategoryEditModal: React.FC<Props> = ({ visible, category, parentCategories, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const isEdit = !!category;

  useEffect(() => {
    if (visible) {
      if (category) {
        form.setFieldsValue({
          ...category,
          feedbackType: category.feedbackType || '',
          status: category.status === 1,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: true, sortOrder: 0 });
      }
    }
  }, [visible, category, form]);

  const handleOk = async () => {
    const v = await form.validateFields();
    const payload: any = {
      ...v,
      feedbackType: v.feedbackType || null,
      status: v.status ? 1 : 0,
    };

    let res: any;
    if (isEdit && category) {
      delete payload.code; // code 不可改
      res = await updateSnippetCategory(category.id, payload);
    } else {
      res = await createSnippetCategory(payload as CategoryCreatePayload);
    }

    if (res?.code === 200 || res?.code === 201) {
      message.success(isEdit ? '已更新' : '已创建');
      onSaved();
    } else {
      message.error(res?.message || '保存失败');
    }
  };

  return (
    <Modal
      title={isEdit ? `编辑分类 - ${category?.name}` : '新建分类'}
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item label="父分类" name="parentId">
          <TreeSelect
            allowClear
            treeData={flatten(parentCategories)}
            placeholder="不选则为顶级分类"
            treeDefaultExpandAll
          />
        </Form.Item>
        <Form.Item
          label="Code"
          name="code"
          rules={[
            { required: true, message: '请输入 code' },
            { pattern: /^[a-z][a-z0-9_-]{1,63}$/i, message: '小写字母开头，仅允许字母数字下划线短横' },
          ]}
        >
          <Input disabled={isEdit} placeholder="例如 after-sales" />
        </Form.Item>
        <Form.Item
          label="名称"
          name="name"
          rules={[{ required: true, message: '请输入名称' }, { max: 50 }]}
        >
          <Input placeholder="例如 售后服务" />
        </Form.Item>
        <Form.Item label="关联反馈类型" name="feedbackType" tooltip="智能推荐时按此匹配">
          <Select options={FEEDBACK_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} maxLength={255} showCount />
        </Form.Item>
        <Form.Item label="图标(可选)" name="icon">
          <Input placeholder="antd icon name" />
        </Form.Item>
        <Form.Item label="颜色(可选)" name="color">
          <Input placeholder="#1677ff" />
        </Form.Item>
        <Form.Item label="排序" name="sortOrder">
          <InputNumber min={0} />
        </Form.Item>
        <Form.Item label="启用" name="status" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CategoryEditModal;
