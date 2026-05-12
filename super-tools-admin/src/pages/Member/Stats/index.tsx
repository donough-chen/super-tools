import React, { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import {
  getMemberStats, listLevels,
  MemberStats, MemberLevel,
} from '@/services/member';
import StatCards from './StatCards';
import LevelDistribution from './LevelDistribution';
import './index.less';

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [levels, setLevels] = useState<MemberLevel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMemberStats(), listLevels()])
      .then(([s, l]: any[]) => {
        if (s?.code === 200) setStats(s.data);
        if (l?.code === 200) setLevels(l.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="会员统计" className="page-member-stats">
      <Spin spinning={loading}>
        <StatCards data={stats} />
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 12 }}>等级分布</h3>
          <LevelDistribution stats={stats} levels={levels} />
        </div>
      </Spin>
    </Card>
  );
};

export default StatsPage;
