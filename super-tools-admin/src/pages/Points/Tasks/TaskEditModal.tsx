import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Switch, Row, Col } from 'antd';
import type { PointsTask } from '@/services/points';

/**
 * 任务编辑弹窗
 *
 * 字段对齐：
 *   - tasks 表结构（database/025_points_growth_system_full.sql §4）
 *   - PointsTask interface（services/points.ts）
 *
 * trigger_event 枚举：与 026 SQL §3.5 任务种子使用的 event code 保持一致
 */

const CATEGORIES = [
  { value: 'newbie', label: '新手' },
  { value: 'daily', label: '日常' },
  { value: 'achievement', label: '成就' },
  { value: 'invite', label: '邀请' },
];

const TRIGGER_EVENTS = [
  { value: 'register', label: '注册' },
  { value: 'daily_login', label: '每日登录' },
  { value: 'consume_milestone', label: '累计消费里程碑' },
  { value: 'subscribe_renewal', label: '订阅续费' },
  { value: 'invite_success', label: '邀请成功' },
];

const RESET_CYCLES = [
  { value: 'once', label: 'once 一次性' },
  { value: 'daily', label: 'daily 每日' },
  { value: 'weekly', label: 'weekly 每周' },
  { value: 'monthly', label: 'monthly 每月' },
  { value: 'yearly', label: 'yearly 每年' },
];

interface Props {
  open: boolean;
  initial?: Partial<PointsTask>;
  onCancel: () => void;
  onOk: (values: Partial<PointsTask>) => Promise<void>;
}

const TaskEditModal: React.FC<Props> = ({ open, initial, onCancel, onOk }) => {
  const [form] = Form.useForm();
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initial) form.setFieldsValue(initial);
    }
  }, [open, initial, form]);

  return (
    <Modal
      open={open}
      title={isEdit ? `编辑任务 #${initial?.id}` : '创建任务'}
      width={720}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        await onOk(values);
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="code" label="Code (业务唯一键)" rules={[{ required: true }]}>
              <Input disabled={isEdit} placeholder="如 daily_sign" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={CATEGORIES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="triggerEvent" label="触发事件" rules={[{ required: true }]}>
              <Select options={TRIGGER_EVENTS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="resetCycle" label="重置周期">
              <Select allowClear options={RESET_CYCLES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="rewardPoints" label="奖励积分" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="rewardGrowth" label="奖励成长值" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="progressTarget" label="进度目标" initialValue={1}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="dailyCapGroup" label="日均上限组">
              <Input placeholder="如 task / invite" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="sort" label="排序" initialValue={50}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="启用" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default TaskEditModal;
