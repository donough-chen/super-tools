import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin } from 'antd';
import { Area, Heatmap } from '@ant-design/charts';
import { getUserRetention, getActiveHours, getUserGrowth } from '@/services/dashboard';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const UserBehavior: React.FC = () => {
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [activeData, setActiveData] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange.map((d) => d.format('YYYY-MM-DD'));
      const [retRes, activeRes, growthRes] = await Promise.all([
        getUserRetention({ startDate, endDate }),
        getActiveHours({ days: 30 }),
        getUserGrowth({ startDate, endDate }),
      ]);
      if (retRes?.data) setRetentionData(retRes.data);
      if (activeRes?.data) setActiveData(activeRes.data);
      if (growthRes?.data) setGrowthData(growthRes.data);
    } finally {
      setLoading(false);
    }
  };

  const areaConfig: any = {
    data: growthData,
    xField: 'date',
    yField: 'count',
    smooth: true,
  };

  const heatmapConfig: any = {
    data: activeData,
    xField: 'hour',
    yField: 'day',
    colorField: 'value',
    color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
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
          <Card title="用户增长趋势">
            <Area {...areaConfig} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="活跃时段热力图">
            <Heatmap {...heatmapConfig} />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default UserBehavior;
