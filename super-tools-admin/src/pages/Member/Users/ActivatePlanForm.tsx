import React, { useEffect, useState } from 'react';
import {
  Form, Select, Button, Alert, Popconfirm, message, Space,
} from 'antd';
import AuthButton from '@/components/AuthButton';
import { activatePlan, listPlans, PaidPlan } from '@/services/member';
import { formatCurrency, formatDuration } from '@/utils/memberFormat';

interface Props {
  userId: number;
  onSuccess: () => void;
}

const ActivatePlanForm: React.FC<Props> = ({ userId, onSuccess }) => {
  const [form] = Form.useForm();
  const [plans, setPlans] = useState<PaidPlan[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listPlans().then((r: any) => {
      if (r?.code === 200) setPlans((r.data || []).filter((p: PaidPlan) => p.status === 1));
    });
  }, []);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const res: any = await activatePlan(userId, v.planCode);
      if (res?.code === 200) {
        message.success('开通成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(res?.message || '开通失败');
      }
    } catch {
      // validate 失败忽略
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Alert
        message="开通后将立即生效，赠送对应积分/成长值"
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          label="选择套餐"
          name="planCode"
          rules={[{ required: true, message: '请选择套餐' }]}
        >
          <Select
            options={plans.map((p) => ({
              value: p.code,
              label: `${p.name}（${formatDuration(p.durationDays)} / ${formatCurrency(p.price)}）`,
            }))}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <AuthButton permCode="member:plan:activate">
              <Popconfirm
                title="确认开通套餐？此操作会写入审计日志"
                onConfirm={submit}
              >
                <Button type="primary" loading={submitting}>提交开通</Button>
              </Popconfirm>
            </AuthButton>
          </Space>
        </Form.Item>
      </Form>
    </>
  );
};

export default ActivatePlanForm;
