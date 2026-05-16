import React, { useEffect, useState } from 'react';
import { NotificationStatsApi } from '@/services/notification';
import dayjs from 'dayjs';

export default function SendTrend7dWidget() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const params = { from: dayjs().subtract(7, 'day').toISOString(), to: dayjs().toISOString(), granularity: 'day' };
    NotificationStatsApi.trend(params).then((r: any) => setData(r?.data || []));
  }, []);
  if (!data.length) return <div style={{ color: '#999' }}>暂无数据</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
      {data.map((d) => (
        <div key={d.ts} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', background: '#1890ff', borderRadius: 2, height: `${(d.total / max) * 48}px` }} />
          <span style={{ fontSize: 10, color: '#999' }}>{d.ts?.slice(5, 10)}</span>
        </div>
      ))}
    </div>
  );
}
