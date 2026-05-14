import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { Line, Bar, Pie } from '@ant-design/charts';
import { getToolUsage, getToolCategory, getStatsTrend } from '@/services/dashboard';

const ToolUsageTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [topTools, setTopTools] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendRes, topRes, catRes] = await Promise.all([
        getStatsTrend({ metric: 'tool-access', granularity: 'day' }),
        getToolUsage({ limit: 10 }),
        getToolCategory({}),
      ]);
      setTrendData(trendRes?.data?.points || []);
      setTopTools(topRes?.data || []);
      setCategoryData(catRes?.data?.categories || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="工具使用趋势 (近30天)" bordered={false}>
            <Line
              data={trendData.map((p: any) => ({ date: p.date, count: p.count }))}
              xField="date"
              yField="count"
              height={250}
              point={{ size: 3 }}
              style={{ stroke: '#fa8c16', lineWidth: 2 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="工具使用 TOP 10" bordered={false}>
            <Bar
              data={topTools.slice(0, 10).map((t: any) => ({
                name: t.toolName || t.toolCode,
                count: t.count,
              }))}
              xField="name"
              yField="count"
              height={300}
              colorField="name"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="分类使用占比" bordered={false}>
            {categoryData.length > 0 ? (
              <Pie
                data={categoryData}
                angleField="usageCount"
                colorField="name"
                innerRadius={0.6}
                height={300}
                label={{ text: 'name', position: 'outside' }}
              />
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无分类数据
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default ToolUsageTab;
