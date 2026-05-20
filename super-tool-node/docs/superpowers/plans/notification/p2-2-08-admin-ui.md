# P2.2-08：Admin UI（Wizard 改造 + 详情操作）（Task 8）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 7（admin API）

---

## Step 1: 扩展 `src/services/notification.ts`

在 P1 已有的 `NotificationApi.createTask` 基础上追加：

```typescript
import { request } from 'umi';

// 在 NotificationApi 对象内追加：
pauseTask:  (id: number) => request(`/api/admin/notification/tasks/${id}/pause`,  { method: 'POST' }),
resumeTask: (id: number) => request(`/api/admin/notification/tasks/${id}/resume`, { method: 'POST' }),
cancelTask: (id: number) => request(`/api/admin/notification/tasks/${id}/cancel`, { method: 'POST' }),
undoTask:   (id: number) => request(`/api/admin/notification/tasks/${id}/undo`,   { method: 'POST' }),
previewSchedule: (data: { sendType: 'cron' | 'rrule'; cronExpr?: string; rrule?: string; count?: number }) =>
  request('/api/admin/notification/tasks/preview-schedule', { method: 'POST', data }),
```

---

## Step 2: 创建 `src/pages/Notification/Tasks/components/ScheduleTypeRadio.tsx`

```tsx
import React from 'react';
import { Radio, Tooltip } from 'antd';

const OPTIONS = [
  { value: 'immediate', label: '立即发送', tip: '创建后 30s 内可撤销，过期立即下发' },
  { value: 'scheduled', label: '定时一次', tip: '在指定时间点触发一次（必须 ≥ 当前时间 + 30s）' },
  { value: 'cron',      label: '周期 (Cron)', tip: '按 Cron 表达式重复触发，例如 "0 9 * * *" 每天 9 点' },
  { value: 'rrule',     label: '高级 (RRule)', tip: 'iCalendar RRULE 字符串，例如 FREQ=WEEKLY;BYDAY=MO' },
];

export default function ScheduleTypeRadio({ value, onChange }: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <Radio.Group value={value} onChange={(e) => onChange?.(e.target.value)}>
      {OPTIONS.map((o) => (
        <Tooltip key={o.value} title={o.tip}>
          <Radio.Button value={o.value}>{o.label}</Radio.Button>
        </Tooltip>
      ))}
    </Radio.Group>
  );
}
```

---

## Step 3: 创建 `components/CronEditor.tsx`

```tsx
import React, { useState } from 'react';
import { Input, Button, List, Typography, message } from 'antd';
import { NotificationApi } from '@/services/notification';

export default function CronEditor({ value, onChange }: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [previewList, setPreviewList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const onPreview = async () => {
    if (!value) return message.warning('请先输入 Cron 表达式');
    setLoading(true);
    try {
      const r = await NotificationApi.previewSchedule({ sendType: 'cron', cronExpr: value, count: 5 });
      setPreviewList(r.list);
    } catch (e: any) {
      message.error(e.message || '预览失败');
      setPreviewList([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="例如：0 9 * * *（每天 9:00）"
        addonAfter={<Button type="link" size="small" onClick={onPreview} loading={loading}>预览</Button>}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        5 段：分 时 日 月 周
      </Typography.Text>
      {previewList.length > 0 && (
        <List
          size="small"
          header="未来 5 次触发"
          dataSource={previewList}
          renderItem={(t) => <List.Item>{new Date(t).toLocaleString('zh-CN')}</List.Item>}
          style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}
        />
      )}
    </>
  );
}
```

---

## Step 4: 创建 `components/RRuleEditor.tsx`

```tsx
import React, { useState } from 'react';
import { Input, Button, List, Select, Space, Typography, message } from 'antd';
import { NotificationApi } from '@/services/notification';

const FREQ_OPTS = [
  { value: 'DAILY',   label: '每日' },
  { value: 'WEEKLY',  label: '每周' },
  { value: 'MONTHLY', label: '每月' },
];
const BYDAY_OPTS = ['MO','TU','WE','TH','FR','SA','SU'].map((v) => ({ value: v, label: v }));

export default function RRuleEditor({ value, onChange }: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [previewList, setPreviewList] = useState<string[]>([]);

  const buildFromForm = (freq: string, byday: string[], hour?: number, minute?: number) => {
    const parts = [`FREQ=${freq}`];
    if (byday?.length) parts.push(`BYDAY=${byday.join(',')}`);
    if (hour != null) parts.push(`BYHOUR=${hour}`);
    if (minute != null) parts.push(`BYMINUTE=${minute}`);
    return parts.join(';');
  };

  const onPreview = async () => {
    if (!value) return message.warning('请先输入 RRULE');
    try {
      const r = await NotificationApi.previewSchedule({ sendType: 'rrule', rrule: value, count: 5 });
      setPreviewList(r.list);
    } catch (e: any) {
      message.error(e.message || '预览失败');
      setPreviewList([]);
    }
  };

  return (
    <>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="例如：FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0"
        rows={2}
      />
      <Space style={{ marginTop: 8 }}>
        <Select placeholder="频率" style={{ width: 100 }} options={FREQ_OPTS}
          onChange={(f) => onChange?.(buildFromForm(f, ['MO'], 9, 0))}/>
        <Select mode="multiple" placeholder="星期" style={{ minWidth: 200 }} options={BYDAY_OPTS}
          onChange={(by) => {
            const m = value?.match(/FREQ=(\w+)/);
            if (m) onChange?.(buildFromForm(m[1], by));
          }}/>
        <Button onClick={onPreview}>预览</Button>
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
        参考：<a href="https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10" target="_blank" rel="noreferrer">iCalendar RRULE</a>
      </Typography.Text>
      {previewList.length > 0 && (
        <List size="small" header="未来 5 次触发" dataSource={previewList}
          renderItem={(t) => <List.Item>{new Date(t).toLocaleString('zh-CN')}</List.Item>}
          style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}/>
      )}
    </>
  );
}
```

---

## Step 5: 修改 `src/pages/Notification/Tasks/CreateTaskWizard.tsx`

P1 的 4 步向导：① type ② audience ③ params ④ preview。本次在 Step1 增加 sendType + 各类参数；Step4 预览中显示首次触发时间。

主要改动：

```tsx
// Step 1 顶部加入：
<Form.Item name="sendType" label="发送方式" initialValue="immediate" rules={[{ required: true }]}>
  <ScheduleTypeRadio />
</Form.Item>

<Form.Item shouldUpdate noStyle>
  {({ getFieldValue }) => {
    const st = getFieldValue('sendType');
    if (st === 'scheduled') {
      return <Form.Item name="scheduledAt" label="发送时间" rules={[{ required: true }]}>
        <DatePicker showTime placeholder="必须 ≥ 当前 + 30s" style={{ width: '100%' }}
          disabledDate={(d) => d.isBefore(dayjs())} />
      </Form.Item>;
    }
    if (st === 'cron') {
      return <Form.Item name="cronExpr" label="Cron" rules={[{ required: true }]}>
        <CronEditor />
      </Form.Item>;
    }
    if (st === 'rrule') {
      return <Form.Item name="rrule" label="RRULE" rules={[{ required: true }]}>
        <RRuleEditor />
      </Form.Item>;
    }
    return null;
  }}
</Form.Item>
```

提交时 `scheduledAt` 转 ISO 字符串后随 `NotificationApi.createTask` 一并发送（API 已支持新字段）。

---

## Step 6: 修改 `src/pages/Notification/Tasks/TaskDetailDrawer.tsx`

在 P1 已有的 task + stats 显示之上增加 4 个操作按钮：

```tsx
import { Button, Space, Popconfirm, Tag, message, Statistic } from 'antd';
import { Access, useAccess } from 'umi';
import { useEffect, useState } from 'react';
import { NotificationApi } from '@/services/notification';

export default function TaskDetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const access = useAccess();
  const [data, setData] = useState<any>(null);

  const reload = async () => setData((await NotificationApi.detailTask(id)).data ?? await NotificationApi.detailTask(id));

  useEffect(() => { reload(); }, [id]);

  if (!data) return null;
  const t = data.task;

  // immediate 任务剩余撤销时间
  const undoLeftSec = (t.sendType === 'immediate' && t.undoWindowSec && t.startedAt)
    ? Math.max(0, t.undoWindowSec - Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000))
    : 0;

  const ops: React.ReactNode[] = [];
  if (['scheduled', 'running'].includes(t.status)) {
    ops.push(<Access key="pause" accessible={access.canEditNotificationTask}>
      <Popconfirm title="暂停后会停止下一次触发" onConfirm={async () => {
        await NotificationApi.pauseTask(t.id); message.success('已暂停'); reload();
      }}><Button>暂停</Button></Popconfirm>
    </Access>);
  }
  if (t.status === 'paused') {
    ops.push(<Access key="resume" accessible={access.canEditNotificationTask}>
      <Button onClick={async () => {
        await NotificationApi.resumeTask(t.id); message.success('已恢复'); reload();
      }}>恢复</Button>
    </Access>);
  }
  if (!['completed', 'failed', 'canceled'].includes(t.status)) {
    ops.push(<Access key="cancel" accessible={access.canEditNotificationTask}>
      <Popconfirm title="确定取消？取消后不可恢复" okType="danger" onConfirm={async () => {
        await NotificationApi.cancelTask(t.id); message.success('已取消'); reload();
      }}><Button danger>取消</Button></Popconfirm>
    </Access>);
  }
  if (t.sendType === 'immediate' && undoLeftSec > 0) {
    ops.push(<Access key="undo" accessible={access.canEditNotificationTask}>
      <Button danger onClick={async () => {
        try {
          await NotificationApi.undoTask(t.id);
          message.success('已撤销');
          reload();
        } catch (e: any) {
          message.error(e.message);
        }
      }}>撤销 ({undoLeftSec}s)</Button>
    </Access>);
  }

  return (
    <Drawer open onClose={onClose} title={`任务 #${t.id}：${t.name}`} width={640}
      extra={<Space>{ops}</Space>}>
      {/* P1 已有的字段展示保留 */}
      <Statistic title="状态" value={t.status} />
      {t.nextFireAt && <Statistic title="下次触发" value={new Date(t.nextFireAt).toLocaleString('zh-CN')} />}
      {t.lastFireAt && <Statistic title="上次触发" value={new Date(t.lastFireAt).toLocaleString('zh-CN')} />}
      {/* stats 表格沿用 P1 实现 */}
    </Drawer>
  );
}
```

---

## Step 7: access.ts 追加

```typescript
canEditNotificationTask: has('notification:task:create')
  || has('notification:task:pause')
  || has('notification:task:cancel')
  || has('notification:task:undo'),
```

---

## Step 8: 验证 & Commit

- [ ] `npm run dev` 在 admin 启动
- [ ] 用 superadmin 登录，访问 `/notification/tasks`
- [ ] 4 类发送方式各创建一个任务
  - immediate：30 秒倒计时撤销可见
  - scheduled：选未来时间，列表 next_fire_at 显示
  - cron：表达式预览未来 5 次
  - rrule：RRULE 输入 + 预览
- [ ] 详情 Drawer 中 pause/resume/cancel/undo 按钮按状态显示
- [ ] 暂停 cron 后日志可见 BullMQ removeRepeatable

```bash
git add super-tools-admin/src/services/notification.ts super-tools-admin/src/pages/Notification/Tasks/components/ super-tools-admin/src/pages/Notification/Tasks/CreateTaskWizard.tsx super-tools-admin/src/pages/Notification/Tasks/TaskDetailDrawer.tsx super-tools-admin/src/access.ts
git commit -m "feat(admin): notification task scheduling UI (4 sendType wizard + 4 lifecycle ops)

- ScheduleTypeRadio: 4 sendType picker with tooltips
- CronEditor + RRuleEditor: live preview of next 5 fires
- TaskDetailDrawer: pause/resume/cancel/undo buttons gated by access + status
- Immediate task shows live countdown for undo window
- Display nextFireAt / lastFireAt for cron/rrule tasks

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6 §8)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 8)"
```

---

## Verification Checklist

- [ ] CreateTaskWizard 4 sendType 全可用
- [ ] cron/rrule 预览返回 5 个时间
- [ ] 详情按钮按状态显示/隐藏
- [ ] undo 倒计时实时更新
- [ ] commit 已提交

完成后进入 [`p2-2-09-acceptance.md`](./p2-2-09-acceptance.md)。
