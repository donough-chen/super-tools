/**
 * AppModal 底部向上弹起弹窗组件
 * 支持左右滑动/上下滑动两种内容模式
 * 渲染 html/text/image/markdown 等内容类型
 */
import React, { FC, ReactNode, useRef, useCallback } from 'react';
import classnames from 'classnames';
import './AppModal.less';

export type ModalContentType = 'html' | 'text' | 'image' | 'markdown';

export interface AppModalProps {
  visible: boolean;
  title?: string;
  content?: ReactNode;
  contentType?: ModalContentType;
  /** 内容滑动方向 */
  swipeDirection?: 'horizontal' | 'vertical';
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 点击蒙层关闭 */
  maskClosable?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const AppModal: FC<AppModalProps> = ({
  visible,
  title,
  content,
  contentType = 'text',
  swipeDirection = 'vertical',
  showClose = true,
  confirmText = '确认',
  cancelText = '取消',
  maskClosable = true,
  onClose,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY.current;
      // 下滑超过 100px 关闭弹窗
      if (diff > 100 && maskClosable) {
        onClose?.();
      }
    },
    [maskClosable, onClose],
  );

  if (!visible) return null;

  return (
    <div className="app-modal">
      <div className="app-modal__mask" onClick={maskClosable ? onClose : undefined} />
      <div
        ref={modalRef}
        className={classnames('app-modal__content', {
          'app-modal__content--horizontal': swipeDirection === 'horizontal',
        })}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 标题栏 */}
        <div className="app-modal__header">
          {title && <h3 className="app-modal__title">{title}</h3>}
          {showClose && (
            <button className="app-modal__close" onClick={onClose} aria-label="关闭" />
          )}
        </div>

        {/* 内容区 */}
        <div
          className={classnames(
            'app-modal__body',
            `app-modal__body--${contentType}`,
          )}
        >
          {content}
        </div>

        {/* 按钮区 */}
        {(onConfirm || onCancel) && (
          <div className="app-modal__footer">
            {onCancel && (
              <button className="app-modal__btn app-modal__btn--cancel" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button className="app-modal__btn app-modal__btn--confirm" onClick={onConfirm}>
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppModal;
