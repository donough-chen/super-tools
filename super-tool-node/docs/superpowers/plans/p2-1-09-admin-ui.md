# P2.1-09：Admin UI（RateLimit / Channels）（Task 9）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 8（[`p2-1-08-admin-api.md`](./p2-1-08-admin-api.md)）

---

## Step 1: 修改 `super-tools-admin/config/routes/modules/notification.ts`

- [ ] 在 routes 数组追加：

```typescript
{
  path: '/notification/configs',
  name: 'configs',
  access: 'canViewNotificationConfig',
  routes: [
    { path: '/notification/configs/rate-limit',
      name: 'rate-limit',
      component: '@/pages/Notification/Configs/RateLimit',
      access: 'canViewNotificationConfig' },
    { path: '/notification/configs/channels',
      name: 'channels',
      component: '@/pages/Notification/Configs/Channels',
      access: 'canViewNotificationConfig' },
  ],
},
```

- [ ] 在 `src/access.ts` 追加：

```typescript
canViewNotificationConfig: has('notification:config:view'),
canEditNotificationConfig: has('notification:config:edit'),
```

- [ ] 在 `src/pages/Notification/_shared/permCodes.ts` 追加：

```typescript
CONFIG_VIEW: 'notification:config:view',
CONFIG_EDIT: 'notification:config:edit',
```

---

## Step 2: 扩展 `src/services/notification.ts`

- [ ] 追加：

```typescript
import { request } from 'umi';

export const NotificationConfigApi = {
  // 频控
  listRateLimits: (params: any) => request('/api/admin/notification/rate-limits', { params }),
  createRateLimit: (data: any) => request('/api/admin/notification/rate-limits', { method: 'POST', data }),
  updateRateLimit: (id: number, data: any) => request(`/api/admin/notification/rate-limits/${id}`, { method: 'PUT', data }),
  deleteRateLimit: (id: number) => request(`/api/admin/notification/rate-limits/${id}`, { method: 'DELETE' }),

  // 渠道
  listChannels: () => request('/api/admin/notification/channels'),
  updateChannel: (id: number, data: any) => request(`/api/admin/notification/channels/${id}`, { method: 'PUT', data }),
  testChannel: (id: number, data: { to: string }) => request(`/api/admin/notification/channels/${id}/test`, { method: 'POST', data }),
  setDefaultChannel: (id: number) => request(`/api/admin/notification/channels/${id}/set-default`, { method: 'POST' }),
};
```

---

## Step 3: RateLimit 页面 `src/pages/Notification/Configs/RateLimit/index.tsx`

```tsx
import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table';
import { Button, Switch, Tag, Popconfirm, message, Space } from 'antd';
import { Access, useAccess } from 'umi';
import { NotificationConfigApi } from '@/services/notification';
import RuleFormModal from './RuleFormModal';

const SCOPE_LABEL: Record<string, string> = {
  user_type: '用户·类型',
  user_global: '用户·全局',
  global: '全站',
  channel: '渠道',
};

export default function RateLimitPage() {
  const ref = useRef<ActionType>();
  const access = useAccess();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const columns: ProColumns[] = [
    { dataIndex: 'id', title: 'ID', width: 60 },
    { dataIndex: 'scope', title: '范围', valueEnum: SCOPE_LABEL, width: 120 },
    { dataIndex: 'typeId', title: 'TypeID', width: 80 },
    { dataIndex: 'channel', title: '渠道', width: 80 },
    { dataIndex: 'windowSeconds', title: '窗口(秒)', width: 100 },
    { dataIndex: 'maxCount', title: '上限', width: 80 },
    { dataIndex: 'enabled', title: '启用', width: 80,
      render: (_, row: any) => <Switch checked={row.enabled === 1} disabled /> },
    { dataIndex: 'description', title: '描述', ellipsis: true },
    { title: '操作', width: 160, valueType: 'option',
      render: (_, row) => [
        <Access key="edit" accessible={access.canEditNotificationConfig}>
          <a onClick={() => { setEditing(row); setOpen(true); }}>编辑</a>
        </Access>,
        <Access key="del" accessible={access.canEditNotificationConfig}>
          <Popconfirm title="确定删除？" onConfirm={async () => {
            await NotificationConfigApi.deleteRateLimit(row.id);
            message.success('已删除');
            ref.current?.reload();
          }}><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm>
        </Access>,
      ],
    },
  ];

  return (
    <PageContainer header={{ title: '频控规则' }}>
      <ProTable
        actionRef={ref}
        columns={columns}
        rowKey="id"
        request={async (params) => {
          const r = await NotificationConfigApi.listRateLimits({
            scope: params.scope, enabled: params.enabled,
          });
          return { data: r.list, success: true };
        }}
        toolBarRender={() => [
          <Access key="add" accessible={access.canEditNotificationConfig}>
            <Button type="primary" onClick={() => { setEditing(null); setOpen(true); }}>
              新建规则
            </Button>
          </Access>,
        ]}
        search={false}
      />
      <RuleFormModal
        open={open}
        editing={editing}
        onClose={() => setOpen(false)}
        onOk={() => { setOpen(false); ref.current?.reload(); }}
      />
    </PageContainer>
  );
}
```

---

## Step 4: `RuleFormModal.tsx`

```tsx
import React, { useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Input, message, Switch } from 'antd';
import { NotificationConfigApi } from '@/services/notification';

export default function RuleFormModal(props: {
  open: boolean;
  editing: any;
  onClose: () => void;
  onOk: () => void;
}) {
  const [form] = Form.useForm();
  const isEdit = !!props.editing;

  useEffect(() => {
    if (props.open) {
      form.resetFields();
      if (props.editing) form.setFieldsValue(props.editing);
    }
  }, [props.open, props.editing, form]);

  const onSubmit = async () => {
    const v = await form.validateFields();
    if (isEdit) {
      await NotificationConfigApi.updateRateLimit(props.editing.id, v);
      message.success('已更新');
    } else {
      await NotificationConfigApi.createRateLimit(v);
      message.success('已创建');
    }
    props.onOk();
  };

  return (
    <Modal
      title={isEdit ? '编辑频控规则' : '新建频控规则'}
      open={props.open}
      onCancel={props.onClose}
      onOk={onSubmit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ enabled: 1 }}>
        <Form.Item name="scope" label="范围" rules={[{ required: true }]}>
          <Select options={[
            { value: 'user_type', label: '用户·类型（typeId 必填）' },
            { value: 'user_global', label: '用户·全局' },
            { value: 'global', label: '全站' },
            { value: 'channel', label: '渠道（channel 必填）' },
          ]} />
        </Form.Item>
        <Form.Item shouldUpdate noStyle>
          {() => {
            const scope = form.getFieldValue('scope');
            return (
              <>
                {scope === 'user_type' && (
                  <Form.Item name="typeId" label="TypeID" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                )}
                {scope === 'channel' && (
                  <Form.Item name="channel" label="渠道" rules={[{ required: true }]}>
                    <Select options={[
                      { value: 'inApp', label: '站内信' },
                      { value: 'email', label: '邮件' },
                      { value: 'sms', label: '短信' },
                    ]} />
                  </Form.Item>
                )}
              </>
            );
          }}
        </Form.Item>
        <Form.Item name="windowSeconds" label="统计窗口（秒）" rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="maxCount" label="窗口内最大次数" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"
                   getValueFromEvent={(c) => (c ? 1 : 0)}>
          <Switch defaultChecked />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

---

## Step 5: Channels 页面 `src/pages/Notification/Configs/Channels/index.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Table, Tag, Button, Space, message } from 'antd';
import { Access, useAccess } from 'umi';
import { NotificationConfigApi } from '@/services/notification';
import ChannelFormDrawer from './ChannelFormDrawer';
import SmtpTestButton from './SmtpTestButton';

export default function ChannelsPage() {
  const access = useAccess();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await NotificationConfigApi.listChannels();
      setList(r.list);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  const setDefault = async (row: any) => {
    await NotificationConfigApi.setDefaultChannel(row.id);
    message.success('已设为默认');
    reload();
  };

  return (
    <PageContainer header={{ title: '渠道服务商' }}>
      <Table
        dataSource={list}
        loading={loading}
        rowKey="id"
        columns={[
          { dataIndex: 'channel', title: '渠道', width: 80 },
          { dataIndex: 'provider', title: '服务商', width: 100 },
          { dataIndex: 'isDefault', title: '默认', width: 80,
            render: (v: number) => v ? <Tag color="green">默认</Tag> : null },
          { dataIndex: 'enabled', title: '启用', width: 80,
            render: (v: number) => v ? <Tag color="blue">启用</Tag> : <Tag>停用</Tag> },
          { dataIndex: 'lastHealthOk', title: '最近健康', width: 100,
            render: (v: number | null, row: any) => {
              if (v == null) return '-';
              return v
                ? <Tag color="green">OK ({row.lastHealthAt})</Tag>
                : <Tag color="red">FAIL ({row.lastHealthAt})</Tag>;
            } },
          { dataIndex: 'description', title: '描述', ellipsis: true },
          { title: '操作', width: 280,
            render: (_, row: any) => (
              <Space>
                <Access accessible={access.canEditNotificationConfig}>
                  <a onClick={() => setEditing(row)}>编辑</a>
                </Access>
                {row.channel === 'email' && (
                  <Access accessible={access.canEditNotificationConfig}>
                    <SmtpTestButton row={row} />
                  </Access>
                )}
                {!row.isDefault && (
                  <Access accessible={access.canEditNotificationConfig}>
                    <a onClick={() => setDefault(row)}>设为默认</a>
                  </Access>
                )}
              </Space>
            ),
          },
        ]}
        pagination={false}
      />
      <ChannelFormDrawer
        editing={editing}
        onClose={() => setEditing(null)}
        onOk={() => { setEditing(null); reload(); }}
      />
    </PageContainer>
  );
}
```

---

## Step 6: `ChannelFormDrawer.tsx`（SMTP 字段）

```tsx
import React, { useEffect } from 'react';
import { Drawer, Form, Input, InputNumber, Switch, Button, Space, message } from 'antd';
import { NotificationConfigApi } from '@/services/notification';

export default function ChannelFormDrawer(props: {
  editing: any;
  onClose: () => void;
  onOk: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (props.editing) {
      form.setFieldsValue({
        ...props.editing,
        ...(props.editing.config || {}),
      });
    } else {
      form.resetFields();
    }
  }, [props.editing, form]);

  if (!props.editing) return null;

  const onSubmit = async () => {
    const v = await form.validateFields();
    const { description, enabled, ...cfg } = v;
    await NotificationConfigApi.updateChannel(props.editing.id, {
      description, enabled,
      config: cfg, // host/port/secure/pool/maxConnections/auth_user/auth_pass
    });
    message.success('已更新');
    props.onOk();
  };

  const isEmail = props.editing.channel === 'email';

  return (
    <Drawer
      title={`编辑渠道：${props.editing.channel}/${props.editing.provider}`}
      open={!!props.editing}
      onClose={props.onClose}
      width={520}
      extra={<Space>
        <Button onClick={props.onClose}>取消</Button>
        <Button type="primary" onClick={onSubmit}>保存</Button>
      </Space>}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="enabled" label="启用" valuePropName="checked"
                   getValueFromEvent={(c) => (c ? 1 : 0)}>
          <Switch />
        </Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        {isEmail && <>
          <Form.Item name="host" label="SMTP Host" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="port" label="Port" rules={[{ required: true }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="secure" label="TLS"
                     valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="pool" label="连接池" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="maxConnections" label="最大连接数">
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="auth_user" label="账号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="auth_pass" label="密码（不变请保持 ******）"
                     rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </>}
      </Form>
    </Drawer>
  );
}
```

---

## Step 7: `SmtpTestButton.tsx`

```tsx
import React, { useState } from 'react';
import { Button, Modal, Input, message } from 'antd';
import { NotificationConfigApi } from '@/services/notification';

export default function SmtpTestButton(props: { row: any }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const onTest = async () => {
    if (!to) return message.warning('请输入收件邮箱');
    setLoading(true);
    try {
      const r = await NotificationConfigApi.testChannel(props.row.id, { to });
      if (r.ok) message.success(`已发送：${r.messageId}`);
      else message.error(`发送失败：${r.error}`);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return <>
    <a onClick={() => setOpen(true)}>测试发送</a>
    <Modal title="SMTP 测试" open={open} onCancel={() => setOpen(false)}
           onOk={onTest} okButtonProps={{ loading }}>
      <Input placeholder="收件人邮箱" value={to} onChange={(e) => setTo(e.target.value)} />
    </Modal>
  </>;
}
```

---

## Step 8: 验证 & Commit

- [ ] `npm run dev` 在 admin 目录启动
- [ ] 用 superadmin 登录，访问 `/notification/configs/rate-limit`
  - 列表显示 5 条预置 + 自定义新建
  - 编辑 → 保存 → 列表立即反映
  - 删除按钮二次确认
- [ ] 访问 `/notification/configs/channels`
  - 看到 1 条 email/smtp 默认配置
  - 编辑 host 与 auth_pass，保存后查看 DB（密码确实更新了，密码字段保持 ****** 时 DB 不变）
  - "测试发送"按钮：开发环境应失败（无真实 SMTP），但能看到 lastHealthOk=0 写库
  - "设为默认"切换正常

```bash
git add super-tools-admin/config/routes/modules/notification.ts super-tools-admin/src/access.ts super-tools-admin/src/pages/Notification/_shared/permCodes.ts super-tools-admin/src/services/notification.ts super-tools-admin/src/pages/Notification/Configs/
git commit -m "feat(admin): add notification configs UI (rate-limit + channels)

- /notification/configs/rate-limit: ProTable CRUD + RuleFormModal (scope-aware fields)
- /notification/configs/channels: list with health badge + edit drawer + smtp test + set-default
- Password field uses ****** mask + 'keep unchanged' semantics
- All write actions guarded by canEditNotificationConfig

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.5)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 9)"
```

---

## Verification Checklist

- [ ] 两个新菜单项可见（仅 superadmin / 有 config 权限的角色）
- [ ] 频控规则 CRUD 全部可用
- [ ] 渠道编辑 / 测试发送 / 设默认正常
- [ ] 密码脱敏与保留语义正确
- [ ] commit 已提交

完成后进入 [`p2-1-10-acceptance.md`](./p2-1-10-acceptance.md)。
