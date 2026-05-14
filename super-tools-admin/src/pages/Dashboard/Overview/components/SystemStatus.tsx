import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Statistic, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getSystemStatus } from '@/services/dashboard';

interface StatusData {
  mysql: { status: 'ok' | 'error'; latency: number };
  redis: { status: 'ok' | 'error'; latency: number };
  api: { totalRequests: number; errorRequests: number; errorRate: number; avgResponseTime: number };
  activeSessionCount: number;
}

const SystemStatus: React.FC = () => {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getSystemStatus();
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const StatusTag: React.FC<{ status: 'ok' | 'error'; label: string; latency: number }> = ({
    status, label, latency,
  }) => (
    <Space>
      {status === 'ok' ? (
        <Tag icon={<CheckCircleOutlined />} color="success">{label}</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">{label}</Tag>
      )}
      <span style={{ fontSize: 12, color: '#999' }}>
        {latency >= 0 ? `${latency}ms` : '不可达'}
      </span>
    </Space>
  );

  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Card title="服务状态" size="small" loading={loading} bordered={false}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <StatusTag status={data?.mysql.status || 'ok'} label="MySQL" latency={data?.mysql.latency || 0} />
            <StatusTag status={data?.redis.status || 'ok'} label="Redis" latency={data?.redis.latency || 0} />
            <Statistic title="活跃会话" value={data?.activeSessionCount || 0} />
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={16}>
        <Card title="API 性能 (最近1小时)" size="small" loading={loading} bordered={false}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="平均响应" value={data?.api.avgResponseTime || 0} suffix="ms" />
            </Col>
            <Col span={6}>
              <Statistic
                title="错误率"
                value={data?.api.errorRate || 0}
                suffix="%"
                valueStyle={{ color: (data?.api.errorRate || 0) > 5 ? '#f5222d' : '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic title="总请求数" value={data?.api.totalRequests || 0} />
            </Col>
            <Col span={6}>
              <Statistic
                title="错误请求"
                value={data?.api.errorRequests || 0}
                valueStyle={{ color: (data?.api.errorRequests || 0) > 0 ? '#f5222d' : undefined }}
              />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default SystemStatus;
