import React, { useState, useEffect } from 'react';
import { Statistic, Table, Tag, Spin, Empty } from 'antd';
import { Line, Column, Pie, Area, Gauge } from '@ant-design/charts';
import {
  getStatsOverview, getStatsTrend, getToolUsage, getToolCategory,
  getAlertSummary, getAlertLogs, getOperationEfficiency,
} from '@/services/dashboard';

interface WidgetRendererProps {
  widgetType: string;
  dataConfig: any;
  width?: number;
  height?: number;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widgetType, dataConfig }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWidgetData();
  }, [widgetType]);

  const fetchWidgetData = async () => {
    setLoading(true);
    try {
      switch (widgetType) {
        case 'kpi_card': {
          const res = await getStatsOverview();
          setData(res?.data);
          break;
        }
        case 'line_chart': {
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
        case 'area_chart': {
          const res = await getStatsTrend({ metric: 'user-login', granularity: 'day' });
          setData(res?.data?.points || []);
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

  switch (widgetType) {
    case 'kpi_card': {
      if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Statistic title="用户总数" value={data.userCount || 0} />
          <Statistic title="今日活跃" value={data.todayLoginCount || data.activeUserCount || 0} />
          <Statistic title="今日新增" value={data.todayNewUserCount || 0} />
        </div>
      );
    }
    case 'line_chart': {
      const chartData = Array.isArray(data) ? data : [];
      if (chartData.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />;
      return <Line data={chartData.map((p: any) => ({ date: p.date, count: p.count }))} xField="date" yField="count" smooth height={200} />;
    }
    case 'bar_chart': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return <Column data={data} xField="name" yField="count" height={200} />;
    }
    case 'pie_chart': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return <Pie data={data} angleField="value" colorField="name" innerRadius={0.6} height={200} label={{ text: 'name', position: 'outside' }} />;
    }
    case 'area_chart': {
      const chartData = Array.isArray(data) ? data : [];
      if (chartData.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return <Area data={chartData.map((p: any) => ({ date: p.date, count: p.count }))} xField="date" yField="count" height={200} />;
    }
    case 'gauge': {
      const percent = typeof data === 'number' ? data / 100 : 0;
      return <Gauge data={{ target: percent, total: 1, name: '完成率' }} height={200} />;
    }
    case 'alert_list': {
      const sevColors: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无告警" />;
      return (
        <Table
          dataSource={data} rowKey="id" size="small" pagination={false}
          columns={[
            { title: '严重度', dataIndex: 'severity', width: 80, render: (v: string) => <Tag color={sevColors[v]}>{v}</Tag> },
            { title: '规则', dataIndex: 'ruleName', ellipsis: true },
            { title: '时间', dataIndex: 'createdAt', width: 150, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
          ]}
        />
      );
    }
    case 'ranking': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return (
        <div>
          {data.map((item: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>
                <span style={{ display: 'inline-block', width: 20, fontWeight: 600, color: idx < 3 ? '#1890ff' : '#999' }}>{idx + 1}</span>
                {item.toolName || item.toolCode}
              </span>
              <span style={{ color: '#666' }}>{item.count}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'table': {
      if (!data?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
      return (
        <Table dataSource={data} rowKey="key" size="small" pagination={false}
          columns={[
            { title: '指标', dataIndex: 'metric' },
            { title: '值', dataIndex: 'value' },
          ]}
        />
      );
    }
    case 'text':
      return <div style={{ color: '#666', fontSize: 14, lineHeight: 1.8 }}>{data || '自定义文本'}</div>;
    default:
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`未知组件: ${widgetType}`} />;
  }
};

export default WidgetRenderer;
