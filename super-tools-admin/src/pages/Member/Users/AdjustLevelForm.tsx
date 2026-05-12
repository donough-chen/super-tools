import React, { useEffect, useState } from 'react';
import {
  Form, Select, Button, Popconfirm, message, Space,
} from 'antd';
import AuthButton from '@/components/AuthButton';
import { adjustLevel, listLevels, MemberLevel } from '@/services/member';

interface Props {
  userId: number;
  currentLevelId: number;
  onSuccess: () => void;
}

const AdjustLevelForm: React.FC<Props> = ({ userId, currentLevelId, onSuccess }) => {
  const [form] = Form.useForm();
  const [levels, setLevels] = useState<MemberLevel[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listLevels().then((r: any) => {
      if (r?.code === 200) setLevels(r.data || []);
    });
  }, []);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const res: any = await adjustLevel(userId, v.levelId);
      if (res?.code === 200) {
        message.success('等级调整成功');
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
    <Form form={form} layout="vertical" initialValues={{ levelId: currentLevelId }}>
      <Form.Item
        label="目标等级"
        name="levelId"
        rules={[{ required: true, message: '请选择等级' }]}
      >
        <Select
          options={levels.map((l) => ({
            value: l.id,
            label: `${l.name} (level=${l.level})`,
            disabled: l.status === 0,
          }))}
        />
      </Form.Item>
      <Form.Item>
        <Space>
          <AuthButton permCode="member:level:assign">
            <Popconfirm
              title="确认调整等级？此操作会写入审计日志"
              onConfirm={submit}
            >
              <Button type="primary" loading={submitting}>提交调整</Button>
            </Popconfirm>
          </AuthButton>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AdjustLevelForm;
