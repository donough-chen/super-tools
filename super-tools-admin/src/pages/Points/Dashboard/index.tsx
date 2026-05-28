import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Spin, Alert } from 'antd';
import { GiftOutlined, FireOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { getExpireStats, listReconcileSnapshots, ExpireStats } from '@/services/points';
import { getMemberStats } from '@/services/member';

/**
 * 积分管理 · 概览页
 *
 * 数据来源：
 *   - getExpireStats           → 总积分余额 / 7d / 30d / today expired
 *   - getMemberStats           → 会员总数（复用 member 模块）
 *   - listReconcileSnapshots   → 仅取 onlyAnomaly + pageSize=1 的 total，作为"对账异常用户数"
 */
const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [expire, setExpire] = useState<ExpireStats | null>(null);
  const [memberStats, setMemberStats] = useState<any>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [exp, ms, recon] = await Promise.all([
          getExpireStats(),
          getMemberStats(),
          listReconcileSnapshots({ onlyAnomaly: true, pageSize: 1 }),
        ]);
        if ((exp as any)?.code === 200) setExpire((exp as any).data);
        if ((ms as any)?.code === 200) setMemberStats((ms as any).data);
        if ((recon as any)?.code === 200) setAnomalyCount((recon as any).data?.total || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="会员总数"
                prefix={<GiftOutlined />}
                value={memberStats?.totalMembers || 0}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="积分总余额（待发放任务总池估算）"
                prefix={<FireOutlined />}
                value={expire?.total || 0}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="7 日内即将过期"
                prefix={<ClockCircleOutlined />}
                value={expire?.expiringIn7d || 0}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="对账异常用户数"
                prefix={<WarningOutlined />}
                value={anomalyCount}
                valueStyle={{ color: anomalyCount > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
        {anomalyCount > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`发现 ${anomalyCount} 条对账异常，请前往「运维中心 → 对账查询」处理`}
          />
        )}
      </Spin>
    </div>
  );
};

export default Dashboard;
