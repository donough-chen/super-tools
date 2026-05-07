# GlobalModal 通用弹窗组件封装

**对话日期：** 2026-03-24  
**涉及模块：** GlobalModal 组件、Toast 模式、Header 集成

---

## 需求背景

项目需要一个全局通用的提示弹窗组件，满足以下场景：
- 更新公告展示（居中弹窗，支持 Markdown 内容）
- 操作确认弹窗（支持多按钮）
- 轻量 Toast 提示（右上角自动消失）
- 在任意组件中通过 Hook 调用，无需层层传 props

---

## 技术方案

### 架构设计

采用 **Zustand 全局状态 + Layout 层挂载** 的方案：

```
useGlobalModal (Hook)
    ↓ 调用
useModalStore (Zustand Store)
    ↓ 驱动
GlobalModal (组件，挂载在 BasicLayout)
```

- **状态集中管理**：弹窗的 `visible`、`options` 存储在 Zustand store 中
- **全局单例**：`GlobalModal` 组件挂载在 `BasicLayout` 最底部，全局唯一
- **Hook 调用**：任意组件通过 `useGlobalModal()` 获取 `showModal` / `showToast` / `hideModal`

### 位置系统

支持 7 种预设位置，通过 CSS 类名控制定位：

| 位置值 | 说明 | 入场动画方向 |
|--------|------|-------------|
| `center` | 居中 | 缩放 + 上移 |
| `top` | 顶部居中 | 向下滑入 |
| `bottom` | 底部居中 | 向上滑入 |
| `top-left` | 左上角 | 左上方滑入 |
| `top-right` | 右上角（默认） | 右上方滑入 |
| `bottom-left` | 左下角 | 左下方滑入 |
| `bottom-right` | 右下角 | 右下方滑入 |

### 动画实现

使用 **双 `requestAnimationFrame` + CSS transition** 方案，避免 DOM 挂载和动画同帧触发导致动画失效：

```tsx
useEffect(() => {
  if (visible) {
    setRendered(true);  // 先挂载 DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));  // 下一帧触发动画
    });
  } else {
    setAnimating(false);  // 触发退场动画
    setTimeout(() => setRendered(false), duration);  // 动画结束后卸载 DOM
  }
}, [visible]);
```

---

## 实现详情

### 新增文件

#### `store/modal.ts`
- 基于 Zustand + immer 的弹窗状态管理
- 导出类型：`ModalPosition`、`ModalButton`、`ModalOptions`、`ToastOptions`
- Actions：`showModal`、`showToast`、`hideModal`
- Toast 模式通过内部字段 `_isToast`、`_toastDuration` 标识，对外透明

#### `components/GlobalModal/index.tsx`
- 从 store 读取状态，无需 props
- Toast 模式：入场后启动定时器自动关闭，不响应 ESC 键，不渲染标题/按钮
- 支持 ESC 键关闭（普通弹窗）、遮罩点击关闭（可配置）
- 内容区域支持滚动，`aria` 无障碍属性完整

#### `components/GlobalModal/index.less`
- 动画时长通过 CSS 变量 `--modal-duration` 动态注入，支持运行时配置
- 各位置的初始偏移方向不同，实现方向性入场动画
- 响应式：移动端（≤480px）边缘弹窗自动铺满宽度

#### `utils/useGlobalModal.ts`
- 封装 `showModal`（带默认参数合并）和 `showToast`（默认 2 秒自动关闭）
- 返回 `{ showModal, showToast, hideModal }`

### 修改文件

#### `layouts/BasicLayout/index.tsx`
- 引入并挂载 `<GlobalModal />`，放置在 Footer 之后

---

## 问题与修复

### 问题 1：position 配置不生效，一直是 top-left 弹出

**根因：** `GlobalModal/index.tsx` 中 `getPositionClass` 函数返回的 CSS 类名格式为 `global-modal--top-right`，但 Less 文件中定义的是 `global-modal-root--top-right`（根容器类名前缀不一致）。

**修复：** 统一将 `getPositionClass` 返回值改为 `global-modal-root--[position]` 格式，与 Less 中的选择器保持一致。

### 问题 2：按钮点击后弹窗不关闭

**根因：** 按钮点击逻辑写反了：
```tsx
// ❌ 错误：有 onClick 时反而不关闭
if (!btn.onClick) handleClose();

// ✅ 正确：执行 onClick 后始终关闭
await btn.onClick?.();
handleClose();
```

**修复：** 将条件判断改为无条件调用 `handleClose()`。

---

## 文件变更记录

| 文件路径 | 变更类型 |
|----------|----------|
| `store/modal.ts` | 新增 |
| `components/GlobalModal/index.tsx` | 新增 |
| `components/GlobalModal/index.less` | 新增 |
| `utils/useGlobalModal.ts` | 新增 |
| `layouts/BasicLayout/index.tsx` | 修改（挂载 GlobalModal） |

---

## 使用示例

```tsx
import { useGlobalModal } from '@/utils/useGlobalModal';

const MyComponent = () => {
  const { showModal, showToast } = useGlobalModal();

  // 居中确认弹窗
  showModal({
    title: '确认删除',
    content: <p>此操作不可撤销，确定要删除吗？</p>,
    position: 'center',
    showMask: true,
    buttons: [
      { text: '取消', type: 'default', onClick: () => {} },
      { text: '确认删除', type: 'danger', onClick: handleDelete },
    ],
  });

  // 右上角 Toast（2秒自动关闭）
  showToast({ content: '操作成功！' });

  // 自定义时长 Toast
  showToast({ content: '⚠️ 窗口过多，请关闭闲置窗口', duration: 3000 });
};
```

---

## 后续计划

- [ ] 支持同时展示多个 Toast（队列模式）
- [ ] 支持 Toast 进度条动画
- [ ] 弹窗内容支持 PDF 预览（需引入 PDF.js）
