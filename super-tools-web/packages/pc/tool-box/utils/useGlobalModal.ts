import { useCallback } from 'react';
import { useModalStore, type ModalOptions, type ToastOptions } from '@/store/modal';

/**
 * 全局弹窗 Hook
 *
 * @example
 * ```tsx
 * const { showModal, showToast, hideModal } = useGlobalModal();
 *
 * // 普通弹窗
 * showModal({
 *   title: '提示',
 *   content: <div>自定义内容</div>,
 *   position: 'center',
 *   buttons: [
 *     { text: '取消', type: 'default', onClick: handleCancel },
 *     { text: '确认', type: 'primary', onClick: handleConfirm },
 *   ],
 * });
 *
 * // Toast 提示（2秒后自动关闭）
 * showToast({ content: '操作成功！' });
 * showToast({ content: '⚠️ 窗口过多', duration: 3000 });
 * ```
 */
export const useGlobalModal = () => {
  const { showModal: _showModal, showToast: _showToast, hideModal } = useModalStore();

  const showModal = useCallback(
    (options: ModalOptions) => {
      _showModal({
        position: 'top-right',
        closable: true,
        maskClosable: true,
        animationDuration: 300,
        width: 420,
        ...options,
      });
    },
    [_showModal],
  );

  const showToast = useCallback(
    (options: ToastOptions) => {
      _showToast({
        position: 'top-right',
        duration: 2000,
        animationDuration: 300,
        ...options,
      });
    },
    [_showToast],
  );

  return { showModal, showToast, hideModal };
};
