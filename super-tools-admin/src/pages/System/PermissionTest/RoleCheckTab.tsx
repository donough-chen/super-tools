import React, { useState } from 'react';
import {
  Form, Input, InputNumber, Radio, Button, Card, Tag, Tree, Space, Alert, Empty,
} from 'antd';
import { runPermissionTest, RoleCheckResult } from '@/services/permission-test';
import { toAntdTreeData } from '@/pages/System/_shared/treeUtils';

const RoleCheckTab: React.FC = () => {
  const [roleType, setRoleType] = useState<'code' | 'id'>('code');
  const [roleCode, setRoleCode] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoleCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canQuery = roleType === 'code' ? !!roleCode : !!roleId;

  const handleQuery = async () => {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { mode: 'role-check' };
      if (roleType === 'code') params.roleCode = roleCode;
      else params.roleId = roleId;

      const res: any = await runPermissionTest(params);
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
      <Radio.Group
        value={roleType}
        onChange={(e) => setRoleType(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <Radio value="code">按 roleCode</Radio>
        <Radio value="id">按 roleId</Radio>
      </Radio.Group>

      <Form layout="inline" onFinish={handleQuery}>
        {roleType === 'code' ? (
          <Form.Item label="角色编码">
            <Input
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              placeholder="例如 operator"
              style={{ width: 200 }}
            />
          </Form.Item>
        ) : (
          <Form.Item label="角色 ID">
            <InputNumber
              value={roleId ?? undefined}
              onChange={(v) => setRoleId(v as number | null)}
              min={1}
            />
          </Form.Item>
        )}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} disabled={!canQuery}>
            查询
          </Button>
        </Form.Item>
      </Form>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />
      )}

      {!result && !error && !loading && (
        <Empty description="填写参数后查询" style={{ marginTop: 32 }} />
      )}

      {result && !result.role && (
        <Alert type="warning" showIcon message="角色不存在" style={{ marginTop: 16 }} />
      )}

      {result && result.role && (
        <>
          <Card title={`角色：${result.role.name} (${result.role.code})`}
                size="small" style={{ marginTop: 16 }}>
            <Space>
              <Tag>角色 ID：{result.role.id}</Tag>
              <Tag color="blue">权限码总数：{result.permissionCount}</Tag>
              {(result as any).isSuperAdmin && (
                <Tag color="gold">超级管理员 — 中间件短路，自动拥有全部权限</Tag>
              )}
            </Space>
          </Card>

          {(result as any).isSuperAdmin && (
            <Alert
              type="info"
              showIcon
              message="超级管理员权限说明"
              description="super_admin 角色通过中间件短路获得所有权限，不依赖 role_permissions 表配置。下方展示的是系统中全部已注册的权限码。"
              style={{ marginTop: 12 }}
            />
          )}

          <Card title="权限矩阵（树形）" size="small" style={{ marginTop: 12 }}>
            {result.permissionTree.length === 0 ? (
              <Empty description="该角色暂无授权" />
            ) : (
              <Tree
                showLine
                defaultExpandAll
                selectable={false}
                treeData={toAntdTreeData(result.permissionTree)}
              />
            )}
          </Card>

          <Card title={`影响面：绑定该角色的用户 (${result.totalAffectedCount})`}
                size="small" style={{ marginTop: 12 }}>
            {result.affectedUsers.length === 0 ? (
              <Empty description="暂无用户绑定" />
            ) : (
              <Space wrap>
                {result.affectedUsers.map((u) => (
                  <Tag key={u.id}>{u.username}</Tag>
                ))}
                {result.totalAffectedCount > result.affectedUsers.length && (
                  <Tag color="default">
                    ... 还有 {result.totalAffectedCount - result.affectedUsers.length} 个未展示
                  </Tag>
                )}
              </Space>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default RoleCheckTab;
