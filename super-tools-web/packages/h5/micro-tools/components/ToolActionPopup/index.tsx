/**
 * ToolActionPopup - 工具项长按操作浮层
 *
 * 设计要点（v2）：
 *  1. 通过 Portal 渲染到 document.body，不受父容器 overflow/relative 约束
 *  2. 通过 targetRef 自动计算位置，智能处理屏幕边界（不够空间时自动上弹/左对齐）
 *  3. 紧凑尺寸：按钮 height≈44px、min-width=132px
 *  4. 全屏遮罩：touchstart/mousedown 立即关闭，防止误触其他 item
 *  5. 入场/退出反弹动画：scale + opacity，transform-origin 根据实际方向切换
 *
 * 使用：
 *   const itemRef = useRef<HTMLDivElement>(null);
 *   <div ref={itemRef} {...longPressBind}>...</div>
 *   <ToolActionPopup
 *     visible={popupKey === key}
 *     actions={[...]}
 *     targetRef={itemRef}
 *     onClose={() => setPopupKey(null)}
 *   />
 */
import React, {
  FC,
  ReactNode,
  RefObject,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import './ToolActionPopup.less';

export interface ToolActionItem {
  /** 唯一 key */
  key: string;
  /** 按钮文字 */
  label: string;
  /** 操作色调：default / danger / primary */
  variant?: 'default' | 'danger' | 'primary';
  /** 左侧图标（iconfont class 或 <img />）。可选 */
  icon?: ReactNode;
  /** 点击回调 */
  onClick: () => void;
}

export interface ToolActionPopupProps {
  /** 是否可见 */
  visible: boolean;
  /** 操作项列表（自上而下） */
  actions: ToolActionItem[];
  /** 目标 item 的 ref，弹层相对它定位（右下角对齐） */
  targetRef: RefObject<HTMLElement>;
  /** 关闭回调 */
  onClose: () => void;
}

/** 菜单基础样式尺寸 —— 用于提前估算，避免首帧闪烁 */
const ESTIMATE_WIDTH = 148;
const ESTIMATE_ITEM_H = 44;
const MENU_PADDING_Y = 6;
/** 安全边距（距屏幕边缘） */
const SAFE_EDGE = 12;
/** 菜单与目标 item 的间距 */
const OFFSET = 6;

interface PopupPosition {
  left: number;
  top: number;
  /** 用于动画 transform-origin */
  origin: 'top right' | 'top left' | 'bottom right' | 'bottom left';
}

const ToolActionPopup: FC<ToolActionPopupProps> = ({
  visible,
  actions,
  targetRef,
  onClose,
}) => {
  /** 受控 mounted：visible 关闭后延迟卸载 DOM 以播放退出动画 */
  const [mounted, setMounted] = useState(visible);
  /** 动画 class 激活标记 */
  const [active, setActive] = useState(false);
  /** 计算得到的位置 */
  const [position, setPosition] = useState<PopupPosition | null>(null);
  /** menu 实际 DOM 引用，用于获取真实尺寸做二次精确定位 */
  const menuRef = useRef<HTMLDivElement>(null);
  /** 遮罩 DOM 引用，用于挂载非 passive 原生事件 */
  const maskRef = useRef<HTMLDivElement>(null);
  /** 保留最新的 onClose 引用（避免原生事件回调捕获过期闭包） */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 控制 mount / active 动画
  useEffect(() => {
    if (visible) {
      setMounted(true);
      const id = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(id);
    }
    setActive(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [visible]);

  /** 计算位置：根据目标 rect 及屏幕尺寸，决定弹出方向与对齐 */
  const computePosition = (): PopupPosition | null => {
    const el = targetRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 优先从 menuRef 取真实尺寸；首帧用估算
    const menuEl = menuRef.current;
    const w = menuEl ? menuEl.offsetWidth : ESTIMATE_WIDTH;
    const h = menuEl
      ? menuEl.offsetHeight
      : MENU_PADDING_Y * 2 + actions.length * ESTIMATE_ITEM_H;

    // 水平方向：默认右对齐 item 右侧；右边空间不够则左对齐 item 左侧
    let left = rect.right - w;
    let horizAlign: 'right' | 'left' = 'right';
    if (left < SAFE_EDGE) {
      // 右对齐会出屏：改左对齐
      left = rect.left;
      horizAlign = 'left';
    }
    // 二次兜底：如果还是超出，贴到安全边距内
    if (left + w > vw - SAFE_EDGE) {
      left = vw - SAFE_EDGE - w;
    }
    if (left < SAFE_EDGE) left = SAFE_EDGE;

    // 垂直方向：默认 item 下方；下方空间不足则改到上方
    let top = rect.bottom + OFFSET;
    let vertAlign: 'top' | 'bottom' = 'top';
    if (top + h > vh - SAFE_EDGE) {
      top = rect.top - OFFSET - h;
      vertAlign = 'bottom';
    }
    if (top < SAFE_EDGE) top = SAFE_EDGE;

    // transform-origin：贴近 item 的那一侧
    const origin: PopupPosition['origin'] =
      vertAlign === 'top'
        ? (horizAlign === 'right' ? 'top right' : 'top left')
        : (horizAlign === 'right' ? 'bottom right' : 'bottom left');

    return { left, top, origin };
  };

  // 每次 visible 为 true 时先估算一次位置（首帧）
  useLayoutEffect(() => {
    if (!visible) return;
    const pos = computePosition();
    setPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 菜单 DOM 就绪后再次精确计算（获取真实宽高）
  useLayoutEffect(() => {
    if (!mounted || !visible) return;
    const pos = computePosition();
    if (pos) setPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, visible, actions.length]);

  // 滚动 / 缩放时跟随重新计算
  useEffect(() => {
    if (!visible) return;
    const recompute = () => {
      const pos = computePosition();
      if (pos) setPosition(pos);
    };
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * 遮罩关闭逻辑：使用原生 click 监听而非 touchstart/mousedown。
   *
   * 为什么不用 touchstart + preventDefault：
   *  - React 合成 touchstart 是 passive 的（无法 preventDefault）
   *  - 我们之前用原生 addEventListener + { passive: false } + preventDefault 来
   *    阻断穿透；但 preventDefault 会取消整个触摸序列的合成 click 事件，
   *    导致菜单按钮上的 click 被误杀（尤其在遮罩监听被意外触发时）
   *
   * click 更稳：只在 target 是 maskEl 时关闭，且不会与按钮 click 冲突。
   * 冒泡次序：button click → menu (stopPropagation) 到此终止，
   *           mask click → 直接走这里的 handler。
   *
   * 事件穿透到下方 item 的问题，改由 item 本身的 longPress 冷却处理。
   */
  useEffect(() => {
    if (!mounted) return;
    const maskEl = maskRef.current;
    if (!maskEl) return;

    const close = (e: MouseEvent) => {
      // 仅当点击 target 就是遮罩本身（非子元素、非菜单）时关闭
      if (e.target !== maskEl) return;
      e.stopPropagation();
      onCloseRef.current();
    };

    maskEl.addEventListener('click', close);
    return () => {
      maskEl.removeEventListener('click', close);
    };
  }, [mounted]);

  if (!mounted) return null;

  const menuStyle: React.CSSProperties = position
    ? {
      left: `${position.left}px`,
      top: `${position.top}px`,
      transformOrigin: position.origin,
    }
    : { visibility: 'hidden' }; // 首帧尚未得到位置时隐藏

  const node = (
    <div
      className={classnames('tool-action-popup', {
        'tool-action-popup--active': active,
      })}
    >
      {/* 全屏透明遮罩：原生 touchstart/mousedown 关闭（见 useEffect），此处仅处理右键菜单 */}
      <div
        ref={maskRef}
        className="tool-action-popup__mask"
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* 菜单本体 */}
      <div
        ref={menuRef}
        className="tool-action-popup__menu"
        style={menuStyle}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {actions.map((act) => (
          <button
            key={act.key}
            type="button"
            className={classnames(
              'tool-action-popup__btn',
              `tool-action-popup__btn--${act.variant || 'default'}`,
            )}
            onClick={(e) => {
              // 临时诊断：确认 click 是否触发
              // eslint-disable-next-line no-console
              console.log('[ToolActionPopup] button click:', act.key);
              e.stopPropagation();
              act.onClick();
              onClose();
            }}
          >
            {act.icon && <span className="tool-action-popup__btn-icon">{act.icon}</span>}
            <span className="tool-action-popup__btn-label">{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // Portal 到 body，彻底摆脱父容器约束
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(node, document.body);
};

export default ToolActionPopup;
