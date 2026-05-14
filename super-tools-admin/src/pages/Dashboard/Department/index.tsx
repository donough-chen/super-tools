import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Row, Col, Select, Table, Spin, Empty, Space, Tag } from 'antd';
import { Column, Line } from '@ant-design/charts';
import {
  getDepartmentOverview,
  getDepartmentCompare,
  getDepartmentCollaboration,
} from '@/services/dashboard';

const { Option } = Select;

interface Department {
  roleId: number;
  roleName: string;
  roleCode: string;
  memberCount: number;
  activeRate: number;
  toolUsagePerCapita: number;
  paidMemberRate: number;
}

const DashboardDepartment: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [compareMetric, setCompareMetric] = useState('active');
  const [collaborationData, setCollaborationData] = useState<any[]>([]);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0) {
      fetchCompare();
      fetchCollaboration();
    }
  }, [selectedIds, compareMetric]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await getDepartmentOverview({});
      const depts = res?.data?.departments || [];
      setDepartments(depts);
      if (depts.length > 0) {
        setSelectedIds(depts.slice(0, 4).map((d: Department) => d.roleId));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCompare = async () => {
    if (selectedIds.length === 0) return;
    const res = await getDepartmentCompare({
      role_ids: selectedIds.join(','),
      metric: compareMetric,
    });
    const series = res?.data?.series || [];
    // 转为扁平格式用于图表
    const flat = series.flatMap((s: any) =>
      s.data.map((d: any) => ({ date: d.date, value: d.value, department: s.roleName }))
    );
    setCompareData(flat);
  };

  const fetchCollaboration = async () => {
    if (selectedIds.length === 0) return;
    const res = await getDepartmentCollaboration({ role_ids: selectedIds.join(',') });
    setCollaborationData(res?.data?.links || []);
  };

  // KPI 对比柱状图数据
  const barData = departments
    .filter(d => selectedIds.length === 0 || selectedIds.includes(d.roleId))
    .flatMap(d => [
      { department: d.roleName, metric: '活跃率(%)', value: d.activeRate },
      { department: d.roleName, metric: '人均工具使用', value: d.toolUsagePerCapita },
      { department: d.roleName, metric: '付费会员率(%)', value: d.paidMemberRate },
    ]);

  const columns = [
    { title: '部门', dataIndex: 'roleName', key: 'roleName' },
    { title: '人数', dataIndex: 'memberCount', key: 'memberCount', sorter: (a: any, b: any) => a.memberCount - b.memberCount },
    {
      title: '活跃率',
      dataIndex: 'activeRate',
      key: 'activeRate',
      sorter: (a: any, b: any) => a.activeRate - b.activeRate,
      render: (v: number) => <Tag color={v >= 50 ? 'green' : v >= 30 ? 'orange' : 'red'}>{v}%</Tag>,
    },
    {
      title: '人均工具使用',
      dataIndex: 'toolUsagePerCapita',
      key: 'toolUsagePerCapita',
      sorter: (a: any, b: any) => a.toolUsagePerCapita - b.toolUsagePerCapita,
    },
    {
      title: '付费会员率',
      dataIndex: 'paidMemberRate',
      key: 'paidMemberRate',
      sorter: (a: any, b: any) => a.paidMemberRate - b.paidMemberRate,
      render: (v: number) => `${v}%`,
    },
  ];

  return (
    <PageContainer title="部门视图" subTitle="按部门(角色)划分的数据对比分析">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 部门选择器 */}
        <Card bordered={false} size="small">
          <Space>
            <span>选择部门：</span>
            <Select
              mode="multiple"
              style={{ minWidth: 300 }}
              placeholder="选择要对比的部门"
              value={selectedIds}
              onChange={setSelectedIds}
              allowClear
            >
              {departments.map(d => (
                <Option key={d.roleId} value={d.roleId}>{d.roleName} ({d.memberCount}人)</Option>
              ))}
            </Select>
          </Space>
        </Card>

        {/* KPI 对比 */}
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title="部门 KPI 对比" bordered={false}>
              <Spin spinning={loading}>
                {barData.length > 0 ? (
                  <Column
                    data={barData}
                    xField="department"
                    yField="value"
                    colorField="metric"
                    group={true}
                    height={300}
                  />
                ) : (
                  <Empty description="暂无部门数据，请先创建部门角色" />
                )}
              </Spin>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="部门排行" bordered={false}>
              <Table
                dataSource={departments}
                columns={columns}
                rowKey="roleId"
                size="small"
                pagination={false}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        {/* 趋势对比 */}
        <Card
          title="部门趋势对比"
          bordered={false}
          extra={
            <Select value={compareMetric} onChange={setCompareMetric} size="small" style={{ width: 120 }}>
              <Option value="active">活跃人数</Option>
              <Option value="tool_usage">工具使用</Option>
            </Select>
          }
        >
          {compareData.length > 0 ? (
            <Line
              data={compareData}
              xField="date"
              yField="value"
              colorField="department"
              height={280}
            />
          ) : (
            <Empty description="选择部门后查看趋势对比" />
          )}
        </Card>

        {/* 跨部门协作 */}
        <Card title="跨部门协作（共同使用工具数）" bordered={false}>
          {collaborationData.length > 0 ? (
            <Table
              dataSource={collaborationData}
              columns={[
                { title: '部门A', dataIndex: 'source', key: 'source' },
                { title: '部门B', dataIndex: 'target', key: 'target' },
                {
                  title: '共同使用工具数',
                  dataIndex: 'sharedTools',
                  key: 'sharedTools',
                  sorter: (a: any, b: any) => a.sharedTools - b.sharedTools,
                  defaultSortOrder: 'descend' as const,
                },
              ]}
              rowKey={(r) => `${r.sourceId}-${r.targetId}`}
              size="small"
              pagination={false}
            />
          ) : (
            <Empty description="暂无跨部门协作数据" />
          )}
        </Card>
      </Space>
    </PageContainer>
  );
};

export default DashboardDepartment;
