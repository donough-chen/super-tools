import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Select, Tag, Space, Button, Spin, Progress } from 'antd';
import { ReloadOutlined, FireOutlined, BarChartOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import {
  getSnippetStatsOverview, getSnippetStatsTop, getSnippetStatsTrend,
  StatsOverview, StatsTopItem, StatsTrendItem,
} from '@/services/feedbackSnippet';
import './index.less';

const SnippetStatsPage: React.FC = () => {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [top, setTop] = useState<StatsTopItem[]>([]);
  const [trend, setTrend] = useState<StatsTrendItem[]>([]);
  const [days, setDays] = useState(30);
  const [topLimit, setTopLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, topRes, trendRes]: any = await Promise.all([
        getSnippetStatsOverview(),
        getSnippetStatsTop({ limit: topLimit }),
        getSnippetStatsTrend({ days }),
      ]);
      if (ovRes?.code === 200) setOverview(ovRes.data);
      if (topRes?.code === 200) setTop(topRes.data || []);
      if (trendRes?.code === 200) setTrend(trendRes.data || []);
    } finally { setLoading(false); }
  }, [days, topLimit]);

  useEffect(() => { load(); }, [load]);

  const trendConfig = {
    data: trend,
    xField: 'date',
    yField: 'usageCount',
    height: 280,
    point: { shapeField: 'circle', sizeField: 3 },
    smooth: true,
    label: undefined,
  };

  const topColumns = [
    {
      title: '排名', width: 70,
      render: (_: any, __: any, idx: number) => {
        const colors = ['#fa541c', '#fa8c16', '#faad14'];
        return (
          <Tag color={colors[idx] || 'default'} style={{ fontWeight: 600 }}>
            #{idx + 1}
          </Tag>
        );
      },
    },
    { title: 'Code', dataIndex: 'code', width: 140, ellipsis: true },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '分类', dataIndex: 'categoryName', width: 120,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : '-',
    },
    { title: '使用次数', dataIndex: 'usageCount', width: 90 },
    {
      title: '问题解决率', dataIndex: 'closeRate', width: 200,
      render: (v: number, row: StatsTopItem) => (
        <Space>
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            style={{ width: 100, marginBottom: 0 }}
            status={v >= 0.6 ? 'success' : v >= 0.3 ? 'normal' : 'exception'}
          />
          <span style={{ color: '#999', fontSize: 12 }}>
            {row.closedCount}/{row.logCount}
          </span>
        </Space>
      ),
    },
  ];

  return (
    <div className="snippet-stats-page">
      <div className="stats-toolbar">
        <Space>
          <span>趋势区间：</span>
          <Select
            value={days}
            style={{ width: 110 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
            ]}
            onChange={setDays}
          />
          <span style={{ marginLeft: 12 }}>Top 数量：</span>
          <Select
            value={topLimit}
            style={{ width: 90 }}
            options={[
              { label: 'Top 5', value: 5 },
              { label: 'Top 10', value: 10 },
              { label: 'Top 20', value: 20 },
            ]}
            onChange={setTopLimit}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      {/* 概览卡片 */}
      <Row gutter={16} className="overview-cards">
        <Col span={6}>
          <Card>
            <div className="stat-label">话术总数</div>
            <div>
              <span className="stat-value">{overview?.totalSnippets ?? '-'}</span>
              <span className="stat-suffix">条</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div className="stat-label">已发布话术</div>
            <div>
              <span className="stat-value">{overview?.activeSnippets ?? '-'}</span>
              <span className="stat-suffix">条</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div className="stat-label">本月使用次数</div>
            <div>
              <span className="stat-value">{overview?.monthUsage ?? '-'}</span>
              <span className="stat-suffix">次</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div className="stat-label">平均问题解决率</div>
            <div>
              <span className="stat-value">
                {overview ? `${Math.round(overview.avgCloseRate * 100)}` : '-'}
              </span>
              <span className="stat-suffix">%</span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card
        title={<Space><BarChartOutlined /> 使用趋势（近 {days} 天）</Space>}
        style={{ marginBottom: 16 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : trend.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
        ) : (
          <Line {...trendConfig} />
        )}
      </Card>

      {/* Top 排行 */}
      <Card
        title={<Space><FireOutlined style={{ color: '#fa541c' }} /> 热门话术 Top {topLimit}</Space>}
      >
        <Table
          rowKey="id"
          columns={topColumns}
          dataSource={top}
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default SnippetStatsPage;
