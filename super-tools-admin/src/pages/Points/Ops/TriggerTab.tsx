import React, { useState } from 'react';
import { Card, Button, Space, message, Descriptions, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { triggerOpsTask } from '@/services/points';

/**
 * 手工触发定时任务 Tab
 *
 * 后端：POST /api/admin/points/ops/trigger（perm: points:ops:trigger）
 * 按钮权限：points:btn:ops:trigger
 *
 * 业务上对应 schedule 中已注册的 4 个定时任务：
 *   expire   → 处理已过期批次（status=2 → 3）
 *   remind   → 按 expire_remind_stages 分阶段发送过期提醒
 *   snapshot → 日终生成 points_balance_snapshots（次日对账）
 *   check    → 抽样校验 user_members.points 与 points_logs 一致性
 */
type TaskKey = 'expire' | 'remind' | 'snapshot' | 'check';

const TASKS: Array<{ key: TaskKey; name: string; desc: string }> = [
  { key: 'expire', name: '处理过期批次', desc: '扫描已过期的 points_logs，扣减并入流水（status=3）' },
  { key: 'remind', name: '发送过期提醒', desc: '按 expire_remind_stages 阶段发送通知' },
  { key: 'snapshot', name: '日终对账快照', desc: '生成 points_balance_snapshots（用于次日对账）' },
  { key: 'check', name: '小时级对账巡检', desc: '抽样校验 user_members.points 与 points_logs 一致性' },
];

const TriggerTab: React.FC = () => {
  const [loading, setLoading] = useState<TaskKey | null>(null);
  const [lastResult, setLastResult] = useState<{ task: string; result: any } | null>(null);

  const trigger = async (task: TaskKey) => {
    setLoading(task);
    try {
      const res: any = await triggerOpsTask(task);
      if (res?.code === 200) {
        message.success(`${task} 已触发`);
        setLastResult(res.data);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card title="手工触发定时任务（开发/运维联调用）">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {TASKS.map((t) => (
          <Card
            key={t.key}
            size="small"
            type="inner"
            title={t.name}
            extra={
              <AuthButton permCode="points:btn:ops:trigger">
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={loading === t.key}
                  onClick={() => trigger(t.key)}
                >
                  立即触发
                </Button>
              </AuthButton>
            }
          >
            <span style={{ color: '#666' }}>{t.desc}</span>
          </Card>
        ))}
        {lastResult && (
          <Descriptions title="最近执行结果" bordered column={1} size="small">
            <Descriptions.Item label="任务">
              <Tag>{lastResult.task}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="结果">
              <pre style={{ margin: 0 }}>{JSON.stringify(lastResult.result, null, 2)}</pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Space>
    </Card>
  );
};

export default TriggerTab;
