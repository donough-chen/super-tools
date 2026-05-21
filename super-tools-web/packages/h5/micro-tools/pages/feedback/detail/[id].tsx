/**
 * 反馈详情 /feedback/detail/:id
 *
 * 功能：
 * - 通过 service 拉取详情（后端校验 userId 归属）
 * - 显示反馈内容、状态、提交时间
 * - 时间线展示处理进度
 * - 显示管理员回复（若已回复）
 */
import React, { useEffect, useState, useCallback } from 'react';
import AppHeader from '../../../components/AppHeader';
import { showToast } from '../../../utils/toast';
import { getMyFeedbackDetailApi, FeedbackDetail, FeedbackStatus } from '../../../service/feedback';
import './index.less';

interface Props {
  match: { params: { id: string } };
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭',
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug', suggestion: '建议', praise: '表扬', other: '其他',
};

const formatTime = (s: string | null): string => {
  if (!s) return '';
  try {
    const d = new Date(s);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return s;
  }
};

const FeedbackDetailPage: React.FC<Props> = ({ match }) => {
  const id = match?.params?.id;
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setError('参数缺失');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res: any = await getMyFeedbackDetailApi(id);
      if (res?.code === 200 && res.data) {
        setDetail(res.data);
      } else if (res?.code === 404) {
        setError('反馈不存在或已被删除');
      } else {
        setError(res?.message || '加载失败');
        showToast(res?.message || '加载失败', 'error');
      }
    } catch (e: any) {
      setError(e?.message || '网络错误');
      showToast(e?.message || '网络错误', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ==================== 时间线 ====================

  const renderTimeline = (d: FeedbackDetail) => {
    const status = d.status;
    // status: 0=待处理 1=处理中 2=已回复 3=已关闭
    // 时间线步骤
    const steps: Array<{ label: string; done: boolean; time: string | null }> = [
      { label: '提交反馈', done: true, time: d.createdAt },
      { label: '已受理',   done: status >= 1, time: status >= 1 ? d.updatedAt : null },
      { label: '已回复',   done: status >= 2, time: d.repliedAt },
    ];
    if (status === 3) {
      steps.push({ label: '已关闭', done: true, time: d.updatedAt });
    }

    return (
      <div>
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={
              'page-feedback-detail__timeline-item ' +
              (step.done
                ? 'page-feedback-detail__timeline-item--done'
                : 'page-feedback-detail__timeline-item--pending')
            }
          >
            <div className="page-feedback-detail__timeline-dot" />
            <div className="page-feedback-detail__timeline-label">{step.label}</div>
            {step.time && (
              <div className="page-feedback-detail__timeline-time">{formatTime(step.time)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <div className="page-feedback-detail">
        <AppHeader title="反馈详情" showBack />
        <div className="page-feedback-detail__loading">加载中...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-feedback-detail">
        <AppHeader title="反馈详情" showBack />
        <div className="page-feedback-detail__error">{error || '反馈不存在'}</div>
      </div>
    );
  }

  return (
    <div className="page-feedback-detail">
      <AppHeader title="反馈详情" showBack />
      <div className="page-feedback-detail__content">
        {/* 反馈信息 */}
        <div className="page-feedback-detail__card">
          <div className="page-feedback-detail__info-head">
            <span className="page-feedback-detail__info-type">
              {TYPE_LABELS[detail.type] || detail.type}
            </span>
            <span
              className={`page-feedback-detail__info-status page-feedback-detail__info-status--${detail.status}`}
            >
              {STATUS_LABELS[detail.status]}
            </span>
          </div>
          <div className="page-feedback-detail__info-body">{detail.content}</div>
          <div className="page-feedback-detail__info-time">
            提交于 {formatTime(detail.createdAt)}
          </div>
        </div>

        {/* 时间线 */}
        <div className="page-feedback-detail__card">
          <div className="page-feedback-detail__timeline-title">处理进度</div>
          {renderTimeline(detail)}
        </div>

        {/* 回复 */}
        {detail.replyContent && (
          <div className="page-feedback-detail__card">
            <div className="page-feedback-detail__reply-title">管理员回复</div>
            <div className="page-feedback-detail__reply-content">{detail.replyContent}</div>
            {detail.repliedAt && (
              <div className="page-feedback-detail__reply-time">
                回复于 {formatTime(detail.repliedAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackDetailPage;
