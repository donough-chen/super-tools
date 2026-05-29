import React from 'react';
import { history } from 'umi';
import AppHeader from '../../components/AppHeader';

const TasksPage: React.FC = () => (
  <div style={{ minHeight: '100vh' }}>
    <AppHeader title="任务中心" showBack onBack={() => history.goBack()} />
    <div style={{ padding: '120px 32px', textAlign: 'center', color: '#999' }}>
      🚧 开发中 — Phase 4 实现
    </div>
  </div>
);
export default TasksPage;
