import React, { useEffect, useState } from 'react';
import { NotificationStatsApi } from '@/services/notification';
import dayjs from 'dayjs';

export default function TopTypesWidget() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const params = { from: dayjs().subtract(30, 'day').toISOString(), to: dayjs().toISOString(), limit: 5 };
    NotificationStatsApi.byType(params).then((r: any) => setData(r?.data || []));
  }, []);
  if (!data.length) return <div style={{ color: '#999' }}>暂无数据</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div>
      {data.map((d) => (
        <div key={d.typeKey} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>{d.name}</span><span>{d.total}</span>
          </div>
          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${(d.total / max) * 100}%`, background: '#1890ff', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
