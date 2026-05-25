# HexColorIcon 组件

> 给 PNG/SVG 图标按 hex 颜色精准染色的 React 组件，**主题色驱动**的图标动态着色方案。

## ✨ 特性

- **100% 精准染色**：现代浏览器走 CSS `mask-image` + `background-color`，染色无任何色差。
- **自动降级**：旧浏览器自动回落到 SPSA 求解的 CSS `filter` 方案，零兼容性风险。
- **零样式入侵**：API 与 `<img>` 完全兼容，可直接替换原 `<img>` 用法。
- **零成本切换主题**：搭配 `themeColor` 实现整站主题色实时切换，GPU 合成无延迟。
- **支持 PNG / 纯色 SVG**：透明背景图标效果最佳。

---

## 🚀 快速上手

```tsx
import HexColorIcon from '@/components/HexColorIcon';

// 基础：染成主题蓝
<HexColorIcon src="/icons/star.png" color="#1677ff" size={24} />

// 简写 hex
<HexColorIcon src="/icons/heart.svg" color="#f00" size={32} />

// 不传 color → 保持原图原色（用于 inactive 等态）
<HexColorIcon src="/icons/logo.png" size={48} />

// 自定义宽高（非正方形）
<HexColorIcon src="/icons/arrow.svg" color="#1677ff" style={{ width: 32, height: 16 }} />

// 透传任意属性（onClick / draggable / aria-* 等）
<HexColorIcon
  src="/icons/bell.svg"
  color="#52c41a"
  size={24}
  onClick={() => console.log('clicked')}
/>
```

---

## 🎨 跟随主题色

搭配全局 store，所有图标颜色随用户切换的主题色实时变化：

```tsx
import { useGlobalStore } from '@/store';
import HexColorIcon from '@/components/HexColorIcon';

const ToolIcon = ({ src }: { src: string }) => {
  const themeColor = useGlobalStore(s => s.themeColor);
  return <HexColorIcon src={src} color={themeColor} size={28} />;
};
```

> 项目内典型用法可参考 [`AppTabBar`](../AppTabBar/index.tsx)（active 项）、首页/收藏页/特色页的列表图标渲染。

---

## 🧠 渲染策略

组件按以下优先级自动选择渲染路径，**调用方完全无感**：

```text
┌──────────────────────────────────────────────────┐
│ 1) 不传 color  → <img>  原图原色                 │
│ 2) 支持 mask-image（现代浏览器，✅ 首选）        │
│    → <span> + mask-image + background-color      │
│    → 100% 精准、GPU 合成、无延迟                 │
│ 3) 不支持 mask（极旧 WebKit，fallback）          │
│    → <img> + filter（SPSA 反向求解 6 段链路）    │
│    → 首次 5~50ms，命中缓存后瞬时返回             │
└──────────────────────────────────────────────────┘
```

**能力检测**：通过 `CSS.supports('mask-image', 'url("")') || CSS.supports('-webkit-mask-image', 'url("")')` 一次性判定，结果缓存到模块级常量，无重复开销。

**特殊色短路**：`#000` / `#fff` 在 fallback 路径上直接返回常量 filter，无需进入 SPSA 求解器。

---

## 📦 Props

组件 props 继承 `React.HTMLAttributes<HTMLElement>`，可透传所有原生属性（`onClick`、`aria-*`、`data-*` 等）。

| Prop        | 类型                          | 默认值   | 说明                                                               |
| ----------- | ----------------------------- | -------- | ------------------------------------------------------------------ |
| `src`       | `string`                      | **必填** | 图标资源 URL，建议 PNG（透明）或纯色 SVG                           |
| `color`     | `string`                      | -        | 染色目标 hex（`#fff` / `#ffffff`）。**不传 → 原图原色**            |
| `size`      | `number \| string`            | -        | 正方形尺寸：number 自动加 `px`；string 原样写入 `width/height`     |
| `style`     | `CSSProperties`               | -        | 自定义样式，会与内置样式合并                                       |
| `className` | `string`                      | -        | 自定义类名                                                         |
| `alt`       | `string`                      | `'icon'` | mask 路径下作为 `aria-label`；fallback 路径下作为 `<img>` 的 `alt` |
| `...rest`   | `HTMLAttributes<HTMLElement>` | -        | 其它 HTML 属性（如 `onClick` / `aria-hidden` 等）                  |

> 💡 **DOM 输出差异**：mask 路径渲染为 `<span role="img">`，fallback 路径渲染为 `<img>`。如果你的 less 选择器使用了 `img&` / `img.xxx` 这种**标签名硬绑定**，请同时声明 `span&` / `span.xxx` 以兼容两种 DOM。
>
> 项目内已经为图标类做了双标签兼容声明，例如 [`pages/home/index.less`](../../pages/home/index.less) 与 [`pages/favorites/index.less`](../../pages/favorites/index.less) 中：
>
> ```less
> img&__tool-iconfont,
> span&__tool-iconfont {
>   background: transparent;
>   object-fit: contain;
> }
> ```

---

## ⚠️ 注意事项

1. **图标资源建议**：透明背景的 **PNG** 或 **纯色 SVG**。彩色照片不适合本组件——mask 路径会丢失颜色，filter 路径误差大。
2. **跨域资源**：mask-image 加载的图片必须可被浏览器访问；同源或开启 CORS 都可以。`<img>` 能加载，mask 就能加载。
3. **SSR**：能力检测内部已做 `typeof window === 'undefined'` 保护，SSR 阶段保守降级到 filter 路径，hydrate 后会自动切换为 mask 渲染（如有需要可在客户端首屏后再渲染）。
4. **样式优先级**：内置样式（mask-\* / filter / size）会被外部 `style` prop 覆盖。如需关闭染色，传 `color={undefined}` 即可。
5. **性能**：mask 路径完全无 JS 计算，仅写若干 CSS 属性；filter 路径首次有 5~50ms 求解开销，结果会缓存到 `filterCache`。

---

## 🔬 工程导出（可选）

```ts
import HexColorIcon, {
  hexToFilter, // 直接拿到一个 hex 对应的 filter 字符串（仅 fallback 路径使用）
  hexToRgb, // hex → {r,g,b}
  isValidHex, // 校验 hex 字符串
  filterCache, // fallback 路径的内置缓存（Map）
  supportsMaskImage, // 当前环境是否支持 mask-image
} from '@/components/HexColorIcon';
```

如果项目编译期已知主题色，可以提前调用 `hexToFilter(hex)` 预热 fallback 缓存，避免极旧浏览器首次渲染时的求解抖动。

---

## 📝 变更历史

- **v2.0** — 引入 CSS `mask-image` + `background-color` 作为首选渲染策略（100% 精准），原 SPSA filter 求解器作为旧浏览器 fallback。API 保持完全兼容。
- **v1.0** — 通过 SPSA 反向求解 CSS filter 链（invert/sepia/saturate/hue-rotate/brightness/contrast）实现染色。
