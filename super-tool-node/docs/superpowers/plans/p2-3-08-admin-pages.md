# P2.3-08：Admin UI - Audiences 页面 + AudiencePreview + Tasks Wizard 接入（Task 8）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 7（RuleBuilder）

---

## Step 1: 路由 + access

`super-tools-admin/config/routes/modules/notification.ts` 追加：

```typescript
{ path: '/notification/audiences',
  name: 'audiences',
  component: '@/pages/Notification/Audiences',
  access: 'canViewNotificationAudience' },
```

`src/access.ts` 追加：

```typescript
canViewNotificationAudience: has('notification:audience:view'),
canEditNotificationAudience: has('notification:audience:edit'),
canPreviewNotificationAudience: has('notification:audience:preview'),
```

`src/pages/Notification/_shared/permCodes.ts` 追加：

```typescript
AUDIENCE_VIEW: 'notification:audience:view',
AUDIENCE_EDIT: 'notification:audience:edit',
AUDIENCE_PREVIEW: 'notification:audience:preview',
```

---

## Step 2: `src/pages/Notification/_shared/AudiencePreview.tsx`

```tsx
import React, { useState } from 'react';
import { Button, Statistic, Card, message, Space, Tag, Spin, Alert } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { NotificationAudienceApi } from '@/services/notification';

export default function AudiencePreview(props: {
  audienceRule: any;
  audienceId?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ sampleIds: number[]; total: number; timedOut: boolean } | null>(null);

  const onPreview = async () => {
    if (!props.audienceRule) return message.warning('请先配置受众规则');
    setLoading(true);
    try {
      const r = await NotificationAudienceApi.preview({
        audienceRule: props.audienceRule,
        audienceId: props.audienceId,
      });
      setData(r);
    } catch (e: any) {
      message.error(e.message || '预览失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card size="small" style={{ marginTop: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={onPreview} loading={loading}>
          预览受众
        </Button>
        {data && (
          <>
            {data.timedOut && <Alert type="warning" message="预览总数查询超时（>5s），请简化规则后重试" />}
            <Statistic title="匹配总用户数" value={data.total} />
            <div>
              样本（前 {data.sampleIds.length} 个 user.id）：
              <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                {data.sampleIds.map((id) => <Tag key={id}>{id}</Tag>)}
              </div>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}
```

---

## Step 3: `src/pages/Notification/Audiences/index.tsx`

```tsx
import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table';
import { Button, Tag, Popconfirm, message } from 'antd';
import { Access, useAccess } from 'umi';
import { NotificationAudienceApi } from '@/services/notification';
import AudienceFormDrawer from './AudienceFormDrawer';

export default function AudiencesPage() {
  const ref = useRef<ActionType>();
  const access = useAccess();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const columns: ProColumns[] = [
    { dataIndex: 'id', title: 'ID', width: 60 },
    { dataIndex: 'name', title: '名称', width: 200 },
    { dataIndex: 'audienceType', title: '类型', width: 100,
      render: (v: string) => v === 'dynamic' ? <Tag color="blue">动态</Tag> : <Tag>静态</Tag> },
    { dataIndex: 'lastPreviewCount', title: '上次预览人数', width: 140,
      render: (v) => v == null ? '-' : v },
    { dataIndex: 'lastPreviewAt', title: '上次预览时间', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { dataIndex: 'description', title: '描述', ellipsis: true },
    { title: '操作', width: 160, valueType: 'option',
      render: (_, row) => [
        <Access key="edit" accessible={access.canEditNotificationAudience}>
          <a onClick={() => { setEditing(row); setOpen(true); }}>编辑</a>
        </Access>,
        <Access key="del" accessible={access.canEditNotificationAudience}>
          <Popconfirm title="确定删除？被任务引用时会失败" onConfirm={async () => {
            try {
              await NotificationAudienceApi.destroy(row.id);
              message.success('已删除');
              ref.current?.reload();
            } catch (e: any) { message.error(e.message); }
          }}><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm>
        </Access>,
      ],
    },
  ];

  return (
    <PageContainer header={{ title: '受众分组' }}>
      <ProTable
        actionRef={ref}
        columns={columns}
        rowKey="id"
        request={async (params) => {
          const r = await NotificationAudienceApi.list({
            keyword: params.keyword, audienceType: params.audienceType,
            page: params.current, pageSize: params.pageSize,
          });
          return { data: r.list, total: r.total, success: true };
        }}
        toolBarRender={() => [
          <Access key="add" accessible={access.canEditNotificationAudience}>
            <Button type="primary" onClick={() => { setEditing(null); setOpen(true); }}>
              新建受众
            </Button>
          </Access>,
        ]}
      />
      {open && (
        <AudienceFormDrawer
          editing={editing}
          onClose={() => setOpen(false)}
          onOk={() => { setOpen(false); ref.current?.reload(); }}
        />
      )}
    </PageContainer>
  );
}
```

---

## Step 4: `src/pages/Notification/Audiences/AudienceFormDrawer.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Drawer, Form, Input, Radio, Button, Space, message, Alert } from 'antd';
import { NotificationAudienceApi } from '@/services/notification';
import RuleBuilder from '../_shared/RuleBuilder';
import AudiencePreview from '../_shared/AudiencePreview';

const DEFAULT_RULE = { operator: 'and', conditions: [] };

export default function AudienceFormDrawer(props: {
  editing: any | null;
  onClose: () => void;
  onOk: () => void;
}) {
  const [form] = Form.useForm();
  const [audienceType, setAudienceType] = useState<'static' | 'dynamic'>('dynamic');
  const [rule, setRule] = useState<any>(DEFAULT_RULE);
  const isEdit = !!props.editing;

  useEffect(() => {
    if (props.editing) {
      form.setFieldsValue({
        name: props.editing.name,
        description: props.editing.description,
        audienceType: props.editing.audienceType,
      });
      setAudienceType(props.editing.audienceType);
      setRule(props.editing.audienceRule || DEFAULT_RULE);
    } else {
      form.resetFields();
      setRule(DEFAULT_RULE);
      setAudienceType('dynamic');
    }
  }, [props.editing, form]);

  const onSubmit = async () => {
    const v = await form.validateFields();
    const payload: any = { ...v, audienceRule: audienceType === 'dynamic' ? rule : v.audienceRule };
    try {
      if (isEdit) {
        await NotificationAudienceApi.update(props.editing.id, payload);
        message.success('已更新');
      } else {
        await NotificationAudienceApi.create(payload);
        message.success('已创建');
      }
      props.onOk();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  return (
    <Drawer
      title={isEdit ? `编辑受众 #${props.editing.id}` : '新建受众'}
      open
      onClose={props.onClose}
      width={720}
      extra={<Space>
        <Button onClick={props.onClose}>取消</Button>
        <Button type="primary" onClick={onSubmit}>保存</Button>
      </Space>}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, max: 200 }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} maxLength={500} /></Form.Item>
        <Form.Item name="audienceType" label="类型" initialValue="dynamic">
          <Radio.Group onChange={(e) => setAudienceType(e.target.value)}>
            <Radio.Button value="dynamic">动态规则</Radio.Button>
            <Radio.Button value="static">静态用户列表</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {audienceType === 'static' && (
          <Form.Item name={['audienceRule', 'userIds']} label="用户 ID 列表">
            <Input.TextArea rows={4} placeholder="逗号分隔，如：1,2,3"
              onChange={(e) => {
                const arr = e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
                form.setFieldValue(['audienceRule', 'userIds'], arr);
              }} />
          </Form.Item>
        )}

        {audienceType === 'dynamic' && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 8 }}
              message="规则编辑器：嵌套 AND/OR ≤ 3 层；支持 9 个字段、9 种操作符、相对时间(P30D)。" />
            <RuleBuilder value={rule} onChange={setRule} maxDepth={3} />
            <AudiencePreview audienceRule={rule} audienceId={props.editing?.id} />
          </>
        )}
      </Form>
    </Drawer>
  );
}
```

---

## Step 5: 修改 Tasks Wizard 接入动态受众

`src/pages/Notification/Tasks/CreateTaskWizard.tsx` Step 2 增加：

```tsx
import RuleBuilder from '../_shared/RuleBuilder';
import AudiencePreview from '../_shared/AudiencePreview';
import { NotificationAudienceApi } from '@/services/notification';

// 在 Step 2 内：
<Form.Item name="audienceType" label="受众类型" initialValue="all">
  <Radio.Group onChange={(e) => setAudType(e.target.value)}>
    <Radio.Button value="all">全部用户</Radio.Button>
    <Radio.Button value="static">指定用户</Radio.Button>
    <Radio.Button value="dynamic">动态规则</Radio.Button>
    <Radio.Button value="audience">已保存分组</Radio.Button>
  </Radio.Group>
</Form.Item>

{audType === 'static' && (
  <Form.Item name={['audienceRule', 'userIds']} label="用户 ID 列表">
    <Input.TextArea rows={3} placeholder="逗号分隔，如：1,2,3" />
  </Form.Item>
)}

{audType === 'dynamic' && (
  <>
    <RuleBuilder value={rule} onChange={setRule} />
    <AudiencePreview audienceRule={rule} />
  </>
)}

{audType === 'audience' && (
  <Form.Item name="audienceId" label="选择已保存受众" rules={[{ required: true }]}>
    <Select
      showSearch
      placeholder="选择"
      filterOption={(input, opt) => (opt?.label as string).includes(input)}
      onSearch={async (kw) => { /* 远程搜索 audiences */ }}
      // 实际实现使用 useState 加载 + 切换 onChange
    />
  </Form.Item>
)}
```

> 提交任务时，根据 audType 不同：
> - all/static/dynamic：`audienceType` + `audienceRule`
> - audience：`audienceType=dynamic` + `audienceId`（后端 `task.create` 时若有 `audienceId` 则查表回填 `audienceRule`，本计划不强制改 task controller，由 audience service 内部 fallback 解决）

---

## Step 6: 验证 & Commit

- [ ] `npm run dev` 启动 admin
- [ ] 访问 `/notification/audiences`：列表 + 新建 + 编辑 + 删除（被引用时禁止）
- [ ] 编辑 Drawer 中拖入嵌套 3 层 AND/OR；点"预览受众"看到样本与总数
- [ ] 在 `/notification/tasks` 创建任务 Step 2 选"动态规则"，与 Audiences 页编辑器一致
- [ ] 选"已保存分组"能下拉选受众

```bash
git add super-tools-admin/config/routes/modules/notification.ts super-tools-admin/src/access.ts super-tools-admin/src/pages/Notification/_shared/permCodes.ts super-tools-admin/src/pages/Notification/_shared/AudiencePreview.tsx super-tools-admin/src/pages/Notification/Audiences/ super-tools-admin/src/pages/Notification/Tasks/CreateTaskWizard.tsx
git commit -m "feat(admin): notification audience pages + tasks wizard dynamic option

- /notification/audiences list+CRUD with preview integration
- AudienceFormDrawer: name/desc + type radio + RuleBuilder/static input + Preview
- AudiencePreview: button → API → samples + total + timeout warning
- Tasks Wizard Step 2 supports 4 modes: all/static/dynamic/audience
- 'audience' mode references existing reusable group via audience_id

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 8)"
```

---

## Verification Checklist

- [ ] Audiences 列表页可创建/编辑/删除
- [ ] AudiencePreview 显示样本 + 总数
- [ ] Tasks Wizard 4 模式可用
- [ ] commit 已提交

完成后进入 [`p2-3-09-acceptance.md`](./p2-3-09-acceptance.md)。
