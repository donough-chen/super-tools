import React, { useState } from 'react';
import {
  Form, InputNumber, Input, Select, Radio, Button, Alert, Tag, Space, Empty,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import {
  runPermissionTest, UserCheckResult, DENY_REASON_MAP,
} from '@/services/permission-test';

const UserCheckTab: React.FC = () => {
  const [queryType, setQueryType] = useState<'code' | 'api'>('code');
  const [userId, setUserId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [path, setPath] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canQuery = !!userId && (
    (queryType === 'code' && !!code) ||
    (queryType === 'api' && !!path)
  );

  const handleQuery = async () => {
    if (!canQuery || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { mode: 'user-check', userId };
      if (queryType === 'code') {
        params.code = code;
      } else {
        params.path = path;
        params.method = method;
      }
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
        value={queryType}
        onChange={(e) => setQueryType(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <Radio value="code">按权限码查</Radio>
        <Radio value="api">按 API 查</Radio>
      </Radio.Group>

      <Form layout="inline" onFinish={handleQuery}>
        <Form.Item label="用户 ID">
          <InputNumber
            value={userId ?? undefined}
            onChange={(v) => setUserId(v as number | null)}
            min={1}
          />
        </Form.Item>

        {queryType === 'code' ? (
          <Form.Item label="权限码">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如 tool:create"
              style={{ width: 200 }}
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item label="路径">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="例如 /api/admin/tools"
                style={{ width: 240 }}
              />
            </Form.Item>
            <Form.Item label="方法">
              <Select
                value={method}
                onChange={setMethod}
                style={{ width: 100 }}
                options={[
                  { value: 'GET' }, { value: 'POST' }, { value: 'PUT' }, { value: 'DELETE' },
                ]}
              />
            </Form.Item>
          </>
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

      {result && (
        result.allowed ? (
          <Alert
            style={{ marginTop: 16 }}
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="允许通过"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>命中角色：</strong>
                  {result.matchedRoles.length === 0
                    ? <Tag>无</Tag>
                    : result.matchedRoles.map((r) => (
                        <Tag key={r.id} color="green">{r.code}</Tag>
                      ))}
                </div>
                <div>
                  <strong>授予来源：</strong>
                  {result.matchedPermissions.map((p) => (
                    <Tag key={p.id}>{p.code} via {p.via}</Tag>
                  ))}
                </div>
              </Space>
            }
          />
        ) : (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            message="拒绝访问"
            description={
              <>
                <strong>原因：</strong>
                {result.denyReason
                  ? DENY_REASON_MAP[result.denyReason]
                  : '未知'}
              </>
            }
          />
        )
      )}
    </div>
  );
};

export default UserCheckTab;
