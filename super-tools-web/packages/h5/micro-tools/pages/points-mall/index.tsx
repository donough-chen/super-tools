import React from 'react';
import { history } from 'umi';
import AppHeader from '../../components/AppHeader';

const PointsMallPage: React.FC = () => (
  <div style={{ minHeight: '100vh' }}>
    <AppHeader title="积分商城" showBack onBack={() => history.goBack()} />
    <div style={{ padding: '120px 32px', textAlign: 'center', color: '#999' }}>
      🚧 开发中 — Phase 5 实现
    </div>
  </div>
);
export default PointsMallPage;
