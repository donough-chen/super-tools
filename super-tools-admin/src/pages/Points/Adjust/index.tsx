import React, { useState } from 'react';
import { Card, Form, InputNumber, Input, Button, message, Alert, Descriptions } from 'antd';
import AuthButton from '@/components/AuthButton';
import { adjustPoints, getMemberUser, MemberInfoExtra } from '@/services/member';

/**
 * 积分手工调整
 *
 * 后端：POST /api/admin/member/users/:id/adjust-points（perm: member:points:adjust）
 *      GET  /api/admin/member/users/:id                  （perm: member:user:list）
 *
 * 按钮权限：points:btn:adjust:do
 * 菜单权限：points:menu:adjust（独立挂菜单方便给客服角色单独授权）
 *
 * 业务规则（service.member.adjustPoints）：
 *   - points 正数加 / 负数扣
 *   - 调整后落 points_logs（type=4 管理员调整，source=admin）
 *   - 同步写审计日志（user.adjust_points action）
 *   - remark 必填且 ≥ 4 字符（前端校验）+ 后端再次强制校验
 */
const Adjust: React.FC = () => {
  const [form] = Form.useForm();
  const [memberInfo, setMemberInfo] = useState<MemberInfoExtra | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lookup = async () => {
    const v = await form.validateFields(['userId']);
    const res: any = await getMemberUser(v.userId);
    if (res?.code === 200) {
      setMemberInfo(res.data);
    } else {
      setMemberInfo(null);
    }
  };

  const submit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const res: any = await adjustPoints(v.userId, v.points, v.growthDelta || 0, v.remark);
      if (res?.code === 200) {
        message.success('调整成功');
        // 重新拉取最新会员信息
        await lookup();
        form.resetFields(['points', 'growthDelta', 'remark']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="积分手工调整">
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="所有调整会落到 points_logs（source=admin）+ 审计日志，请谨慎操作。"
        />
        <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
          <Form.Item
            name="userId"
            label="用户 ID"
            rules={[{ required: true, message: '请输入用户 ID' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              addonAfter={
                <Button size="small" type="link" onClick={lookup}>
                  查询
                </Button>
              }
            />
          </Form.Item>

          {memberInfo && (
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="当前积分">{memberInfo.points}</Descriptions.Item>
              <Descriptions.Item label="成长值">{memberInfo.growthValue}</Descriptions.Item>
              <Descriptions.Item label="等级">
                {memberInfo.level?.name}（Lv.{memberInfo.level?.level}）
              </Descriptions.Item>
            </Descriptions>
          )}

          <Form.Item
            name="points"
            label="调整积分（正数加 / 负数扣）"
            rules={[{ required: true, message: '请输入调整分值' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="如 +100 或 -50" />
          </Form.Item>
          <Form.Item name="growthDelta" label="成长值调整" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="remark"
            label="原因"
            rules={[{ required: true, min: 4, message: '请填写至少 4 个字符的原因' }]}
          >
            <Input.TextArea rows={3} placeholder="如：补发活动奖励 / 客服补偿" />
          </Form.Item>
          <AuthButton permCode="points:btn:adjust:do">
            <Button type="primary" loading={submitting} onClick={submit}>
              提交调整
            </Button>
          </AuthButton>
        </Form>
      </Card>
    </div>
  );
};

export default Adjust;
