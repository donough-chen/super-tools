export interface WidgetDefinition {
  type: string;
  name: string;
  icon: string;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  description: string;
}

const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'kpi_card', name: 'KPI 指标卡片', icon: 'NumberOutlined',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    description: '展示单个关键业务指标',
  },
  {
    type: 'line_chart', name: '折线图', icon: 'LineChartOutlined',
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    description: '数据趋势展示',
  },
  {
    type: 'bar_chart', name: '柱状图', icon: 'BarChartOutlined',
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    description: '分类数据对比',
  },
  {
    type: 'pie_chart', name: '饼图', icon: 'PieChartOutlined',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    description: '占比分布展示',
  },
  {
    type: 'area_chart', name: '面积图', icon: 'AreaChartOutlined',
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    description: '累积趋势展示',
  },
  {
    type: 'table', name: '数据表格', icon: 'TableOutlined',
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    description: '结构化数据展示',
  },
  {
    type: 'gauge', name: '仪表盘', icon: 'DashboardOutlined',
    defaultSize: { w: 3, h: 3, minW: 2, minH: 2 },
    description: '进度/比率指示',
  },
  {
    type: 'ranking', name: '排行榜', icon: 'OrderedListOutlined',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    description: 'TOP N 排行展示',
  },
  {
    type: 'alert_list', name: '告警列表', icon: 'AlertOutlined',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    description: '最新告警信息',
  },
  {
    type: 'text', name: '文本说明', icon: 'FileTextOutlined',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 1 },
    description: '自定义说明文字',
  },
];

export default WIDGET_REGISTRY;
