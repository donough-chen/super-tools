# MemberBadge 会员等级徽章组件

> 基于 React + TypeScript + Less 封装的会员等级图标组件，支持单个展示、批量展示、横/竖排列、尺寸控制、文案自定义等能力。

---

## 目录

- [安装依赖](#安装依赖)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [组件 API](#组件-api)
  - [MemberBadge](#memberbadge)
  - [MemberBadgeGroup](#memberbadgegroup)
- [类型定义](#类型定义)
- [使用示例](#使用示例)
  - [展示单个等级](#展示单个等级)
  - [全部等级横向排列](#全部等级横向排列)
  - [全部等级竖向排列](#全部等级竖向排列)
  - [指定部分等级](#指定部分等级)
  - [自定义文案](#自定义文案)
  - [纯图标模式](#纯图标模式)
  - [点击交互](#点击交互)
  - [大尺寸展示](#大尺寸展示)
- [等级说明](#等级说明)
- [样式定制](#样式定制)
- [注意事项](#注意事项)

---

## 安装依赖

组件基于以下环境，请确保项目已安装：

```bash
# React 18+
npm install react react-dom

# TypeScript
npm install -D typescript @types/react @types/react-dom

# Less（Vite 项目）
npm install -D less

# Less（Create React App 项目）
npm install less
```

---

## 目录结构

```
src/components/MemberBadge/
├── index.tsx                 # 统一导出入口
├── MemberBadge.tsx           # 单个徽章组件
├── MemberBadgeGroup.tsx      # 批量展示组件
├── MemberBadge.less          # 样式文件
├── types.ts                  # TypeScript 类型定义
├── constants.ts              # 等级默认配置常量
├── icons/
│   ├── NormalIcon.tsx        # 普通会员图标
│   ├── SilverIcon.tsx        # 银牌会员图标
│   ├── GoldIcon.tsx          # 金牌会员图标
│   ├── DiamondIcon.tsx       # 钻石会员图标
│   └── BlackGoldIcon.tsx     # 黑金会员图标
└── README.md
```

---

## 快速开始

```tsx
import { MemberBadge, MemberBadgeGroup } from '@/components/MemberBadge';

// 展示单个金牌会员图标
<MemberBadge level="gold" />

// 展示全部等级（横向排列）
<MemberBadgeGroup direction="horizontal" />
```

---

## 组件 API

### MemberBadge

单个会员等级徽章组件。

| 属性          | 类型                      | 默认值      | 是否必填 | 说明                         |
| ------------- | ------------------------- | ----------- | -------- | ---------------------------- |
| `level`       | `MemberLevel`             | —           | ✅ 必填  | 会员等级                     |
| `size`        | `number`                  | `80`        | ❌       | 图标尺寸（px），名称字号自适应 |
| `showName`    | `boolean`                 | `true`      | ❌       | 是否显示等级名称             |
| `showLevel`   | `boolean`                 | `true`      | ❌       | 是否显示等级英文文案         |
| `customName`  | `string`                  | —           | ❌       | 自定义等级名称，覆盖默认值   |
| `customLevel` | `string`                  | —           | ❌       | 自定义英文文案，覆盖默认值   |
| `className`   | `string`                  | —           | ❌       | 追加到根元素的自定义类名     |
| `style`       | `React.CSSProperties`     | —           | ❌       | 根元素内联样式               |
| `onClick`     | `(level: MemberLevel) => void` | —      | ❌       | 点击回调，传入后开启交互样式 |

---

### MemberBadgeGroup

批量展示多个会员等级徽章的容器组件。

| 属性           | 类型                                                                 | 默认值         | 是否必填 | 说明                                   |
| -------------- | -------------------------------------------------------------------- | -------------- | -------- | -------------------------------------- |
| `levels`       | `MemberLevel[]`                                                      | 全部 5 个等级  | ❌       | 指定要展示的等级列表                   |
| `direction`    | `'horizontal' \| 'vertical'`                                         | `'horizontal'` | ❌       | 排列方向                               |
| `size`         | `number`                                                             | `80`           | ❌       | 图标尺寸（px）                         |
| `gap`          | `number`                                                             | `24`           | ❌       | 徽章之间的间距（px）                   |
| `showName`     | `boolean`                                                            | `true`         | ❌       | 是否显示等级名称                       |
| `showLevel`    | `boolean`                                                            | `true`         | ❌       | 是否显示等级英文文案                   |
| `levelConfigs` | `Partial<Record<MemberLevel, { customName?: string; customLevel?: string }>>` | —   | ❌       | 各等级自定义文案配置                   |
| `className`    | `string`                                                             | —              | ❌       | 追加到容器的自定义类名                 |
| `style`        | `React.CSSProperties`                                                | —              | ❌       | 容器内联样式                           |
| `onClick`      | `(level: MemberLevel) => void`                                       | —              | ❌       | 点击某个徽章的回调，返回对应等级标识   |

---

## 类型定义

```typescript
/** 会员等级标识 */
type MemberLevel = 'normal' | 'silver' | 'gold' | 'diamond' | 'blackgold';

/** 排列方向 */
type BadgeDirection = 'horizontal' | 'vertical';
```

---

## 使用示例

### 展示单个等级

```tsx
import { MemberBadge } from '@/components/MemberBadge';

// 默认尺寸 80px
<MemberBadge level="diamond" />

// 自定义尺寸
<MemberBadge level="gold" size={120} />

// 仅展示图标，不显示文字
<MemberBadge level="silver" size={60} showName={false} showLevel={false} />
```

---

### 全部等级横向排列

```tsx
import { MemberBadgeGroup } from '@/components/MemberBadge';

<MemberBadgeGroup
  direction="horizontal"
  size={80}
  gap={30}
/>
```

---

### 全部等级竖向排列

```tsx
<MemberBadgeGroup
  direction="vertical"
  size={60}
  gap={16}
/>
```

---

### 指定部分等级

```tsx
<MemberBadgeGroup
  levels={['gold', 'diamond', 'blackgold']}
  direction="horizontal"
  size={90}
  gap={32}
/>
```

---

### 自定义文案

```tsx
<MemberBadgeGroup
  direction="horizontal"
  size={80}
  gap={24}
  levelConfigs={{
    normal:    { customName: '青铜会员', customLevel: 'LV.1' },
    silver:    { customName: '白银会员', customLevel: 'LV.2' },
    gold:      { customName: '黄金会员', customLevel: 'LV.3' },
    diamond:   { customName: '铂金会员', customLevel: 'LV.4' },
    blackgold: { customName: '至尊会员', customLevel: 'LV.5' },
  }}
/>
```

单个组件自定义文案：

```tsx
<MemberBadge
  level="blackgold"
  customName="至尊黑金"
  customLevel="SUPREME"
/>
```

---

### 纯图标模式

```tsx
<MemberBadgeGroup
  direction="horizontal"
  size={48}
  gap={12}
  showName={false}
  showLevel={false}
/>
```

---

### 点击交互

```tsx
import { useState } from 'react';
import { MemberBadgeGroup, MemberLevel } from '@/components/MemberBadge';

const Demo = () => {
  const [selected, setSelected] = useState<MemberLevel | null>(null);

  return (
    <>
      <MemberBadgeGroup
        direction="horizontal"
        size={80}
        gap={24}
        onClick={(level) => setSelected(level)}
      />
      {selected && <p>当前选中：{selected}</p>}
    </>
  );
};
```

---

### 大尺寸展示

```tsx
<MemberBadge
  level="blackgold"
  size={160}
  customName="至尊黑金"
  customLevel="SUPREME"
/>
```

---

## 等级说明

| 等级标识    | 默认名称   | 默认文案     | 主色调       | 动画效果     |
| ----------- | ---------- | ------------ | ------------ | ------------ |
| `normal`    | 普通会员   | MEMBER       | 灰紫色       | 无           |
| `silver`    | 银牌会员   | SILVER       | 银白色       | 无           |
| `gold`      | 金牌会员   | GOLD         | 金黄色       | 呼吸发光     |
| `diamond`   | 钻石会员   | DIAMOND      | 蓝紫色       | 蓝光呼吸     |
| `blackgold` | 黑金会员   | BLACK GOLD   | 黑金色       | 金光强呼吸   |

---

## 样式定制

组件使用 Less 编写，所有样式均通过**全局 class 名称**挂载，可在项目中直接覆盖：

```less
// 覆盖黑金会员名称标签样式
.member-badge-name.name-blackgold {
  letter-spacing: 4px;
  font-size: 16px !important;
}

// 覆盖悬停上移距离
.member-badge-wrapper:hover {
  transform: translateY(-10px);
}

// 覆盖金牌发光动画强度
@keyframes glowGoldAnim {
  0%, 100% { filter: drop-shadow(0 4px 12px rgba(255, 200, 0, 0.6)); }
  50%       { filter: drop-shadow(0 6px 28px rgba(255, 200, 0, 1)); }
}
```

### 主要 Class 列表

| Class 名称                  | 说明                   |
| --------------------------- | ---------------------- |
| `.member-badge-wrapper`     | 单个徽章根容器         |
| `.member-badge-wrapper.is-clickable` | 可点击状态  |
| `.member-badge-icon`        | 图标容器               |
| `.member-badge-icon.glow-gold`      | 金牌发光动画  |
| `.member-badge-icon.glow-diamond`   | 钻石发光动画  |
| `.member-badge-icon.glow-blackgold` | 黑金发光动画  |
| `.member-badge-name`        | 名称标签               |
| `.member-badge-name.name-{level}`   | 各等级名称样式 |
| `.member-badge-level`       | 等级文案标签           |
| `.member-badge-level.level-{level}` | 各等级文案样式 |
| `.member-badge-group`       | 批量容器               |
| `.member-badge-group.direction-horizontal` | 横向排列  |
| `.member-badge-group.direction-vertical`   | 竖向排列  |

---

## 注意事项

1. **Less 支持**：Vite 项目需安装 `less` 依赖；CRA 项目需安装 `less` 并将文件后缀改为 `.less`（CRA 默认支持）。

2. **SVG 渐变 ID 唯一性**：当前各图标内部使用了固定的渐变 `id`（如 `goldBg`、`silverCrown`），若同一页面**同时渲染多个相同等级**的图标，SVG 渐变 id 会冲突导致样式异常。解决方案：为每个图标的渐变 id 添加唯一后缀（如使用 `useId` Hook）。

3. **字号自适应**：名称和等级文案的字号会根据 `size` 属性自动缩放：
   - 名称字号 = `Math.max(10, size * 0.16)`
   - 等级字号 = `Math.max(8, size * 0.12)`

4. **无障碍访问**：传入 `onClick` 后，组件会自动添加 `role="button"`、`tabIndex={0}` 及键盘 `Enter` 触发支持。

5. **样式隔离**：组件使用全局 class，若项目中存在同名 class 可能产生冲突，建议在父容器加命名空间：
   ```tsx
   <div className="my-member-section">
     <MemberBadgeGroup direction="horizontal" />
   </div>
   ```
   ```less
   .my-member-section {
     .member-badge-name { font-size: 15px; }
   }
   ```