import React, { useState } from 'react';
import { Card, Tabs, Empty } from 'antd';
import UsersTab from './UsersTab';
import './index.less';

/**
 * 占位 PointsLogsTab，T10 替换为完整版
 */
const PointsLogsTabPlaceholder: React.FC<{ initialUserId?: number }> = ({ initialUserId }) => (
  <Empty description={`积分流水（T10 实现）${initialUserId ? ` - 预填 userId=${initialUserId}` : ''}`} />
);

const UsersPage: React.FC = () => {
  const [tab, setTab] = useState<'users' | 'logs'>(() => {
    const v = new URLSearchParams(window.location.search).get('tab');
    return v === 'logs' ? 'logs' : 'users';
  });
  const [userIdFilter, setUserIdFilter] = useState<number | undefined>(() => {
    const v = new URLSearchParams(window.location.search).get('userId');
    return v ? Number(v) : undefined;
  });

  const updateUrl = (nextTab: string, nextUserId?: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    if (nextUserId != null) {
      url.searchParams.set('userId', String(nextUserId));
    } else {
      url.searchParams.delete('userId');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleTabChange = (k: string) => {
    setTab(k as any);
    if (k !== 'logs') {
      // 切回用户 Tab 时清掉 userId 预填（保留 tab=users）
      setUserIdFilter(undefined);
      updateUrl(k);
    } else {
      updateUrl(k, userIdFilter);
    }
  };

  const handleJumpToLogs = (uid: number) => {
    setUserIdFilter(uid);
    setTab('logs');
    updateUrl('logs', uid);
  };

  return (
    <Card title="会员用户" className="page-member-users">
      <Tabs
        activeKey={tab}
        onChange={handleTabChange}
        items={[
          {
            key: 'users', label: '会员用户',
            children: <UsersTab onJumpToLogs={handleJumpToLogs} />,
          },
          {
            key: 'logs', label: '积分流水',
            children: <PointsLogsTabPlaceholder initialUserId={userIdFilter} />,
          },
        ]}
      />
    </Card>
  );
};

export default UsersPage;
