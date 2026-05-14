import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Space } from 'antd';
import KPICards from './components/KPICards';
import TrendChart from './components/TrendChart';
import SystemStatus from './components/SystemStatus';
import { getStatsOverview } from '@/services/dashboard';

const DashboardOverview: React.FC = () => {
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
    const timer = setInterval(fetchOverview, 300000); // 5分钟轮询
    return () => clearInterval(timer);
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await getStatsOverview();
      if (res?.data) setOverviewData(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer title="数据概览" subTitle="实时业务数据监控">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <KPICards data={overviewData} loading={loading} />
        <TrendChart />
        <SystemStatus />
      </Space>
    </PageContainer>
  );
};

export default DashboardOverview;
