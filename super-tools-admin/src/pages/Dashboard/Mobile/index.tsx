import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Space, List, Button, Spin } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, UserOutlined, ToolOutlined,
  MessageOutlined, BarChartOutlined, AlertOutlined, BellOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { getMobileSummary } from '@/services/dashboard';
import { history } from 'umi';
import './index.less';

const iconMap: Record<string, React.ReactNode> = {
  UserOutlined: <UserOutlined />,
  ToolOutlined: <ToolOutlined />,
  MessageOutlined: <MessageOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  AlertOutlined: <AlertOutlined />,
};

const severityColors: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };

const DashboardMobile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMobileSummary();
      if (res?.data) setData(res.data);
    } finally { setLoading(false); }
  };

  if (loading && !data) return <Spin style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }} />;

  const kpis = data?.kpis || [];
  const alerts = data?.latestAlerts || [];
  const quickLinks = data?.quickLinks || [];
  const hourlyData = data?.todayVsYesterday || [];

  return (
    <div className="mobile-dashboard">
      {/* Header */}
      <div className="mobile-header">
        <h2>Super Tools 管理后台</h2>
        <BellOutlined style={{ fontSize: 20 }} onClick={() => history.push('/dashboard/alerts')} />
      </div>

      {/* KPI 卡片 */}
      <Row gutter={[8, 8]} className="mobile-kpi-grid">
        {kpis.map((kpi: any) => (
          <Col span={8} key={kpi.key}>
            <Card size="small" bordered={false} className="mobile-kpi-card">
              <Statistic
                title={<span className="mobile-kpi-title">{kpi.label}</span>}
                value={kpi.value}
                valueStyle={{ fontSize: 20, fontWeight: 600 }}
                suffix={
                  kpi.change !== undefined && kpi.change !== 0 ? (
                    <span style={{ fontSize: 11, color: kpi.trend === 'up' ? '#52c41a' : '#f5222d' }}>
                      {kpi.trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {Math.abs(kpi.change)}%
                    </span>
                  ) : null
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 今日 vs 昨日 登录对比 */}
      {hourlyData.length > 0 && (
        <Card size="small" bordered={false} title="登录次数对比（今日 vs 昨日）" className="mobile-chart-card">
          <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
            按小时统计的用户登录次数，对比今日与昨日同时段数据
          </div>
          <Line
            data={[
              ...hourlyData.map((d: any) => ({ hour: d.hour, count: d.today, day: '今日' })),
              ...hourlyData.map((d: any) => ({ hour: d.hour, count: d.yesterday, day: '昨日' })),
            ]}
            xField="hour"
            yField="count"
            colorField="day"
            height={160}
            smooth
            axis={{ y: { title: '登录次数' }, x: { title: '时段' } }}
          />
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4, textAlign: 'right' }}>
            数据来源: 登录日志按小时聚合
          </div>
        </Card>
      )}

      {/* 最新告警 */}
      <Card
        size="small" bordered={false}
        title={<span><AlertOutlined /> 最新告警 ({alerts.length})</span>}
        extra={<Button type="link" size="small" onClick={() => history.push('/dashboard/alerts')}>查看更多</Button>}
        className="mobile-alert-card"
      >
        {alerts.length > 0 ? (
          <List
            size="small"
            dataSource={alerts}
            renderItem={(item: any) => (
              <List.Item>
                <Tag color={severityColors[item.severity]} style={{ marginRight: 8 }}>{item.severity}</Tag>
                <span className="mobile-alert-text">{item.conditionDesc || item.ruleDame}</span>
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无告警</div>
        )}
      </Card>

      {/* 快捷操作 */}
      <Card size="small" bordered={false} title="快捷操作" className="mobile-quick-links">
        <Row gutter={[12, 12]}>
          {quickLinks.map((link: any) => (
            <Col span={8} key={link.key}>
              <Button
                type="default"
                block
                size="large"
                icon={iconMap[link.icon]}
                onClick={() => history.push(link.path)}
                className="mobile-quick-btn"
              >
                {link.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default DashboardMobile;
