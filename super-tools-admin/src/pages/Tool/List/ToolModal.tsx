import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Switch, Radio, message } from 'antd';
import { createTool, updateTool, ToolDTO, LevelCode } from '@/services/tool';

interface Tool extends ToolDTO {
  id?: number;
}

interface Category {
  id: number;
  name: string;
  code: string;
}

interface Props {
  visible: boolean;
  editing: Tool | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const LEVEL_OPTIONS: { label: string; value: LevelCode }[] = [
  { label: '免费 (free)', value: 'free' },
  { label: '银牌 (silver)', value: 'silver' },
  { label: '金牌 (gold)', value: 'gold' },
  { label: '钻石 (diamond)', value: 'diamond' },
  { label: '黑金 (black)', value: 'black' },
];

const ToolModal: React.FC<Props> = ({ visible, editing, categories, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!editing?.id;

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        isFeature: editing.isFeature === 1,
        requirePaid: editing.requirePaid === 1,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: 0,
        isFeature: false,
        requiredLevelCode: 'free',
        requirePaid: false,
        sort: 0,
      });
    }
  }, [visible, editing, form]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const dto: ToolDTO = {
        ...v,
        isFeature: v.isFeature ? 1 : 0,
        requirePaid: v.requirePaid ? 1 : 0,
      };
      const res: any = isEdit
        ? await updateTool(editing!.id!, dto)
        : await createTool(dto);
      if (res?.code === 200 || res?.code === 201) {
        message.success(isEdit ? '更新成功' : '创建成功');
        onSuccess();
        onClose();
      } else if (res?.code === 100803) {
        message.error('工具编码已存在');
      } else if (res?.code === 100804) {
        message.error('分类不存在');
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
      title={isEdit ? '编辑工具' : '新建工具'}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
      width={680}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="code"
          label="编码"
          rules={[
            { required: true, message: '请输入编码' },
            { pattern: /^[a-z][a-z0-9-]{1,59}$/, message: '小写字母开头，2-60 位（a-z, 0-9, -）' },
          ]}
        >
          <Input disabled={isEdit} placeholder="如 gold-price" />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如 黄金价格查询" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
        <Form.Item name="keyword" label="关键字" tooltip="用 | 分隔，用于模糊搜索">
          <Input placeholder="黄金|金价|gold" />
        </Form.Item>
        <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select
            placeholder="请选择分类"
            showSearch
            optionFilterProp="label"
            options={categories.map((c) => ({ label: `${c.name} (${c.code})`, value: c.id }))}
          />
        </Form.Item>
        <Form.Item name="path" label="前端路径" rules={[{ required: true, message: '请输入前端路径' }]}>
          <Input placeholder="/gold-price" />
        </Form.Item>
        <Form.Item name="icon" label="图标 URL">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="color" label="主题色">
          <Input placeholder="#F39C12" />
        </Form.Item>

        <Form.Item label="特色功能" name="isFeature" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="最低等级门槛" name="requiredLevelCode">
          <Select options={LEVEL_OPTIONS} />
        </Form.Item>
        <Form.Item label="需要付费会员" name="requirePaid" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="发布状态" name="status">
          <Radio.Group>
            <Radio value={1}>已发布</Radio>
            <Radio value={0}>未发布</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="排序" name="sort" tooltip="同分类内排序，数值越小越靠前">
          <InputNumber min={0} max={9999} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ToolModal;
