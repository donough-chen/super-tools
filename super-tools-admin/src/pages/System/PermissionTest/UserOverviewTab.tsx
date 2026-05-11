import React, { useState } from 'react';
import {
  Form, InputNumber, Button, Card, Tag, Space, Alert, Empty,
} from 'antd';
import { runPermissionTest, UserOverviewResult } from '@/services/permission-test';

const UserOverviewTab: React.FC = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserOverviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await runPermissionTest({ mode: 'user-overview', userId });
      if (res?.code === 200) {
        setResult(res.data);
      } else {
        setError(res?.message || '查询失败');
      }
    } catch (e: any) {
      setError(e?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Form layout="inline" onFinish={handleQuery}>
        <Form.Item label="用户 ID">
          <InputNumber
            value={userId ?? undefined}
            onChange={(v) => setUserId(v as number | null)}
            placeholder="例如 1"
            min={1}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} disabled={!userId}>
            查询
          </Button>
        </Form.Item>
      </Form>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />
      )}

      {!result && !error && !loading && (
        <Empty description="请输入用户 ID 后查询" style={{ marginTop: 32 }} />
      )}

      {result && (
        <>
          <Card title="基本信息" size="small" style={{ marginTop: 16 }}>
            <Space wrap>
              <Tag>{result.user.username}</Tag>
              <Tag color={result.user.status === 1 ? 'green' : 'red'}>
                {result.user.status === 1 ? '启用' : '停用'}
              </Tag>
              {result.isSuperAdmin && <Tag color="purple">超级管理员</Tag>}
            </Space>
          </Card>

          <Card title={`角色 (${result.roles.length})`} size="small" style={{ marginTop: 12 }}>
            {result.roles.length === 0 ? (
              <Empty description="无角色" />
            ) : (
              <Space wrap>
                {result.roles.map((r) => (
                  <Tag key={r.id}>{r.code} ({r.name})</Tag>
                ))}
              </Space>
            )}
          </Card>

          <Card title="统计" size="small" style={{ marginTop: 12 }}>
            <Space wrap>
              <Tag>权限码总数：{result.stats.totalCodes}</Tag>
              <Tag>菜单总数：{result.stats.totalMenus}</Tag>
              {Object.entries(result.stats.byModule).map(([m, c]) => (
                <Tag key={m}>{m}: {c}</Tag>
              ))}
            </Space>
          </Card>

          <Card title={`全部权限码 (${result.permissionCodes.length})`} size="small" style={{ marginTop: 12 }}>
            <div className="perm-codes-list">
              {result.permissionCodes.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default UserOverviewTab;
