// 全局弹窗状态管理（Zustand + immer）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ReactNode } from 'react';

/** 弹窗显示位置 */
export type ModalPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** 弹窗按钮配置 */
export interface ModalButton {
  text: string;
  type?: 'primary' | 'default' | 'danger';
  onClick?: () => void | Promise<void>;
}

/** 弹窗配置参数 */
export interface ModalOptions {
  /** 弹窗标题，默认不显示 */
  title?: ReactNode;
  /** 弹窗内容，支持任意可渲染内容 */
  content: ReactNode;
  /** 显示位置，默认 top-right */
  position?: ModalPosition;
  /** 按钮配置，默认显示"我知道了" */
  buttons?: ModalButton[];
  /** 是否显示关闭图标，默认 true */
  closable?: boolean;
  /** 是否点击遮罩关闭，默认 true */
  maskClosable?: boolean;
  /** 是否显示遮罩层，默认 false（右上角等边缘位置不显示遮罩） */
  showMask?: boolean;
  /** 动画时长（ms），默认 300 */
  animationDuration?: number;
  /** 弹窗宽度，默认 420 */
  width?: number | string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否为 toast 模式（内部使用） */
  _isToast?: boolean;
  /** toast 自动关闭时长（ms），内部使用 */
  _toastDuration?: number;
}

/** Toast 配置参数 */
export interface ToastOptions {
  /** Toast 内容 */
  content: ReactNode;
  /** 显示位置，默认 top-right */
  position?: ModalPosition;
  /** 自动关闭时长（ms），默认 2000 */
  duration?: number;
  /** 动画时长（ms），默认 300 */
  animationDuration?: number;
  /** 关闭回调 */
  onClose?: () => void;
}

interface ModalState {
  visible: boolean;
  options: ModalOptions | null;
}

interface ModalActions {
  showModal: (options: ModalOptions) => void;
  showToast: (options: ToastOptions) => void;
  hideModal: () => void;
}

export const useModalStore = create<ModalState & ModalActions>()(
  immer((set) => ({
    visible: false,
    options: null,

    showModal: (options: ModalOptions) => {
      set((state) => {
        state.visible = true;
        state.options = options;
      });
    },

    showToast: (options: ToastOptions) => {
      set((state) => {
        state.visible = true;
        state.options = {
          content: options.content,
          position: options.position ?? 'top-right',
          animationDuration: options.animationDuration ?? 300,
          onClose: options.onClose,
          // toast 模式特征：无标题、无按钮、无关闭图标
          title: undefined,
          buttons: [],
          closable: false,
          maskClosable: false,
          showMask: false,
          width: 'auto',
          _isToast: true,
          _toastDuration: options.duration ?? 2000,
        };
      });
    },

    hideModal: () => {
      set((state) => {
        state.visible = false;
      });
    },
  })),
);
