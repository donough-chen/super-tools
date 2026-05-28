import React, { useState } from 'react';
import { Card, Button, InputNumber, message, Form, Alert } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { clearRuleCache } from '@/services/points';

/**
 * 缓存清理 Tab
 *
 * 后端：POST /api/admin/points/cache/clear?levelId=X（perm: points:ops:trigger）
 * 按钮权限：points:btn:ops:clear-cache
 *
 * 触发场景：管理端修改 member_levels.benefits.points_* 字段后，
 *           需要让 Redis 中的 pointsRule 缓存立即失效（参见 Plan A · A7/A8）。
 */
const CacheTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      const res: any = await clearRuleCache(v.levelId);
      if (res?.code === 200) {
        message.success(`已清理：${res.data?.levelId ?? '全部'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="积分规则缓存清理">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="使用场景"
        description="修改 member_levels.benefits.points_* 后，调用本接口让 Redis pointsRule 缓存立即失效。留空 levelId 清空全部等级。"
      />
      <Form form={form} layout="inline">
        <Form.Item name="levelId" label="等级 ID（可空 = 全部）">
          <InputNumber min={1} placeholder="留空清空全部" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item>
          <AuthButton permCode="points:btn:ops:clear-cache">
            <Button
              type="primary"
              icon={<ClearOutlined />}
              loading={loading}
              onClick={handleClear}
            >
              清理缓存
            </Button>
          </AuthButton>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default CacheTab;
