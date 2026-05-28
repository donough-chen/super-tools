import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, message, Tag, Alert, Modal } from 'antd';
import { ClearOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listLevels } from '@/services/member';
import { clearRuleCache } from '@/services/points';

/**
 * 积分管理 · 规则页
 *
 * 设计说明（来自 Plan §Task 5）：
 *   当前后端无独立 system_configs 管理 controller，本期实现一个轻量页面：
 *   - 展示所有等级的 benefits.points_* 配置（来自 member_levels）
 *   - 提供"清理规则缓存"按钮（修改 DB 后立即生效）
 *   - 完整 system_configs CRUD 留给后续迭代
 */
const Rules: React.FC = () => {
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const res: any = await listLevels();
      if (res?.code === 200) setLevels(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  const handleClearCache = (levelId?: number) => {
    Modal.confirm({
      title: levelId ? `清理等级 #${levelId} 的规则缓存？` : '清理全部等级规则缓存？',
      content: '清理后下次请求会重新加载 member_levels.benefits 配置。',
      onOk: async () => {
        const res: any = await clearRuleCache(levelId);
        if (res?.code === 200) {
          message.success(`缓存已清理：${res.data?.levelId ?? '全部'}`);
        }
      },
    });
  };

  const columns = [
    { title: '等级 ID', dataIndex: 'id', width: 80 },
    { title: 'Code', dataIndex: 'code', width: 100 },
    { title: '名称', dataIndex: 'name', width: 100 },
    { title: 'Level', dataIndex: 'level', width: 80 },
    {
      title: '过期天数 (benefits.points_expire_days)',
      key: 'expireDays',
      render: (_: any, r: any) => r.benefits?.points_expire_days ?? '-',
    },
    {
      title: '成长倍率 (benefits.points_multiplier)',
      key: 'multiplier',
      render: (_: any, r: any) => r.benefits?.points_multiplier ?? '-',
    },
    {
      title: '操作',
      key: 'op',
      width: 200,
      render: (_: any, r: any) => (
        <AuthButton permCode="points:btn:ops:clear-cache">
          <Button size="small" icon={<ClearOutlined />} onClick={() => handleClearCache(r.id)}>
            清该等级缓存
          </Button>
        </AuthButton>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="积分规则配置说明"
        description={
          <>
            <div>
              1. 各等级积分规则存储于 <Tag>member_levels.benefits</Tag>，含 points_expire_days、points_multiplier 等。
            </div>
            <div>2. 修改请前往「会员管理 → 等级配置」，保存后回到本页点击「清理缓存」让配置即时生效。</div>
            <div>
              3. 全局积分系统配置（daily_cap_task / deduct_rate 等）位于 <Tag>system_configs</Tag>
              （暂无管理 UI，请直接 DB 操作）。
            </div>
          </>
        }
      />
      <Card
        title="等级规则一览"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchLevels}>
              刷新
            </Button>
            <AuthButton permCode="points:btn:ops:clear-cache">
              <Button type="primary" icon={<ClearOutlined />} onClick={() => handleClearCache()}>
                清空全部等级缓存
              </Button>
            </AuthButton>
          </Space>
        }
      >
        <Table rowKey="id" dataSource={levels} columns={columns} loading={loading} pagination={false} />
      </Card>
    </div>
  );
};

export default Rules;
