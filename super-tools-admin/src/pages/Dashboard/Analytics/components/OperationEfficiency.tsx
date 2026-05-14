import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { Column, Funnel } from '@ant-design/charts';
import { getOperationEfficiency } from '@/services/dashboard';

const OperationEfficiency: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getOperationEfficiency({});
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const funnelData = data?.memberConversion
    ? [
        { stage: '注册用户', value: data.memberConversion.registered },
        { stage: '登录用户', value: data.memberConversion.loggedIn },
        { stage: '使用工具', value: data.memberConversion.usedTool },
        { stage: '付费会员', value: data.memberConversion.paidMember },
      ]
    : [];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card bordered={false}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="反馈完成率"
                  value={data?.feedbackCompletion?.rate || 0}
                  suffix="%"
                  valueStyle={{
                    color: (data?.feedbackCompletion?.rate || 0) >= 80 ? '#52c41a' : '#faad14',
                  }}
                />
              </Col>
              <Col span={8}>
                <Statistic title="总反馈数" value={data?.feedbackCompletion?.total || 0} />
              </Col>
              <Col span={8}>
                <Statistic title="已完成" value={data?.feedbackCompletion?.completed || 0} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="反馈响应时效 (按周)" bordered={false}>
            {(data?.feedbackResponse?.length || 0) > 0 ? (
              <Column
                data={data.feedbackResponse}
                xField="week"
                yField="avgHours"
                height={280}
                label={{ text: (d: any) => `${d.avgHours}h`, position: 'inside' }}
                style={{ fill: '#1890ff' }}
              />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无反馈数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="会员转化漏斗" bordered={false}>
            {funnelData.length > 0 && funnelData[0].value > 0 ? (
              <Funnel
                data={funnelData}
                xField="stage"
                yField="value"
                height={280}
              />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无转化数据
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default OperationEfficiency;
