import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { UserOutlined, CrownOutlined, RiseOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { MemberStats } from '@/services/member';

interface Props {
  data: MemberStats | null;
}

const StatCards: React.FC<Props> = ({ data }) => {
  const totalMembers = data?.totalMembers ?? 0;
  const paidMembers = data?.paidMembers ?? 0;
  const paidRate = data?.paidRate ?? 0;
  const todayNewMembers = data?.todayNewMembers ?? 0;

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总会员"
            value={totalMembers}
            prefix={<UserOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="付费会员"
            value={paidMembers}
            prefix={<CrownOutlined style={{ color: '#faad14' }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="付费率"
            value={(paidRate * 100).toFixed(2)}
            suffix="%"
            prefix={<RiseOutlined />}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="今日新增"
            value={todayNewMembers}
            prefix={<PlusCircleOutlined style={{ color: '#1890ff' }} />}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatCards;
