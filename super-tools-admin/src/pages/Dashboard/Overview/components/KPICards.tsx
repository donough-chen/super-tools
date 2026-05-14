import React from 'react';
import { Card, Col, Row, Statistic, Tooltip } from 'antd';
import {
  UserOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  ToolOutlined,
  CrownOutlined,
  MessageOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';

interface KPIData {
  userCount?: number;
  activeUserCount?: number;
  todayNewUserCount?: number;
  toolCount?: number;
  pendingFeedbackCount?: number;
  todayLoginCount?: number;
}

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

const KPICards: React.FC<KPICardsProps> = ({ data, loading }) => {
  const cards = [
    {
      title: '用户总数',
      value: data?.userCount || 0,
      icon: <UserOutlined />,
      color: '#1890ff',
    },
    {
      title: '今日活跃',
      value: data?.todayLoginCount || 0,
      icon: <ThunderboltOutlined />,
      color: '#52c41a',
    },
    {
      title: '今日新增',
      value: data?.todayNewUserCount || 0,
      icon: <UserAddOutlined />,
      color: '#722ed1',
    },
    {
      title: '工具数量',
      value: data?.toolCount || 0,
      icon: <ToolOutlined />,
      color: '#fa8c16',
    },
    {
      title: '7日活跃用户',
      value: data?.activeUserCount || 0,
      icon: <CrownOutlined />,
      color: '#eb2f96',
    },
    {
      title: '待处理反馈',
      value: data?.pendingFeedbackCount || 0,
      icon: <MessageOutlined />,
      color: '#f5222d',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={12} sm={8} md={8} lg={4} key={card.title}>
          <Card loading={loading} size="small" bordered={false} hoverable>
            <Statistic
              title={
                <span>
                  <span style={{ color: card.color, marginRight: 8 }}>{card.icon}</span>
                  {card.title}
                </span>
              }
              value={card.value}
              valueStyle={{ fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default KPICards;
