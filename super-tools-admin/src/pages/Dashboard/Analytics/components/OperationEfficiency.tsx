import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { Column, Funnel } from '@ant-design/charts';
import { getOperationEfficiency } from '@/services/dashboard';

const OperationEfficiency: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getOperationEfficiency();
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const columnConfig: any = {
    data: data?.daily || [],
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
  };

  const funnelConfig: any = {
    data: data?.funnel || [],
    xField: 'stage',
    yField: 'value',
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic title="平均处理时间" value={data?.avgProcessTime || '-'} suffix="小时" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="今日处理量" value={data?.todayProcessed || 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="完成率" value={data?.completionRate || 0} suffix="%" />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="每日处理量">
            <Column {...columnConfig} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="转化漏斗">
            <Funnel {...funnelConfig} />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default OperationEfficiency;
