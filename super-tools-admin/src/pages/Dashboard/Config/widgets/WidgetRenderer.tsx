import React, { useState, useEffect } from 'react';
import { Statistic, Table, Tag, Spin, Empty, Row, Col, Tooltip } from 'antd';
import {
  UserOutlined, ThunderboltOutlined, UserAddOutlined,
  ToolOutlined, CrownOutlined, MessageOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Line, Column, Pie, Area, Gauge } from '@ant-design/charts';
import {
  getStatsOverview, getStatsTrend, getToolUsage, getToolCategory,
  getAlertLogs, getOperationEfficiency,
} from '@/services/dashboard';

// ==================== 指标元数据 ====================

/** 趋势指标中文映射 */
const METRIC_LABELS: Record<string, { label: string; yLabel: string; color: string; desc: string }> = {
  'user-register': { label: '用户注册', yLabel: '注册人数', color: '#1890ff', desc: '每日新注册用户数量' },
  'user-login':    { label: '用户登录', yLabel: '登录次数', color: '#52c41a', desc: '每日登录成功次数' },
  'tool-access':   { label: '工具访问', yLabel: '访问次数', color: '#fa8c16', desc: '每日工具接口调用次数' },
  'feedback-submit': { label: '反馈提交', yLabel: '提交数量', color: '#722ed1', desc: '每日用户反馈提交量' },
};

/** KPI 卡片指标定义 */
const KPI_ITEMS = [
  { key: 'userCount',          label: '用户总数',     icon: <UserOutlined />,        color: '#1890ff', suffix: '人', desc: '系统注册用户总量' },
  { key: 'todayLoginCount',    label: '今日登录',     icon: <ThunderboltOutlined />, color: '#52c41a', suffix: '次', desc: '今日成功登录次数' },
  { key: 'todayNewUserCount',  label: '今日新增',     icon: <UserAddOutlined />,     color: '#722ed1', suffix: '人', desc: '今日新注册用户数' },
  { key: 'activeUserCount',    label: '7日活跃',      icon: <CrownOutlined />,       color: '#eb2f96', suffix: '人', desc: '近7日至少登录1次的用户' },
  { key: 'toolCount',          label: '工具数量',     icon: <ToolOutlined />,        color: '#fa8c16', suffix: '个', desc: '已上架工具总数' },
  { key: 'pendingFeedbackCount', label: '待处理反馈', icon: <MessageOutlined />,     color: '#f5222d', suffix: '条', desc: '尚未处理的用户反馈' },
];

/** 总览表格指标中文映射 */
const OVERVIEW_LABELS: Record<string, string> = {
  userCount: '用户总数',
  activeUserCount: '7日活跃用户',
  todayLoginCount: '今日登录次数',
  activeSessionCount: '当前在线会话',
  toolCount: '上架工具数',
  feedbackCount: '反馈总量',
  pendingFeedbackCount: '待处理反馈',
  todayNewUserCount: '今日新增用户',
};

/** 数据来源标签 */
const DataSource: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ fontSize: 11, color: '#bbb', marginTop: 4, textAlign: 'right' }}>
    <InfoCircleOutlined style={{ marginRight: 2 }} />{text}
  </div>
);

// ==================== 组件 ====================

interface WidgetRendererProps {
  widgetType: string;
  dataConfig: any;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widgetType, dataConfig }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWidgetData(); }, [widgetType, dataConfig?.metric]);

  const fetchWidgetData = async () => {
    setLoading(true);
    try {
      switch (widgetType) {
        case 'kpi_card': {
          const res = await getStatsOverview();
          setData(res?.data);
          break;
        }
        case 'line_chart':
        case 'area_chart': {
          const metric = dataConfig?.metric || 'user-register';
          const res = await getStatsTrend({ metric, granularity: 'day' });
          setData(res?.data?.points || []);
          break;
        }
        case 'bar_chart': {
          const res = await getToolUsage({ limit: 10 });
          const usage = Array.isArray(res?.data) ? res.data : [];
          setData(usage.map((t: any) => ({ name: t.toolName || t.toolCode, count: t.count })));
          break;
        }
        case 'pie_chart': {
          const res = await getToolCategory();
          const cats = res?.data?.categories || [];
          setData(cats.map((c: any) => ({ name: c.name, value: c.usageCount })));
          break;
        }
        case 'gauge': {
          const res = await getOperationEfficiency();
          setData(res?.data?.feedbackCompletion?.rate || 0);
          break;
        }
        case 'alert_list': {
          const res = await getAlertLogs({ pageSize: 5, status: 'firing' });
          setData(res?.data?.list || []);
          break;
        }
        case 'ranking': {
          const res = await getToolUsage({ limit: 5 });
          setData(Array.isArray(res?.data) ? res.data : []);
          break;
        }
        case 'table': {
          const res = await getStatsOverview();
          if (res?.data) {
            setData(Object.entries(res.data).map(([k, v]) => ({ key: k, metric: k, value: v })));
          }
          break;
        }
        case 'text':
          setData(dataConfig?.content || '自定义文本说明');
          break;
        default:
          setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="small" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }} />;

  const metric = dataConfig?.metric || 'user-register';
  const metricInfo = METRIC_LABELS[metric] || { label: metric, yLabel: '数量', color: '#1890ff', desc: '' };

  switch (widgetType) {
    // ---------- KPI 卡片 ----------
    case 'kpi_card': {
      if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return (
        <div>
          <Row gutter={[12, 8]}>
            {KPI_ITEMS.map(item => (
              <Col span={4} key={item.key}>
                <Tooltip title={item.desc}>
                  <Statistic
                    title={<span style={{ fontSize: 12 }}><span style={{ color: item.color, marginRight: 4 }}>{item.icon}</span>{item.label}</span>}
                    value={data[item.key] ?? 0}
                    suffix={<span style={{ fontSize: 12, color: '#999' }}>{item.suffix}</span>}
                    valueStyle={{ fontSize: 20, fontWeight: 600 }}
                  />
                </Tooltip>
              </Col>
            ))}
          </Row>
          <DataSource text="来源: 系统大盘统计 (stats/overview)" />
        </div>
      );
    }

    // ---------- 折线图 ----------
    case 'line_chart': {
      const chartData = Array.isArray(data) ? data : [];
      if (chartData.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${metricInfo.label}趋势数据`} />;
      return (
        <div>
          <Line
            data={chartData.map((p: any) => ({ 日期: p.date, [metricInfo.yLabel]: p.count }))}
            xField="日期" yField={metricInfo.yLabel}
            smooth height={180}
            color={metricInfo.color}
            point={{ size: 2 }}
            axis={{ y: { title: metricInfo.yLabel }, x: { title: '日期' } }}
          />
          <DataSource text={`来源: ${metricInfo.label}趋势 · ${metricInfo.desc} · 近30天日粒度`} />
        </div>
      );
    }

    // ---------- 面积图 ----------
    case 'area_chart': {
      const chartData = Array.isArray(data) ? data : [];
      if (chartData.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${metricInfo.label}数据`} />;
      return (
        <div>
          <Area
            data={chartData.map((p: any) => ({ 日期: p.date, [metricInfo.yLabel]: p.count }))}
            xField="日期" yField={metricInfo.yLabel}
            height={180}
            style={{ fill: metricInfo.color, fillOpacity: 0.3 }}
          />
          <DataSource text={`来源: ${metricInfo.label}趋势 · ${metricInfo.desc} · 近30天日粒度`} />
        </div>
      );
    }

    // ---------- 柱状图：工具使用 TOP 10 ----------
    case 'bar_chart': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工具使用数据" />;
      return (
        <div>
          <Column
            data={data}
            xField="name" yField="count"
            height={180}
            label={{ text: (d: any) => `${d.count}次`, position: 'inside' }}
            axis={{ x: { title: '工具名称' }, y: { title: '使用次数' } }}
          />
          <DataSource text="来源: 工具使用统计 (stats/tool-usage) · 按调用次数排序 TOP 10" />
        </div>
      );
    }

    // ---------- 饼图：工具分类分布 ----------
    case 'pie_chart': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工具分类数据" />;
      return (
        <div>
          <Pie
            data={data}
            angleField="value" colorField="name"
            innerRadius={0.6} height={180}
            label={{ text: (d: any) => `${d.name}: ${d.value}次`, position: 'outside' }}
          />
          <DataSource text="来源: 工具分类统计 (stats/tool-category) · 各分类工具调用量占比" />
        </div>
      );
    }

    // ---------- 仪表盘：反馈完成率 ----------
    case 'gauge': {
      const rate = typeof data === 'number' ? data : 0;
      const percent = rate / 100;
      return (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#f5222d' }}>
              {rate}%
            </span>
            <div style={{ fontSize: 12, color: '#999' }}>反馈处理完成率</div>
          </div>
          <Gauge data={{ target: percent, total: 1, name: '完成率' }} height={140} />
          <DataSource text="来源: 运营效率 (stats/operation-efficiency) · 已关闭反馈 / 反馈总量" />
        </div>
      );
    }

    // ---------- 告警列表 ----------
    case 'alert_list': {
      const sevColors: Record<string, string> = { critical: '严重', warning: '警告', info: '信息' };
      const sevTagColors: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前无活跃告警" />;
      return (
        <div>
          <Table
            dataSource={data} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '级别', dataIndex: 'severity', width: 70,
                render: (v: string) => <Tag color={sevTagColors[v]}>{sevColors[v] || v}</Tag> },
              { title: '告警规则', dataIndex: 'ruleName', ellipsis: true },
              { title: '触发时间', dataIndex: 'createdAt', width: 155,
                render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
            ]}
          />
          <DataSource text="来源: 告警记录 (alerts/logs) · 当前状态为 firing 的最新5条" />
        </div>
      );
    }

    // ---------- 排行榜：工具使用 TOP 5 ----------
    case 'ranking': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工具使用数据" />;
      const maxCount = data[0]?.count || 1;
      return (
        <div>
          {data.map((item: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%', marginRight: 8, fontSize: 12, fontWeight: 600,
                background: idx < 3 ? '#1890ff' : '#f0f0f0',
                color: idx < 3 ? '#fff' : '#999',
              }}>{idx + 1}</span>
              <span style={{ flex: 1 }}>{item.toolName || item.toolCode}</span>
              <div style={{ width: 80, marginRight: 8 }}>
                <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: idx < 3 ? '#1890ff' : '#d9d9d9', width: `${(item.count / maxCount) * 100}%` }} />
                </div>
              </div>
              <span style={{ color: '#666', fontSize: 12, minWidth: 40, textAlign: 'right' }}>{item.count}次</span>
            </div>
          ))}
          <DataSource text="来源: 工具使用统计 (stats/tool-usage) · 按调用量排序 TOP 5" />
        </div>
      );
    }

    // ---------- 数据表格：系统指标总览 ----------
    case 'table': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return (
        <div>
          <Table
            dataSource={data} rowKey="key" size="small" pagination={false}
            columns={[
              { title: '指标', dataIndex: 'metric',
                render: (v: string) => (
                  <Tooltip title={`字段名: ${v}`}>
                    <span>{OVERVIEW_LABELS[v] || v}</span>
                  </Tooltip>
                ),
              },
              { title: '当前值', dataIndex: 'value', align: 'right' as const,
                render: (v: any) => <span style={{ fontWeight: 600 }}>{v?.toLocaleString?.() ?? v}</span> },
            ]}
          />
          <DataSource text="来源: 系统大盘统计 (stats/overview) · 实时数据" />
        </div>
      );
    }

    // ---------- 文本 ----------
    case 'text':
      return <div style={{ color: '#555', fontSize: 14, lineHeight: 1.8, padding: '8px 0' }}>{data || '自定义文本'}</div>;

    default:
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`未知组件类型: ${widgetType}`} />;
  }
};

export default WidgetRenderer;
