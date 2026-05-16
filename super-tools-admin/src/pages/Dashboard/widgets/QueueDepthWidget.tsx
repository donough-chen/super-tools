import React, { useEffect, useState } from 'react';
import { Statistic, Row, Col } from 'antd';

export default function QueueDepthWidget() {
  const [depth, setDepth] = useState({ send: 0, export: 0 });
  useEffect(() => {
    // P3.4 will replace with real BullMQ getJobCounts API
    const timer = setInterval(() => {
      // mock: always 0 until P3.4 provides real endpoint
      setDepth({ send: 0, export: 0 });
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Row gutter={16}>
      <Col span={12}><Statistic title="发送队列" value={depth.send} suffix="jobs" /></Col>
      <Col span={12}><Statistic title="导出队列" value={depth.export} suffix="jobs" /></Col>
    </Row>
  );
}
