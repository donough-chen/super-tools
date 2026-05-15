/**
 * 预设布局模板
 * 每套模板包含一组预配置的 widget，用户可以一键应用然后微调
 */

export interface PresetWidget {
  widgetType: string;
  title: string;
  dataConfig: any;
  position: { x: number; y: number; w: number; h: number };
}

export interface PresetTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  widgets: PresetWidget[];
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: 'ceo',
    name: 'CEO 视角',
    description: '关注整体用户增长、会员转化和业务大盘',
    icon: '👔',
    widgets: [
      { widgetType: 'kpi_card', title: '核心指标概览', dataConfig: {}, position: { x: 0, y: 0, w: 12, h: 2 } },
      { widgetType: 'line_chart', title: '用户注册趋势', dataConfig: { metric: 'user-register' }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { widgetType: 'area_chart', title: '用户登录趋势', dataConfig: { metric: 'user-login' }, position: { x: 6, y: 2, w: 6, h: 4 } },
      { widgetType: 'pie_chart', title: '工具分类使用占比', dataConfig: {}, position: { x: 0, y: 6, w: 4, h: 4 } },
      { widgetType: 'gauge', title: '反馈完成率', dataConfig: {}, position: { x: 4, y: 6, w: 4, h: 4 } },
      { widgetType: 'ranking', title: '工具使用排行', dataConfig: {}, position: { x: 8, y: 6, w: 4, h: 4 } },
    ],
  },
  {
    key: 'ops',
    name: '运营视角',
    description: '聚焦用户活跃、工具使用和反馈处理',
    icon: '📊',
    widgets: [
      { widgetType: 'kpi_card', title: '运营核心指标', dataConfig: {}, position: { x: 0, y: 0, w: 12, h: 2 } },
      { widgetType: 'bar_chart', title: '工具使用 TOP 10', dataConfig: {}, position: { x: 0, y: 2, w: 6, h: 4 } },
      { widgetType: 'line_chart', title: '工具访问趋势', dataConfig: { metric: 'tool-access' }, position: { x: 6, y: 2, w: 6, h: 4 } },
      { widgetType: 'ranking', title: '热门工具排行', dataConfig: {}, position: { x: 0, y: 6, w: 4, h: 4 } },
      { widgetType: 'pie_chart', title: '分类分布', dataConfig: {}, position: { x: 4, y: 6, w: 4, h: 4 } },
      { widgetType: 'alert_list', title: '最新告警', dataConfig: {}, position: { x: 8, y: 6, w: 4, h: 4 } },
    ],
  },
  {
    key: 'tech',
    name: '技术视角',
    description: '关注系统健康、API 性能和告警',
    icon: '🔧',
    widgets: [
      { widgetType: 'kpi_card', title: '系统概览', dataConfig: {}, position: { x: 0, y: 0, w: 12, h: 2 } },
      { widgetType: 'line_chart', title: '反馈提交趋势', dataConfig: { metric: 'feedback-submit' }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { widgetType: 'gauge', title: '反馈完成率', dataConfig: {}, position: { x: 6, y: 2, w: 3, h: 4 } },
      { widgetType: 'table', title: '系统指标', dataConfig: {}, position: { x: 9, y: 2, w: 3, h: 4 } },
      { widgetType: 'alert_list', title: '活跃告警', dataConfig: {}, position: { x: 0, y: 6, w: 8, h: 4 } },
      { widgetType: 'text', title: '说明', dataConfig: { content: '技术看板：实时监控系统状态、API 健康和告警信息。可点击"编辑布局"自定义调整。' }, position: { x: 8, y: 6, w: 4, h: 4 } },
    ],
  },
];

export default PRESET_TEMPLATES;
