import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { Line, Bar, Pie } from '@ant-design/charts';
import { getToolUsage, getToolCategory, getStatsTrend } from '@/services/dashboard';

const ToolUsageTab: React.FC = () => {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usageRes, catRes, trendRes] = await Promise.all([
        getToolUsage({ limit: 10 }),
        getToolCategory(),
        getStatsTrend({ metric: 'tool-access', granularity: 'day' }),
      ]);
      if (usageRes?.data) setUsageData(usageRes.data);
      if (catRes?.data) setCategoryData(catRes.data);
      if (trendRes?.data) setTrendData(trendRes.data);
    } finally {
      setLoading(false);
    }
  };

  const lineConfig: any = {
    data: trendData,
    xField: 'date',
    yField: 'value',
    smooth: true,
  };

  const barConfig: any = {
    data: usageData,
    xField: 'count',
    yField: 'name',
    seriesField: 'name',
  };

  const pieConfig: any = {
    data: categoryData,
    angleField: 'value',
    colorField: 'name',
    radius: 0.8,
    label: { type: 'outer' },
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="工具访问趋势">
            <Line {...lineConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Top 10 工具使用量">
            <Bar {...barConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="工具分类分布">
            <Pie {...pieConfig} />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default ToolUsageTab;
