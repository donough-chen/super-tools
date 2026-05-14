import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Empty } from 'antd';
import { Line, Bar, Pie } from '@ant-design/charts';
import { getToolUsage, getToolCategory, getStatsTrend } from '@/services/dashboard';

const ToolUsageTab: React.FC = () => {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usageRes, catRes, trendRes] = await Promise.all([
        getToolUsage({ limit: 10 }),
        getToolCategory(),
        getStatsTrend({ metric: 'tool-access', granularity: 'day' }),
      ]);

      // getToolUsage → { data: [{ toolCode, toolName, count }] }
      const usage = Array.isArray(usageRes?.data) ? usageRes.data : [];
      setUsageData(usage.map((t: any) => ({ name: t.toolName || t.toolCode, count: t.count })));

      // getToolCategory → { data: { categories: [{ name, usageCount, percentage }] } }
      const cats = catRes?.data?.categories || [];
      setCategoryData(cats.map((c: any) => ({ name: c.name, value: c.usageCount })));

      // getStatsTrend → { data: { metric, granularity, points: [{ date, count }] } }
      const points = trendRes?.data?.points || [];
      setTrendData(points.map((p: any) => ({ date: p.date, value: p.count })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="工具访问趋势" bordered={false}>
            {trendData.length > 0 ? (
              <Line data={trendData} xField="date" yField="value" smooth={true} height={250} />
            ) : (
              <Empty description="暂无趋势数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Top 10 工具使用量" bordered={false}>
            {usageData.length > 0 ? (
              <Bar data={usageData} xField="name" yField="count" colorField="name" height={300} />
            ) : (
              <Empty description="暂无使用数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="工具分类分布" bordered={false}>
            {categoryData.length > 0 ? (
              <Pie data={categoryData} angleField="value" colorField="name" innerRadius={0.6} height={300}
                   label={{ text: 'name', position: 'outside' }} />
            ) : (
              <Empty description="暂无分类数据" />
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default ToolUsageTab;
