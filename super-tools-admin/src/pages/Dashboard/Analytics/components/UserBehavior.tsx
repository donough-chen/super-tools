import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin, Empty } from 'antd';
import { Area, Heatmap } from '@ant-design/charts';
import { getUserRetention, getActiveHours, getUserGrowth } from '@/services/dashboard';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DAY_NAMES: Record<number, string> = {
  1: '周日', 2: '周一', 3: '周二', 4: '周三', 5: '周四', 6: '周五', 7: '周六',
};

const UserBehavior: React.FC = () => {
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [activeData, setActiveData] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  useEffect(() => { fetchData(); }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange.map((d) => d.format('YYYY-MM-DD'));
      const [retRes, activeRes, growthRes] = await Promise.all([
        getUserRetention({ startDate, endDate }),
        getActiveHours({ days: 30 }),
        getUserGrowth({ startDate, endDate }),
      ]);

      // getUserRetention → { data: { cohorts: [...] } }
      const cohorts = retRes?.data?.cohorts || [];
      // 转为热力图扁平格式
      const heatmapData = cohorts.flatMap((c: any) =>
        [1, 3, 7, 14, 30].map(d => ({
          cohortDate: c.date,
          day: `第${d}天`,
          value: c.retention?.[`day${d}`] || 0,
        }))
      );
      setRetentionData(heatmapData);

      // getActiveHours → { data: { data: [...] } }
      const hours = activeRes?.data?.data || [];
      setActiveData(hours.map((d: any) => ({
        hour: `${d.hour}:00`,
        day: DAY_NAMES[d.dayOfWeek] || `${d.dayOfWeek}`,
        value: d.activeUsers,
      })));

      // getUserGrowth → { data: { data: [...] } }
      setGrowthData(growthRes?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <RangePicker
            value={dateRange}
            onChange={(vals: any) => vals && setDateRange(vals)}
          />
        </Col>
        <Col span={24}>
          <Card title="用户增长趋势" bordered={false}>
            {growthData.length > 0 ? (
              <Area data={growthData} xField="date" yField="count" colorField="source" stack={true} height={280} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="用户留存率" bordered={false}>
            {retentionData.length > 0 ? (
              <Heatmap data={retentionData} xField="cohortDate" yField="day" colorField="value" height={250} />
            ) : (
              <Empty description="暂无留存数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="活跃时段分布" bordered={false}>
            {activeData.length > 0 ? (
              <Heatmap data={activeData} xField="hour" yField="day" colorField="value" height={250} />
            ) : (
              <Empty description="暂无活跃数据" />
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default UserBehavior;
