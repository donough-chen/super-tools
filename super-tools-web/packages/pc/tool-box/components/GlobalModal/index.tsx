import React, { useEffect, useCallback, useRef, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import { useModalStore, type ModalPosition } from '@/store/modal';
import './index.less';

/** 根据 position 返回对应的 CSS 类名 */
const getPositionClass = (position: ModalPosition): string => {
  const map: Record<ModalPosition, string> = {
    center: 'global-modal-root--center',
    top: 'global-modal-root--top',
    bottom: 'global-modal-root--bottom',
    'top-left': 'global-modal-root--top-left',
    'top-right': 'global-modal-root--top-right',
    'bottom-left': 'global-modal-root--bottom-left',
    'bottom-right': 'global-modal-root--bottom-right',
  };
  return map[position] ?? 'global-modal-root--top-right';
};

const GlobalModal: React.FC = () => {
  const { visible, options, hideModal } = useModalStore();
  const [animating, setAnimating] = useState(false);
  const [rendered, setRendered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = options?.animationDuration ?? 300;
  const position = options?.position ?? 'top-right';
  const closable = options?.closable !== false;
  const maskClosable = options?.maskClosable !== false;
  const showMask = options?.showMask ?? (position === 'center');
  const isToast = options?._isToast === true;
  const toastDuration = options?._toastDuration ?? 2000;

  // 打开：先渲染 DOM，再触发入场动画
  useEffect(() => {
    if (visible) {
      setRendered(true);
      // 下一帧触发动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });

      // toast 模式：自动关闭
      if (isToast) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          hideModal();
          options?.onClose?.();
        }, toastDuration);
      }
    } else {
      // 退场动画
      setAnimating(false);
      timerRef.current = setTimeout(() => {
        setRendered(false);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration]);

  // 组件卸载时清理 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ESC 键关闭（toast 模式不响应 ESC）
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible && !isToast) {
        handleClose();
      }
    },
    [visible, isToast],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleClose = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    hideModal();
    options?.onClose?.();
  }, [hideModal, options]);

  const handleMaskClick = useCallback(() => {
    if (maskClosable) handleClose();
  }, [maskClosable, handleClose]);

  if (!rendered || !options) return null;

  const { title, content, buttons, width = 420 } = options;

  // 默认按钮（toast 模式无按钮）
  const resolvedButtons = isToast
    ? []
    : buttons && buttons.length > 0
      ? buttons
      : [{ text: '我知道了', type: 'primary' as const, onClick: handleClose }];

  return (
    <div
      className={classNames('global-modal-root', getPositionClass(position), {
        'global-modal-root--visible': animating,
      })}
      style={{ '--modal-duration': `${duration}ms` } as React.CSSProperties}
    >
      {/* 遮罩层 */}
      {showMask && (
        <div
          className={classNames('global-modal__mask', {
            'global-modal__mask--visible': animating,
          })}
          onClick={handleMaskClick}
        />
      )}

      {/* 弹窗主体 */}
      <div
        className={classNames('global-modal__panel', {
          'global-modal__panel--visible': animating,
          'global-modal__panel--toast': isToast,
        })}
        style={{ width }}
        role={isToast ? 'status' : 'dialog'}
        aria-modal={isToast ? undefined : true}
        aria-labelledby={title ? 'global-modal-title' : undefined}
      >
        {/* 标题栏（toast 模式不渲染） */}
        {!isToast && (title || closable) && (
          <div className="global-modal__header">
            {title && (
              <div id="global-modal-title" className="global-modal__title">
                {title}
              </div>
            )}
            {closable && (
              <button
                className="global-modal__close"
                onClick={handleClose}
                aria-label="关闭"
              >
                <CloseOutlined />
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div className={classNames('global-modal__body', { 'global-modal__body--toast': isToast })}>
          {content}
        </div>

        {/* 按钮区域（toast 模式不渲染） */}
        {resolvedButtons.length > 0 && (
          <div className="global-modal__footer">
            {resolvedButtons.map((btn, idx) => (
              <button
                key={idx}
                className={classNames('global-modal__btn', {
                  'global-modal__btn--primary': btn.type === 'primary' || (!btn.type && idx === resolvedButtons.length - 1),
                  'global-modal__btn--danger': btn.type === 'danger',
                  'global-modal__btn--default': btn.type === 'default' || (!btn.type && idx < resolvedButtons.length - 1),
                })}
                onClick={async () => {
                  await btn.onClick?.();
                  handleClose();
                }}
              >
                {btn.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalModal;
