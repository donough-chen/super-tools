import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, message, Space } from 'antd';
import { updateLevel, MemberLevel } from '@/services/member';
import BenefitsField from './BenefitsField';

interface Props {
  visible: boolean;
  editing: MemberLevel | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LevelModal: React.FC<Props> = ({ visible, editing, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && editing) {
      form.setFieldsValue({
        level: editing.level,
        code: editing.code,
        name: editing.name,
        icon: editing.icon,
        color: editing.color,
        upgradePoints: editing.upgradePoints,
        upgradeGrowth: editing.upgradeGrowth,
        upgradeConsume: parseFloat(editing.upgradeConsume) || 0,
        description: editing.description,
        sort: editing.sort,
        status: editing.status === 1,
        benefits: editing.benefits || {},
      });
    } else if (!visible) {
      form.resetFields();
    }
  }, [visible, editing, form]);

  const onOk = async () => {
    if (!editing) return;
    try {
      const v = await form.validateFields();
      const dto: any = {
        name: v.name,
        icon: v.icon,
        color: v.color,
        upgradePoints: v.upgradePoints,
        upgradeGrowth: v.upgradeGrowth,
        upgradeConsume: v.upgradeConsume,
        description: v.description,
        sort: v.sort,
        status: v.status ? 1 : 0,
        benefits: v.benefits,
      };
      const res: any = await updateLevel(editing.id, dto);
      if (res?.code === 200) {
        message.success('更新成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '更新失败');
      }
    } catch {
      // validate 失败忽略
    }
  };

  return (
    <Modal
      title={`编辑等级 #${editing?.id ?? ''}`}
      open={visible}
      onCancel={onClose}
      onOk={onOk}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Space style={{ width: '100%' }}>
          <Form.Item label="等级" name="level" tooltip="不可修改">
            <InputNumber disabled style={{ width: 100 }} />
          </Form.Item>
          <Form.Item label="编码" name="code" tooltip="不可修改">
            <Input disabled style={{ width: 160 }} />
          </Form.Item>
        </Space>
        <Form.Item label="名称" name="name"
          rules={[{ required: true, max: 50, message: '50 字符内' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="图标 URL" name="icon" rules={[{ max: 500 }]}>
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item label="主题色" name="color" rules={[{ max: 20 }]}>
          <Input placeholder="#ffd700" />
        </Form.Item>
        <Space>
          <Form.Item label="升级所需积分" name="upgradePoints">
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="升级所需成长值" name="upgradeGrowth">
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="升级所需消费" name="upgradeConsume">
            <InputNumber min={0} precision={2} style={{ width: 140 }} />
          </Form.Item>
        </Space>
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space>
          <Form.Item label="排序" name="sort">
            <InputNumber style={{ width: 100 }} />
          </Form.Item>
          <Form.Item label="状态" name="status" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Space>
        <Form.Item
          label="权益配置（JSON）"
          name="benefits"
          tooltip="必须是 JSON 对象（不能是数组或基础类型）"
          rules={[{
            validator: (_, v) => {
              if (typeof v !== 'object' || v === null || Array.isArray(v)) {
                return Promise.reject(new Error('benefits 必须是 JSON 对象'));
              }
              return Promise.resolve();
            },
          }]}
        >
          <BenefitsField />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LevelModal;
