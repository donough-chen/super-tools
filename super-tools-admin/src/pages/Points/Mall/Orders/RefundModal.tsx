import React from 'react';
import { Modal, Form, Input } from 'antd';

/**
 * 退款弹窗
 *
 * 后端：POST /api/admin/points/mall/orders/:id/refund
 * 必传字段 reason（最少 4 字符）
 */
interface Props {
  open: boolean;
  orderId?: number;
  onCancel: () => void;
  onOk: (reason: string) => Promise<void>;
}

const RefundModal: React.FC<Props> = ({ open, orderId, onCancel, onOk }) => {
  const [form] = Form.useForm();
  return (
    <Modal
      open={open}
      title={`订单 #${orderId} 退款`}
      onCancel={onCancel}
      onOk={async () => {
        const v = await form.validateFields();
        await onOk(v.reason);
        form.resetFields();
      }}
      okType="danger"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label="退款原因" rules={[{ required: true, min: 4 }]}>
          <Input.TextArea rows={3} maxLength={200} placeholder="如：商品已下架 / 用户客服申请退款" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RefundModal;
