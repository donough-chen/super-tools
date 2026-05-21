import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Select, Spin, Space, Button, message } from 'antd';
import {
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import {
  getFeedbackStatsOverview,
  getFeedbackStatsTrend,
  FeedbackStatsOverview,
  FeedbackTrendItem,
} from '@/services/feedback';
import './index.less';

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug', suggestion: '建议', praise: '表扬', other: '其他',
};

const FeedbackStats: React.FC = () => {
  const [overview, setOverview] = useState<FeedbackStatsOverview | null>(null);
  const [trend, setTrend] = useState<FeedbackTrendItem[]>([]);
  const [days, setDays] = useState<number>(30);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res: any = await getFeedbackStatsOverview();
      if (res?.code === 200 && res.data) {
        setOverview(res.data);
      } else {
        message.error(res?.message || '加载概览失败');
      }
    } catch (e: any) {
      message.error(e?.message || '加载概览失败');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchTrend = useCallback(async (d: number) => {
    setLoadingTrend(true);
    try {
      const res: any = await getFeedbackStatsTrend({ days: d });
      if (res?.code === 200 && res.data?.items) {
        setTrend(res.data.items);
      }
    } catch (e: any) {
      message.error(e?.message || '加载趋势失败');
    } finally {
      setLoadingTrend(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchTrend(days); }, [days, fetchTrend]);

  const handleRefresh = () => {
    fetchOverview();
    fetchTrend(days);
  };

  // 折线图数据：将每日 submitted/replied/closed 转成 series 形式
  const trendData = trend.flatMap(item => [
    { date: item.date, value: item.submitted, type: '提交' },
    { date: item.date, value: item.replied, type: '回复' },
    { date: item.date, value: item.closed, type: '关闭' },
  ]);

  // 分类饼图
  const typeData = overview ? Object.entries(overview.byType)
    .map(([k, v]) => ({ type: TYPE_LABELS[k] || k, value: v }))
    .filter(d => d.value > 0) : [];

  // 状态饼图
  const statusData = overview ? [
    { status: '待处理', value: overview.pending },
    { status: '处理中', value: overview.processing },
    { status: '已回复', value: overview.replied },
    { status: '已关闭', value: overview.closed },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="feedback-stats-page">
      <Card
        title="反馈统计"
        extra={
          <Space>
            <Select
              value={days}
              onChange={setDays}
              style={{ width: 120 }}
              options={[
                { value: 7, label: '近 7 天' },
                { value: 30, label: '近 30 天' },
                { value: 90, label: '近 90 天' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          </Space>
        }
      >
        <Spin spinning={loadingOverview}>
          <Row gutter={16} className="stat-cards">
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="总反馈数"
                  value={overview?.total ?? 0}
                  prefix={<MessageOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="待处理"
                  value={overview?.pending ?? 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="今日新增"
                  value={overview?.todayNew ?? 0}
                  prefix={<PlusCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="平均回复时长"
                  value={overview?.avgReplyHours ?? 0}
                  suffix="小时"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Spin>

        <Card title="提交 / 回复 / 关闭 趋势" className="trend-chart" loading={loadingTrend}>
          {trendData.length > 0 ? (
            <Line
              data={trendData}
              xField="date"
              yField="value"
              colorField="type"
              shapeField="smooth"
              height={300}
              legend={{ color: { position: 'top' } }}
              axis={{ x: { labelAutoRotate: true } }}
            />
          ) : (
            <div className="empty-chart">暂无数据</div>
          )}
        </Card>

        <div className="charts-row">
          <Card title="分类分布" loading={loadingOverview}>
            {typeData.length > 0 ? (
              <Pie
                data={typeData}
                angleField="value"
                colorField="type"
                radius={0.85}
                height={260}
                label={{ text: 'type', position: 'outside' }}
                legend={{ color: { position: 'bottom' } }}
              />
            ) : (
              <div className="empty-chart">暂无数据</div>
            )}
          </Card>
          <Card title="状态分布" loading={loadingOverview}>
            {statusData.length > 0 ? (
              <Pie
                data={statusData}
                angleField="value"
                colorField="status"
                radius={0.85}
                height={260}
                label={{ text: 'status', position: 'outside' }}
                legend={{ color: { position: 'bottom' } }}
              />
            ) : (
              <div className="empty-chart">暂无数据</div>
            )}
          </Card>
        </div>
      </Card>
    </div>
  );
};

export default FeedbackStats;
