/**
 * 反馈提交页 /feedback
 *
 * 功能：
 * - 选择反馈类型（bug/建议/表扬/其他）
 * - 输入反馈内容（5-2000 字）
 * - 未登录用户必须填写联系方式
 * - 提交成功后：登录用户跳转「我的反馈」，未登录用户停留并清空表单
 */
import React, { useState, useMemo } from 'react';
import { navigateTo } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import { useUserStore } from '../../store';
import { showToast } from '../../utils/toast';
import { submitFeedbackApi, FeedbackType } from '../../service/feedback';
import './index.less';

const TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug',        label: 'Bug 反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'praise',     label: '表扬' },
  { value: 'other',      label: '其他' },
];

const MIN_CONTENT_LEN = 5;
const MAX_CONTENT_LEN = 2000;

const FeedbackPage: React.FC = () => {
  const isLoggedIn = useUserStore(s => s.isLoggedIn);

  const [type, setType] = useState<FeedbackType>('suggestion');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (content.trim().length < MIN_CONTENT_LEN) return false;
    if (!isLoggedIn && contact.trim().length === 0) return false;
    return true;
  }, [submitting, content, contact, isLoggedIn]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res: any = await submitFeedbackApi({
        type,
        content: content.trim(),
        contact: contact.trim() || undefined,
        platform: 'micro-tools',
      });
      if (res?.code === 201 || res?.code === 200) {
        showToast('提交成功，感谢您的反馈', 'success');
        setContent('');
        setContact('');
        if (isLoggedIn) {
          // 略延迟，让用户看到 toast
          setTimeout(() => navigateTo('/feedback/history'), 600);
        }
      } else {
        showToast(res?.message || '提交失败，请稍后重试', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误，请稍后重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-feedback">
      <AppHeader title="意见反馈" showBack />

      <div className="page-feedback__form">
        {/* 类型 */}
        <div className="page-feedback__section">
          <div className="page-feedback__section-title">反馈类型</div>
          <div className="page-feedback__type-group">
            {TYPES.map(t => (
              <div
                key={t.value}
                className={
                  'page-feedback__type-item' +
                  (type === t.value ? ' page-feedback__type-item--active' : '')
                }
                onClick={() => setType(t.value)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* 内容 */}
        <div className="page-feedback__section">
          <div className="page-feedback__section-title page-feedback__section-title-required">
            反馈内容
          </div>
          <textarea
            className="page-feedback__textarea"
            placeholder={`请详细描述您遇到的问题或建议（至少 ${MIN_CONTENT_LEN} 字）`}
            maxLength={MAX_CONTENT_LEN}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="page-feedback__count">
            {content.length} / {MAX_CONTENT_LEN}
          </div>
        </div>

        {/* 联系方式（未登录必填） */}
        {!isLoggedIn && (
          <div className="page-feedback__section">
            <div className="page-feedback__section-title page-feedback__section-title-required">
              联系方式
            </div>
            <input
              className="page-feedback__input"
              placeholder="请输入手机号或邮箱"
              maxLength={100}
              value={contact}
              onChange={e => setContact(e.target.value)}
            />
          </div>
        )}

        {/* 提交 */}
        <button
          className={
            'page-feedback__submit' +
            (canSubmit ? '' : ' page-feedback__submit--disabled')
          }
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? '提交中...' : '提交反馈'}
        </button>

        {isLoggedIn && (
          <a
            className="page-feedback__history"
            onClick={() => navigateTo('/feedback/history')}
          >
            查看我的反馈记录 →
          </a>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
