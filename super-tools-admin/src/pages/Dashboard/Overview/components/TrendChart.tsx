import React, { useState, useEffect } from 'react';
import { Card, Radio, Spin } from 'antd';
import { DualAxes } from '@ant-design/charts';
import { getStatsTrend } from '@/services/dashboard';

type Granularity = 'day' | 'week' | 'month';

const TrendChart: React.FC = () => {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any[]>([]);
  const [toolData, setToolData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [granularity]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, toolRes] = await Promise.all([
        getStatsTrend({ metric: 'user-register', granularity }),
        getStatsTrend({ metric: 'tool-access', granularity }),
      ]);
      const userPoints = userRes?.data?.points || [];
      const toolPoints = toolRes?.data?.points || [];
      setUserData(userPoints.map((p: any) => ({ date: p.date, value: p.count, type: '用户增长' })));
      setToolData(toolPoints.map((p: any) => ({ date: p.date, value: p.count, type: '工具使用' })));
    } finally {
      setLoading(false);
    }
  };

  const config = {
    xField: 'date',
    children: [
      {
        data: userData,
        type: 'line' as const,
        yField: 'value',
        style: { stroke: '#1890ff', lineWidth: 2 },
        axis: { y: { title: '用户增长', position: 'left' as const } },
      },
      {
        data: toolData,
        type: 'interval' as const,
        yField: 'value',
        style: { fill: '#ffc53d', fillOpacity: 0.6 },
        axis: { y: { title: '工具使用量', position: 'right' as const } },
      },
    ],
  };

  return (
    <Card
      title="数据趋势"
      extra={
        <Radio.Group
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          size="small"
        >
          <Radio.Button value="day">日</Radio.Button>
          <Radio.Button value="week">周</Radio.Button>
          <Radio.Button value="month">月</Radio.Button>
        </Radio.Group>
      }
      bordered={false}
    >
      <Spin spinning={loading}>
        <DualAxes {...config} height={350} />
      </Spin>
    </Card>
  );
};

export default TrendChart;
