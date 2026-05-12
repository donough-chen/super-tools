import React from 'react';
import { Descriptions, Avatar, Tag, Empty } from 'antd';
import { User } from '@/services/user';
import { USER_TYPE_LABELS, USER_STATUS_LABELS, GENDER_LABELS } from '@/utils/userType';
import { formatDateTime } from '@/utils/format';

const BasicInfoTab: React.FC<{ user: User | null }> = ({ user }) => {
  if (!user) return <Empty description="暂无数据" />;
  return (
    <Descriptions column={2} bordered size="small">
      <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
      <Descriptions.Item label="UUID">
        <code style={{ fontSize: 12 }}>{user.uuid?.slice(0, 8)}...</code>
      </Descriptions.Item>
      <Descriptions.Item label="头像" span={2}>
        <Avatar src={user.avatar} size={48}>
          {!user.avatar && user.username?.[0]?.toUpperCase()}
        </Avatar>
      </Descriptions.Item>
      <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
      <Descriptions.Item label="昵称">{user.nickname || '-'}</Descriptions.Item>
      <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
      <Descriptions.Item label="手机">{user.phone || '-'}</Descriptions.Item>
      <Descriptions.Item label="用户类型">
        <Tag color={user.userType === 2 ? 'blue' : 'default'}>
          {USER_TYPE_LABELS[user.userType] || user.userType}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={user.status === 1 ? 'green' : 'red'}>
          {USER_STATUS_LABELS[user.status]}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="性别">{GENDER_LABELS[user.gender ?? 0]}</Descriptions.Item>
      <Descriptions.Item label="生日">{user.birthday || '-'}</Descriptions.Item>
      <Descriptions.Item label="注册来源">{user.registerSource || '-'}</Descriptions.Item>
      <Descriptions.Item label="注册 IP">{user.registerIp || '-'}</Descriptions.Item>
      <Descriptions.Item label="角色" span={2}>
        {user.roles?.length
          ? user.roles.map((r) => <Tag key={r.id}>{r.name}</Tag>)
          : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">{formatDateTime(user.createdAt)}</Descriptions.Item>
      <Descriptions.Item label="更新时间">{formatDateTime(user.updatedAt)}</Descriptions.Item>
    </Descriptions>
  );
};

export default BasicInfoTab;
