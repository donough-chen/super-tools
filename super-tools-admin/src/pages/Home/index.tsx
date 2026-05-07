import React from 'react';
import { Card, Typography, Row, Col, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title } = Typography;

/** 首页 */
const Home: React.FC = () => {
  return (
    <div>
      <Title level={3}>欢迎使用 Super Tools 管理端</Title>
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="用户总数" value={0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="角色数" value={0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="权限数" value={0} prefix={<SafetyCertificateOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
