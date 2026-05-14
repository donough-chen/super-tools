import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin } from 'antd';
import { Area, Heatmap } from '@ant-design/charts';
import { getUserRetention, getActiveHours, getUserGrowth } from '@/services/dashboard';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const UserBehavior: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [hoursData, setHoursData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [growthRes, retentionRes, hoursRes] = await Promise.all([
        getUserGrowth({ startDate: dateRange[0], endDate: dateRange[1] }),
        getUserRetention({ startDate: dateRange[0], endDate: dateRange[1] }),
        getActiveHours({ days: 7 }),
      ]);
      setGrowthData(growthRes?.data?.data || []);
      setRetentionData(retentionRes?.data?.cohorts || []);
      setHoursData(hoursRes?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  const DAY_NAMES: Record<number, string> = {
    1: '周日', 2: '周一', 3: '周二', 4: '周三', 5: '周四', 6: '周五', 7: '周六',
  };

  // 转换留存数据为热力图格式
  const retentionHeatmapData = retentionData.flatMap((cohort: any) =>
    [1, 3, 7, 14, 30].map((day) => ({
      cohortDate: cohort.date,
      day: `第${day}天`,
      value: cohort.retention?.[`day${day}`] || 0,
    }))
  );

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="新用户增长"
            extra={
              <RangePicker
                size="small"
                value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                  }
                }}
              />
            }
            bordered={false}
          >
            <Area
              data={growthData}
              xField="date"
              yField="count"
              colorField="source"
              stack={true}
              height={280}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="用户留存率" bordered={false}>
            {retentionHeatmapData.length > 0 ? (
              <Heatmap
                data={retentionHeatmapData}
                xField="cohortDate"
                yField="day"
                colorField="value"
                height={250}
              />
            ) : (
              <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无留存数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="活跃时段分布 (近7天)" bordered={false}>
            {hoursData.length > 0 ? (
              <Heatmap
                data={hoursData.map((d: any) => ({
                  hour: `${d.hour}:00`,
                  day: DAY_NAMES[d.dayOfWeek] || '',
                  value: d.activeUsers,
                }))}
                xField="hour"
                yField="day"
                colorField="value"
                height={250}
              />
            ) : (
              <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无活跃数据
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default UserBehavior;
