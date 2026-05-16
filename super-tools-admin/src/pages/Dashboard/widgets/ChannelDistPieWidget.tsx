import React, { useEffect, useState } from 'react';
import { NotificationStatsApi } from '@/services/notification';
import dayjs from 'dayjs';

const COLORS: Record<string, string> = { in_app: '#52c41a', email: '#1890ff', sms: '#faad14' };

export default function ChannelDistPieWidget() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const params = { from: dayjs().subtract(30, 'day').toISOString(), to: dayjs().toISOString() };
    NotificationStatsApi.byChannel(params).then((r: any) => setData(r?.data || []));
  }, []);
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  return (
    <div>
      {data.map((d) => (
        <div key={d.channel} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[d.channel] || '#ccc', marginRight: 8 }} />
          <span style={{ flex: 1 }}>{d.channel}</span>
          <span>{d.total} ({((d.total / total) * 100).toFixed(0)}%)</span>
        </div>
      ))}
    </div>
  );
}
