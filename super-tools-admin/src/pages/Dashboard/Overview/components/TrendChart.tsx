import React, { useState, useEffect } from 'react';
import { Card, Radio, Spin } from 'antd';
import { DualAxes } from '@ant-design/charts';
import { getStatsTrend } from '@/services/dashboard';

type MetricType = 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';

const TrendChart: React.FC = () => {
  const [metric, setMetric] = useState<MetricType>('user-register');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrend();
  }, [metric]);

  const fetchTrend = async () => {
    setLoading(true);
    try {
      const res = await getStatsTrend({ metric, granularity: 'day' });
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const config: any = {
    data: [data, data],
    xField: 'date',
    yField: ['value', 'count'],
    geometryOptions: [
      { geometry: 'line', smooth: true },
      { geometry: 'line', smooth: true, lineStyle: { lineDash: [5, 5] } },
    ],
  };

  return (
    <Card
      title="趋势图表"
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
        <DualAxes {...config} />
      </Spin>
    </Card>
  );
};

export default TrendChart;
