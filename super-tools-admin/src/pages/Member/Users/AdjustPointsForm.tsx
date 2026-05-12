import React, { useState } from 'react';
import {
  Form, InputNumber, Input, Button, Popconfirm, message, Space,
} from 'antd';
import AuthButton from '@/components/AuthButton';
import { adjustPoints } from '@/services/member';

interface Props {
  userId: number;
  onSuccess: () => void;
}

const AdjustPointsForm: React.FC<Props> = ({ userId, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const res: any = await adjustPoints(
        userId,
        v.points,
        v.growthDelta || 0,
        v.remark,
      );
      if (res?.code === 200) {
        message.success('调整成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(res?.message || '调整失败');
      }
    } catch {
      // validate 失败忽略
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        label="积分变化（正数加，负数扣）"
        name="points"
        rules={[{ required: true, message: '请输入积分变化值' }]}
      >
        <InputNumber style={{ width: '100%' }} placeholder="例如 100 或 -50" />
      </Form.Item>
      <Form.Item
        label="成长值变化（可选）"
        name="growthDelta"
        initialValue={0}
      >
        <InputNumber style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label="备注（必填，将写入审计日志）"
        name="remark"
        rules={[
          { required: true, message: '备注必填' },
          { max: 200, message: '200 字符内' },
        ]}
      >
        <Input.TextArea
          rows={2}
          placeholder="例如：双 11 活动补偿"
          maxLength={200}
          showCount
        />
      </Form.Item>
      <Form.Item>
        <Space>
          <AuthButton permCode="member:points:adjust">
            <Popconfirm
              title="确认调整？此操作会写入审计日志"
              onConfirm={submit}
            >
              <Button type="primary" loading={submitting}>提交调整</Button>
            </Popconfirm>
          </AuthButton>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AdjustPointsForm;
