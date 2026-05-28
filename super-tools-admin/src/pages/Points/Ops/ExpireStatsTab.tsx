import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Button, Space, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getExpireStats, ExpireStats } from '@/services/points';

/**
 * 过期统计 Tab
 *
 * 后端：GET /api/admin/points/expire/stats（perm: points:expire:stats）
 * 数据来源：points_logs（status=2 已过期）+ user_members.points 聚合
 */
const ExpireStatsTab: React.FC = () => {
  const [data, setData] = useState<ExpireStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res: any = await getExpireStats();
      if (res?.code === 200) setData(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Spin spinning={loading}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchStats}>
          刷新
        </Button>
      </Space>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="积分总余额" value={data?.total || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="7 日内过期"
              value={data?.expiringIn7d || 0}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="30 日内过期"
              value={data?.expiringIn30d || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日已过期"
              value={data?.expiredToday || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default ExpireStatsTab;
