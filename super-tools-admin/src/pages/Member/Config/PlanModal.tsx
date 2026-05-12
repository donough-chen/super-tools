import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, message, Space } from 'antd';
import { updatePlan, PaidPlan } from '@/services/member';
import BenefitsField from './BenefitsField';

interface Props {
  visible: boolean;
  editing: PaidPlan | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PlanModal: React.FC<Props> = ({ visible, editing, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && editing) {
      form.setFieldsValue({
        code: editing.code,
        name: editing.name,
        durationDays: editing.durationDays,
        price: parseFloat(editing.price) || 0,
        originalPrice: parseFloat(editing.originalPrice) || 0,
        giftPoints: editing.giftPoints,
        giftGrowth: editing.giftGrowth,
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
        durationDays: v.durationDays,
        price: v.price,
        originalPrice: v.originalPrice,
        giftPoints: v.giftPoints,
        giftGrowth: v.giftGrowth,
        description: v.description,
        sort: v.sort,
        status: v.status ? 1 : 0,
        benefits: v.benefits,
      };
      const res: any = await updatePlan(editing.id, dto);
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
      title={`编辑套餐 #${editing?.id ?? ''}`}
      open={visible}
      onCancel={onClose}
      onOk={onOk}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item label="编码" name="code" tooltip="不可修改">
          <Input disabled />
        </Form.Item>
        <Form.Item label="名称" name="name"
          rules={[{ required: true, max: 50, message: '50 字符内' }]}>
          <Input />
        </Form.Item>
        <Space>
          <Form.Item label="时长（天）" name="durationDays" tooltip="0 表示永久">
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="售价" name="price">
            <InputNumber min={0} precision={2} style={{ width: 140 }} addonBefore="¥" />
          </Form.Item>
          <Form.Item label="原价" name="originalPrice">
            <InputNumber min={0} precision={2} style={{ width: 140 }} addonBefore="¥" />
          </Form.Item>
        </Space>
        <Space>
          <Form.Item label="赠送积分" name="giftPoints">
            <InputNumber min={0} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="赠送成长值" name="giftGrowth">
            <InputNumber min={0} style={{ width: 140 }} />
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
          tooltip="必须是 JSON 对象"
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

export default PlanModal;
