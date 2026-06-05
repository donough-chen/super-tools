import React, { useEffect } from 'react';
import { Drawer, Form, Input, InputNumber, Select, Switch, Checkbox, Row, Col, Button, Space, message } from 'antd';
import type { PointsMallItem } from '@/services/points';

/**
 * 商城商品编辑抽屉
 *
 * fulfillConfig：JSON 字段，前端用 Textarea 编辑，提交前 JSON.parse。
 *   常用 payload：
 *     - 优惠券:      {"type":"coupon","discount":0.8,"threshold":100,"valid_days":30}
 *     - 会员天数:    {"type":"member_days","plan_code":"silver","days":30}
 *     - 工具解锁:    {"type":"tool_unlock","tool_code":"image-to-link","days":1}
 *     - 徽章:        {"type":"badge","badge_code":"vip_badge"}
 *     - 实物商品:    {"type":"physical"}  // 无需额外配置，填写收货信息即可
 */
interface Props {
  open: boolean;
  initial?: Partial<PointsMallItem>;
  onClose: () => void;
  onSubmit: (values: Partial<PointsMallItem>) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { value: 'coupon', label: '优惠券' },
  { value: 'member_days', label: '会员天数' },
  { value: 'tool_unlock', label: '工具解锁' },
  { value: 'badge', label: '徽章' },
  { value: 'physical', label: '实物商品' },
];

const ItemEditDrawer: React.FC<Props> = ({ open, initial, onClose, onSubmit }) => {
  const [form] = Form.useForm();
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initial) {
        form.setFieldsValue({
          ...initial,
          fulfillConfig: initial.fulfillConfig
            ? JSON.stringify(initial.fulfillConfig, null, 2)
            : '{}',
        });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    let cfg: any;
    try {
      cfg = JSON.parse(values.fulfillConfig || '{}');
    } catch {
      message.error('fulfillConfig 不是合法 JSON');
      return;
    }
    // 转换布尔值为数字（Switch 组件返回 boolean，后端需要 0/1）
    const submitValues = {
      ...values,
      fulfillConfig: cfg,
      isVirtual: values.isVirtual ? 1 : 0,
      status: values.status ? 1 : 0,
    };
    await onSubmit(submitValues);
  };

  return (
    <Drawer
      open={open}
      title={isEdit ? `编辑商品 #${initial?.id}` : '新建商品'}
      width={720}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleOk}>
            保存
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="商品名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="costPoints" label="所需积分" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="requiredLevel" label="所需等级">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="isVirtual" label="虚拟商品" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="stock" label="库存（不限填 0）" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="dailyLimit" label="每日限购" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="totalLimit" label="总限购" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sort" label="排序" initialValue={50}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="启用" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="applicableScenes" label="适用场景">
              <Checkbox.Group>
                <Checkbox value="points_mall">积分商城兑换</Checkbox>
                <Checkbox value="member_subscription">会员订阅抵扣</Checkbox>
              </Checkbox.Group>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="fulfillConfig"
              label="发放配置 (JSON)"
              rules={[{ required: true }]}
              tooltip='例如：{"type":"coupon","couponId":123} 或 {"type":"plan","planCode":"silver_30d"}'
            >
              <Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
};

export default ItemEditDrawer;
