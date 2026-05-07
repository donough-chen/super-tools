/**
 * 轻量 Toast 工具（无依赖，纯 DOM 实现）
 * - 同时只显示一个；新调用替换旧的
 * - 自动消失，无关闭按钮
 * - 与 antd-mobile / vant 等不冲突，可后续替换为 UI 库
 */

let activeEl: HTMLDivElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;

const STYLE_ID = '__super_tools_toast_style__';

const ensureStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.st-toast {
  position: fixed;
  left: 50%;
  bottom: 200px;
  transform: translateX(-50%);
  max-width: 80vw;
  padding: 16px 32px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 26px;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  text-align: center;
}
.st-toast--visible { opacity: 1; }
.st-toast--success { background: rgba(48, 167, 69, 0.92); }
.st-toast--error { background: rgba(220, 47, 47, 0.92); }
`;
  document.head.appendChild(style);
};

export type ToastType = 'info' | 'success' | 'error';

export const showToast = (text: string, type: ToastType = 'info', duration = 2000) => {
  if (typeof document === 'undefined') return;
  ensureStyle();

  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (activeEl) {
    activeEl.remove();
    activeEl = null;
  }

  const el = document.createElement('div');
  el.className = `st-toast st-toast--${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  // 触发过渡
  // eslint-disable-next-line no-void
  void el.offsetWidth;
  el.classList.add('st-toast--visible');

  activeEl = el;
  activeTimer = setTimeout(() => {
    el.classList.remove('st-toast--visible');
    setTimeout(() => {
      if (el === activeEl) {
        el.remove();
        activeEl = null;
      }
    }, 200);
  }, duration);
};

/** 复制文本到剪贴板，支持 iOS Safari 降级 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  // 降级：用 textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
};
