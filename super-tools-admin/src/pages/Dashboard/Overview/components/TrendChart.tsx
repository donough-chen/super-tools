import React, { useState, useEffect } from 'react';
import { Card, Radio, Spin, Empty } from 'antd';
import { Line } from '@ant-design/charts';
import { getStatsTrend } from '@/services/dashboard';

type MetricType = 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';

const TrendChart: React.FC = () => {
  const [metric, setMetric] = useState<MetricType>('user-register');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchTrend(); }, [metric]);

  const fetchTrend = async () => {
    setLoading(true);
    try {
      const res = await getStatsTrend({ metric, granularity: 'day' });
      // API 返回 { data: { metric, granularity, points: [{ date, count }] } }
      const points = res?.data?.points || [];
      setData(points.map((p: any) => ({ date: p.date, count: p.count })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="数据趋势"
      bordered={false}
      extra={
        <Radio.Group value={metric} onChange={(e) => setMetric(e.target.value)} size="small">
          <Radio.Button value="user-register">注册</Radio.Button>
          <Radio.Button value="user-login">登录</Radio.Button>
          <Radio.Button value="tool-access">工具访问</Radio.Button>
          <Radio.Button value="feedback-submit">反馈</Radio.Button>
        </Radio.Group>
      }
    >
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <Line data={data} xField="date" yField="count" smooth={true} height={350} point={{ size: 3 }} />
        ) : (
          <Empty description="暂无趋势数据" style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        )}
      </Spin>
    </Card>
  );
};

export default TrendChart;
