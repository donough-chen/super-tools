/**
 * 收藏拖拽排序页 FavoritesReorder
 *
 * 二级页面：长按拖拽排序当前用户所有收藏工具
 *
 * 交互：
 *   - 顶部：返回按钮 + 标题「长按拖动排序」 + 右侧确认按钮（✓）
 *   - 列表：单列，长按 400ms 激活拖拽，随手指/鼠标平移，松手吸附到目标位置
 *   - 确认：提交 PUT /api/favorites/reorder，成功后回到 /favorites 并自动刷新
 *
 * 关键修复（v2）：
 *   1. 初始化 localList 仅在组件首次挂载或长度变化时同步，避免拖拽结束后被 storeList 覆盖
 *   2. ITEM_HEIGHT 在挂载后通过 DOM 实测，解决 less 中 `gap` 导致的位移计算误差
 *   3. 长按阈值与其他页面对齐为 400ms
 *   4. 拖拽激活时给 item 缩放 + 阴影视觉反馈
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { navigateBack, navigateReplace } from '@/utils/navigator';
import { useFavoritesStore } from '../../../store';
import AppHeader from '../../../components/AppHeader';
import type { Favorite } from '../../../types/favorite';
import { resolveIcon } from '../../../utils/icon';
import './index.less';

/** 列表项完整高度（px，含 gap）的兜底值——实际会在挂载后实测覆盖。 */
const DEFAULT_ITEM_HEIGHT = 80;
/** 长按激活拖拽的阈值（ms） */
const LONG_PRESS_DELAY = 400;
/** 移动容忍量（px），超过此值前认定为点击/滑动列表 */
const MOVE_TOLERANCE = 8;

const DEFAULT_THEME = { bg: 'rgba(22, 119, 255, 0.1)', color: '#1677ff' };
function colorToTheme(hex?: string): { bg: string; color: string } {
  if (!hex) return DEFAULT_THEME;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return DEFAULT_THEME;
  return { bg: `rgba(${r}, ${g}, ${b}, 0.12)`, color: hex };
}

const FavoritesReorderPage: React.FC = () => {
  const storeList = useFavoritesStore(s => s.list);
  const fetchList = useFavoritesStore(s => s.fetchList);
  const reorder = useFavoritesStore(s => s.reorder);

  /** 本地可编辑副本（按 sort ASC） */
  const [localList, setLocalList] = useState<Favorite[]>([]);
  /** 正在拖拽的原始 index（相对 localList） */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** 当前拖拽偏移（px） */
  const [dragOffset, setDragOffset] = useState(0);
  /**
   * 松手 → 数组重排的"吸附瞬间"状态。
   * true 期间所有 item 的 transition 被禁用，避免：
   *   - 被拖项从 translateY(offset) 回到 translateY(0) 走 0.3s 弹性曲线
   *   - 其他项（因 DOM 复用）从之前的让位 translateY 回到 0 被动画
   * 下一帧恢复 false，后续交互依旧保持弹性动画。
   */
  const [settling, setSettling] = useState(false);
  /** 提交状态 */
  const [submitting, setSubmitting] = useState(false);
  /** 轻提示 */
  const [toast, setToast] = useState<string | null>(null);

  const startYRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const movedRef = useRef(false);
  /** 是否已完成首次数据初始化（避免拖拽后被 storeList 覆盖） */
  const initializedRef = useRef(false);
  /** 列表容器引用，用于实测 item 真实高度 */
  const listRef = useRef<HTMLDivElement>(null);
  /** 实测 item 单位高度（含 gap） */
  const itemHeightRef = useRef(DEFAULT_ITEM_HEIGHT);

  // 初始化：若 store 无数据则拉取
  useEffect(() => {
    if (storeList.length === 0) {
      fetchList();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 同步 storeList 到 localList 的时机：
   *   - 首次拿到数据（initializedRef=false 且 storeList 非空）
   *   - storeList 的"条目集合"发生变化（如外部删除/添加；用 code 串比较）
   * 不再依赖 dragIndex —— 拖拽结束后绝对不会被覆盖。
   */
  useEffect(() => {
    if (storeList.length === 0) return;
    if (!initializedRef.current) {
      setLocalList([...storeList]);
      initializedRef.current = true;
      return;
    }
    // 仅当集合变化（增/删）时重置本地列表；纯顺序差异保持本地编辑
    const storeCodes = storeList.map(f => f.toolCode).sort().join(',');
    const localCodes = localList.map(f => f.toolCode).sort().join(',');
    if (storeCodes !== localCodes) {
      setLocalList([...storeList]);
    }
  }, [storeList]); // eslint-disable-line react-hooks/exhaustive-deps

  // toast 自动隐藏
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // 挂载后实测 item 真实高度（覆盖默认值）
  useEffect(() => {
    if (localList.length < 2 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLDivElement>('.page-fav-reorder__item');
    if (items.length >= 2) {
      // 两相邻 item top 之差 = 实际高度 + gap
      const top0 = items[0].getBoundingClientRect().top;
      const top1 = items[1].getBoundingClientRect().top;
      const measured = top1 - top0;
      if (measured > 0) itemHeightRef.current = measured;
    } else if (items.length === 1) {
      itemHeightRef.current = items[0].offsetHeight;
    }
  }, [localList.length]);

  /** 清除长按计时器 */
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  /** 启动一次拖拽（被长按触发） */
  const beginDrag = useCallback((index: number) => {
    activeIndexRef.current = index;
    setDragIndex(index);
    setDragOffset(0);
    offsetRef.current = 0;
    // 触发轻微振动反馈（如果支持）
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(20); } catch {}
    }
  }, []);

  /** 结束拖拽：吸附到目标 index，并以函数式更新形式提交 */
  const endDrag = useCallback(() => {
    const fromIndex = activeIndexRef.current;
    if (fromIndex === null) return;
    const offset = offsetRef.current;
    const h = itemHeightRef.current || DEFAULT_ITEM_HEIGHT;
    const delta = Math.round(offset / h);

    // 关键：进入 settling 状态——这一帧禁用所有 item 的 transition，
    // 让「被拖项 transform 归零 + 数组重排后旧节点 transform 归零」瞬时完成，
    // 避免 CSS 中 `transition: transform var(--transition-bounce)` 把归零过程
    // 做成 0.3s 的回弹动画，表现为「松手后从上往下弹一下」。
    setSettling(true);

    // 清拖拽状态（同批次提交）
    activeIndexRef.current = null;
    offsetRef.current = 0;
    setDragIndex(null);
    setDragOffset(0);

    if (delta !== 0) {
      setLocalList(prev => {
        const toIndex = Math.max(0, Math.min(prev.length - 1, fromIndex + delta));
        if (toIndex === fromIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    }

    // 下下一帧恢复 transition——此时 settling=false 已随上一次渲染生效，
    // 使用 double rAF 确保浏览器已经把「transform 归零」这一帧画出来了，
    // 再打开 transition 不会回灌到刚才的归零过程上。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSettling(false);
      });
    });
  }, []);

  /** 取消拖拽（未达到长按阈值或移动过大时） */
  const cancelDrag = useCallback(() => {
    clearLongPressTimer();
    activeIndexRef.current = null;
    offsetRef.current = 0;
    setDragIndex(null);
    setDragOffset(0);
  }, []);

  /** touch/mouse 共用：记录按下起点并启动长按计时器 */
  const handleStart = (index: number, clientY: number) => {
    startYRef.current = clientY;
    movedRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        beginDrag(index);
      }
    }, LONG_PRESS_DELAY);
  };

  /** 统一 move 处理：按下时仅计算移动是否超过容差；拖拽时更新 offset */
  const handleMove = (clientY: number) => {
    if (activeIndexRef.current === null) {
      // 尚未进入拖拽：检查是否超过容差以取消长按
      if (Math.abs(clientY - startYRef.current) > MOVE_TOLERANCE) {
        movedRef.current = true;
        clearLongPressTimer();
      }
      return;
    }
    // 已进入拖拽：更新 offset
    const offset = clientY - startYRef.current;
    offsetRef.current = offset;
    setDragOffset(offset);
  };

  /** 统一 end 处理 */
  const handleEnd = () => {
    clearLongPressTimer();
    if (activeIndexRef.current !== null) {
      endDrag();
    } else {
      cancelDrag();
    }
  };

  // ==================== 全局 move/up 监听（仅在拖拽激活期间） ====================
  useEffect(() => {
    if (dragIndex === null) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault(); // 阻止列表滚动
      handleMove(e.touches[0].clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };
    const onTouchEnd = () => handleEnd();
    const onMouseUp = () => handleEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 计算每一项的 transform：被拖拽项跟随手指；其它项让位 */
  const computeItemStyle = (index: number): React.CSSProperties => {
    // 松手吸附帧：所有 item 强制无过渡，避免 transform 归零被弹性曲线动画化
    if (settling) {
      return { transition: 'none' };
    }
    if (dragIndex === null) return {};
    const h = itemHeightRef.current || DEFAULT_ITEM_HEIGHT;
    if (index === dragIndex) {
      // 被拖拽项：跟手指走
      return {
        transform: `translateY(${dragOffset}px) scale(1.02)`,
        zIndex: 20,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
        transition: 'none',
      };
    }
    // 其它项：根据拖拽偏移让位
    const delta = Math.round(dragOffset / h);
    const from = dragIndex;
    const to = Math.max(0, Math.min(localList.length - 1, from + delta));
    let shift = 0;
    if (from < index && index <= to) shift = -h; // 向上移
    else if (to <= index && index < from) shift = h; // 向下移
    return {
      transform: `translateY(${shift}px)`,
      transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  };

  /** 确认提交 */
  const handleConfirm = async () => {
    if (submitting) return;
    if (localList.length === 0) {
      navigateBack();
      return;
    }
    setSubmitting(true);
    const orderedToolCodes = localList.map(f => f.toolCode);
    const ok = await reorder(orderedToolCodes);
    setSubmitting(false);
    if (ok) {
      setToast('排序已保存');
      // 稍作停留后返回
      setTimeout(() => {
        navigateReplace('/favorites');
      }, 600);
    } else {
      setToast('保存失败，请重试');
    }
  };

  /** 是否显示空状态 */
  const isEmpty = !localList || localList.length === 0;

  /** 右侧确认按钮 slot */
  const confirmSlot = (
    <div
      className={`page-fav-reorder__confirm${submitting ? ' page-fav-reorder__confirm--disabled' : ''}`}
      onClick={handleConfirm}
      aria-label="确认排序"
    />
  );

  const renderIcon = (fav: Favorite) => {
    const theme = colorToTheme(fav.tool.color);
    const iconUrl = resolveIcon(fav.tool.icon);
    if (iconUrl) {
      return <img className="page-fav-reorder__item-icon" src={iconUrl} alt={fav.tool.name} />;
    }
    return (
      <i
        className="page-fav-reorder__item-icon page-fav-reorder__item-icon--placeholder"
        style={{ background: theme.bg, color: theme.color }}
      />
    );
  };

  return (
    <div className="page-fav-reorder">
      <AppHeader
        title="长按拖动排序"
        showBack
        onBack={() => navigateBack()}
        rightSlot={confirmSlot}
      />

      <main className="page-fav-reorder__content">
        {isEmpty ? (
          <div className="page-fav-reorder__empty">暂无可排序的收藏</div>
        ) : (
          <>
            <div className="page-fav-reorder__hint">长按并上下拖动以调整顺序</div>
            <div className="page-fav-reorder__list" ref={listRef}>
              {localList.map((fav, index) => (
                <div
                  key={fav.toolCode}
                  className={`page-fav-reorder__item${dragIndex === index ? ' page-fav-reorder__item--dragging' : ''}`}
                  style={computeItemStyle(index)}
                  onTouchStart={(e) => handleStart(index, e.touches[0].clientY)}
                  onTouchMove={(e) => {
                    // 未激活拖拽期间也要监听，判定是否取消长按
                    if (activeIndexRef.current === null && e.touches[0]) {
                      handleMove(e.touches[0].clientY);
                    }
                  }}
                  onTouchEnd={() => {
                    if (activeIndexRef.current === null) cancelDrag();
                  }}
                  onTouchCancel={() => cancelDrag()}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    handleStart(index, e.clientY);
                  }}
                >
                  <span className="page-fav-reorder__drag-handle" aria-label="拖动" />
                  {renderIcon(fav)}
                  <div className="page-fav-reorder__item-info">
                    <span className="page-fav-reorder__item-name">{fav.tool.name}</span>
                    {fav.tool.description && (
                      <span className="page-fav-reorder__item-sub">{fav.tool.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {toast && <div className="page-fav-reorder__toast">{toast}</div>}
    </div>
  );
};

export default FavoritesReorderPage;
