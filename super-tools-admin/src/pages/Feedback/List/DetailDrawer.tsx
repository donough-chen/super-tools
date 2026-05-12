import React, { useEffect, useState } from 'react';
import {
  Drawer, Collapse, Descriptions, Tag, Spin, Form, Input, Button,
  Select, Space, Popconfirm, message, Empty,
} from 'antd';
import AuthButton from '@/components/AuthButton';
import {
  getFeedback, replyFeedback, updateFeedback, deleteFeedback,
  Feedback, FeedbackStatus,
} from '@/services/feedback';
import { STATUS_LABELS, getAllowedTransitions } from '@/utils/feedbackStatus';
import { formatDateTime } from '@/utils/format';
import StatusTag from './StatusTag';

interface Props {
  visible: boolean;
  target: Feedback | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_COLOR: Record<string, string> = {
  bug: 'red', suggestion: 'blue', praise: 'gold', other: 'default',
};

const DetailDrawer: React.FC<Props> = ({ visible, target, onClose, onSuccess }) => {
  const [detail, setDetail] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const refetch = async (id: number) => {
    setLoading(true);
    try {
      const r: any = await getFeedback(id);
      if (r?.code === 200) setDetail(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (visible && target) {
      form.resetFields();
      refetch(target.id);
    } else if (!visible) {
      setDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, target]);

  const handleReply = async () => {
    if (!detail) return;
    try {
      const { replyContent } = await form.validateFields();
      setSubmitting(true);
      const res: any = await replyFeedback(detail.id, replyContent);
      if (res?.code === 200) {
        message.success('回复成功');
        await refetch(detail.id);
        onSuccess();
      } else {
        message.error(res?.message || '回复失败');
      }
    } catch {
      // validate 失败忽略
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (newStatus: FeedbackStatus) => {
    if (!detail) return;
    const res: any = await updateFeedback(detail.id, { status: newStatus });
    if (res?.code === 200) {
      message.success('状态已更新');
      await refetch(detail.id);
      onSuccess();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    const res: any = await deleteFeedback(detail.id);
    if (res?.code === 200) {
      message.success('删除成功');
      onClose();
      onSuccess();
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  return (
    <Drawer
      title={`反馈详情 #${target?.id ?? ''}`}
      width={720} open={visible} onClose={onClose} destroyOnClose
    >
      <Spin spinning={loading}>
        {!detail ? <Empty description="暂无数据" /> : (
          <Collapse
            defaultActiveKey={['basic', 'content', 'reply', 'actions']}
            items={[
              {
                key: 'basic',
                label: '基础信息',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="类型">
                      <Tag color={TYPE_COLOR[detail.type] || 'default'}>{detail.type}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <StatusTag status={detail.status} />
                    </Descriptions.Item>
                    <Descriptions.Item label="用户">
                      {detail.user
                        ? `${detail.user.username}${detail.user.nickname ? `(${detail.user.nickname})` : ''}`
                        : (detail.userId ? `#${detail.userId}` : '匿名')}
                    </Descriptions.Item>
                    <Descriptions.Item label="联系方式">{detail.contact || '-'}</Descriptions.Item>
                    <Descriptions.Item label="平台">{detail.platform || '-'}</Descriptions.Item>
                    <Descriptions.Item label="提交时间">{formatDateTime(detail.createdAt)}</Descriptions.Item>
                    <Descriptions.Item label="IP">{detail.ip || '-'}</Descriptions.Item>
                    <Descriptions.Item label="UA" span={2}>
                      <span style={{ wordBreak: 'break-all', fontSize: 12 }}>
                        {detail.userAgent || '-'}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'content',
                label: '反馈内容',
                children: <pre>{detail.content}</pre>,
              },
              {
                key: 'reply',
                label: '回复区',
                children: detail.replyContent ? (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="回复内容">
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {detail.replyContent}
                      </pre>
                    </Descriptions.Item>
                    <Descriptions.Item label="回复人">
                      {detail.replier
                        ? `${detail.replier.username}${detail.replier.nickname ? `(${detail.replier.nickname})` : ''}`
                        : (detail.replyUserId ? `#${detail.replyUserId}` : '-')}
                    </Descriptions.Item>
                    <Descriptions.Item label="回复时间">
                      {formatDateTime(detail.repliedAt)}
                    </Descriptions.Item>
                  </Descriptions>
                ) : (detail.status === 0 || detail.status === 1) ? (
                  <Form form={form} layout="vertical">
                    <Form.Item
                      label="回复内容" name="replyContent"
                      rules={[
                        { required: true, message: '请输入回复内容' },
                        { min: 1, max: 2000, message: '1-2000 字符' },
                      ]}
                    >
                      <Input.TextArea rows={4} maxLength={2000} showCount />
                    </Form.Item>
                    <Form.Item>
                      <AuthButton permCode="feedback:reply">
                        <Button type="primary" loading={submitting} onClick={handleReply}>
                          提交回复
                        </Button>
                      </AuthButton>
                    </Form.Item>
                  </Form>
                ) : (
                  <Empty description="当前状态不允许回复（已回复/已关闭，需先重新打开）" />
                ),
              },
              {
                key: 'actions',
                label: '操作',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <span>切换状态：</span>
                      <AuthButton permCode="feedback:update">
                        <Select
                          value={detail.status} style={{ width: 160 }}
                          options={[
                            { value: detail.status, label: `${STATUS_LABELS[detail.status]}（当前）`, disabled: true },
                            ...getAllowedTransitions(detail.status).map((x) => ({ value: x, label: STATUS_LABELS[x] })),
                          ]}
                          onChange={(v) => handleStatus(v as FeedbackStatus)}
                        />
                      </AuthButton>
                    </Space>
                    <AuthButton permCode="feedback:delete">
                      <Popconfirm title="确定删除该反馈？" onConfirm={handleDelete}>
                        <Button danger>删除反馈</Button>
                      </Popconfirm>
                    </AuthButton>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Drawer>
  );
};

export default DetailDrawer;
