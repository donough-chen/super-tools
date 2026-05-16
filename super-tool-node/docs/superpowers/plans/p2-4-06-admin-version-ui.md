# P2.4-06：Admin UI - 模板版本 Drawer + Diff 视图（Task 6）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 2（rollback API）

---

## Step 1: 扩展 `super-tools-admin/src/services/notification.ts`

```typescript
// 在 NotificationApi 内追加：
listTemplateVersions: (id: number) =>
  request(`/api/admin/notification/templates/${id}/versions`),
rollbackTemplate: (typeId: number, data: { lang: string; channel: string; targetVersion: number }) =>
  request(`/api/admin/notification/templates/${typeId}/rollback`, { method: 'POST', data }),
```

---

## Step 2: 创建 `src/pages/Notification/Templates/VersionDiffView.tsx`

```tsx
import React from 'react';
import { Card, Tag, Space, Typography } from 'antd';

export default function VersionDiffView(props: {
  left:  { version: number; titleTpl: string; bodyTpl: string; isActive: number };
  right: { version: number; titleTpl: string; bodyTpl: string; isActive: number };
}) {
  const renderSide = (v: typeof props.left, label: string) => (
    <Card size="small"
      title={<Space>
        <span>{label} v{v.version}</span>
        {v.isActive === 1 && <Tag color="green">当前活跃</Tag>}
      </Space>}>
      <Typography.Text strong>标题：</Typography.Text>
      <pre style={{ background: '#f5f5f5', padding: 8, whiteSpace: 'pre-wrap' }}>{v.titleTpl}</pre>
      <Typography.Text strong>正文：</Typography.Text>
      <pre style={{ background: '#f5f5f5', padding: 8, whiteSpace: 'pre-wrap' }}>{v.bodyTpl}</pre>
    </Card>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {renderSide(props.left, '当前')}
      {renderSide(props.right, '目标')}
    </div>
  );
}
```

---

## Step 3: 创建 `src/pages/Notification/Templates/TemplateVersionDrawer.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Drawer, List, Tag, Button, Space, Modal, message, Typography, Empty } from 'antd';
import { Access, useAccess } from 'umi';
import { NotificationApi } from '@/services/notification';
import VersionDiffView from './VersionDiffView';

interface TemplateLite {
  templateId: number;
  version: number;
  isActive: 0 | 1;
  titleTpl: string;
  bodyTpl: string;
  updatedAt: string;
}

export default function TemplateVersionDrawer(props: {
  templateId: number;
  onClose: () => void;
  onAfterRollback?: () => void;
}) {
  const access = useAccess();
  const [data, setData] = useState<{
    typeId: number; lang: string; channel: string;
    versions: TemplateLite[];
  } | null>(null);
  const [diffTarget, setDiffTarget] = useState<TemplateLite | null>(null);

  const reload = async () => {
    const r = await NotificationApi.listTemplateVersions(props.templateId);
    setData(r);
  };
  useEffect(() => { reload(); }, [props.templateId]);

  if (!data) return <Drawer open onClose={props.onClose} />;

  const active = data.versions.find((v) => v.isActive === 1);

  const onRollback = (target: TemplateLite) => {
    if (target.isActive === 1) {
      message.info('该版本已是当前活跃版本');
      return;
    }
    Modal.confirm({
      title: `回滚到 v${target.version}？`,
      content: '将复制该版本内容创建新版本并设为活跃；旧版本会保留快照。',
      okType: 'danger',
      async onOk() {
        try {
          await NotificationApi.rollbackTemplate(data.typeId, {
            lang: data.lang, channel: data.channel, targetVersion: target.version,
          });
          message.success('已回滚');
          reload();
          props.onAfterRollback?.();
        } catch (e: any) {
          message.error(e.message);
        }
      },
    });
  };

  return (
    <Drawer
      open
      onClose={props.onClose}
      title={`版本历史：type#${data.typeId} / ${data.lang} / ${data.channel}`}
      width={920}
      extra={<Typography.Text type="secondary">共 {data.versions.length} 个版本</Typography.Text>}
    >
      {data.versions.length === 0 ? (
        <Empty description="暂无历史版本" />
      ) : (
        <List
          dataSource={data.versions}
          renderItem={(v) => (
            <List.Item
              actions={[
                <Button size="small" onClick={() => setDiffTarget(v)} key="diff">查看 / 对比</Button>,
                <Access accessible={access.canPublishNotificationTemplate} key="rb">
                  <Button size="small" type="primary" danger
                    disabled={v.isActive === 1}
                    onClick={() => onRollback(v)}>
                    回滚到此版本
                  </Button>
                </Access>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>v{v.version}</span>
                    {v.isActive === 1 && <Tag color="green">当前活跃</Tag>}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(v.updatedAt).toLocaleString('zh-CN')}
                    </Typography.Text>
                  </Space>
                }
                description={
                  <Typography.Text ellipsis style={{ width: 600 }}>
                    {v.titleTpl}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}

      {diffTarget && active && (
        <Drawer open onClose={() => setDiffTarget(null)} width={1024}
                title={`对比：当前 v${active.version} ↔ 目标 v${diffTarget.version}`}>
          <VersionDiffView left={active} right={diffTarget} />
        </Drawer>
      )}
      {diffTarget && !active && (
        <Drawer open onClose={() => setDiffTarget(null)} width={720}
                title={`查看 v${diffTarget.version}`}>
          <VersionDiffView
            left={{ version: 0, titleTpl: '(无活跃版本)', bodyTpl: '', isActive: 0 }}
            right={diffTarget}
          />
        </Drawer>
      )}
    </Drawer>
  );
}
```

---

## Step 4: 修改 `src/pages/Notification/Templates/index.tsx`

在 ProTable 行操作中追加"版本"按钮：

```tsx
import TemplateVersionDrawer from './TemplateVersionDrawer';

// state
const [versionTplId, setVersionTplId] = useState<number | null>(null);

// columns 末尾追加：
{ title: '操作', valueType: 'option',
  render: (_, row) => [
    <a key="edit" onClick={() => /* 已有编辑逻辑 */ {}}>编辑</a>,
    <a key="ver" onClick={() => setVersionTplId(row.id)}>版本</a>,
  ]
}

// JSX 末尾追加：
{versionTplId && (
  <TemplateVersionDrawer
    templateId={versionTplId}
    onClose={() => setVersionTplId(null)}
    onAfterRollback={() => actionRef.current?.reload()}
  />
)}
```

---

## Step 5: 验证 & Commit

- [ ] `npm run dev` 启动 admin
- [ ] 用 superadmin 登录访问 `/notification/templates`
- [ ] 选 `feedback_reply` zh-CN/inApp 模板，点"版本"
- [ ] 看到 v1 active；新建草稿 v2 → publish → v2 active；再点"版本"看到两个版本
- [ ] 对 v1 点"回滚到此版本" → 出现 v3 active；v1/v2 都为非活跃
- [ ] 点"查看/对比"看到左右 diff

```bash
git add super-tools-admin/src/services/notification.ts super-tools-admin/src/pages/Notification/Templates/VersionDiffView.tsx super-tools-admin/src/pages/Notification/Templates/TemplateVersionDrawer.tsx super-tools-admin/src/pages/Notification/Templates/index.tsx
git commit -m "feat(admin): notification template version drawer + diff view + rollback button

- New 'Versions' button on template row → opens TemplateVersionDrawer
- List all versions with active tag; rollback button disabled for active
- Diff view: side-by-side current vs target (title + body)
- Rollback creates new version (auto v+1) and sets active
- Guarded by canPublishNotificationTemplate access

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §10.2 §8)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 6)"
```

---

## Verification Checklist

- [ ] 列表行有"版本"按钮
- [ ] Drawer 列出全部版本 + active 标记
- [ ] Diff 视图 2 列正确
- [ ] 回滚后新版本立即生效
- [ ] commit 已提交

完成后进入 [`p2-4-07-acceptance.md`](./p2-4-07-acceptance.md)。
