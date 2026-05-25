import React, { useMemo, CSSProperties } from 'react';

// ==================== 类型定义 ====================

interface RGB {
  r: number;
  g: number;
  b: number;
}

// filter 的各项参数
interface FilterParams {
  invert: number;      // 0 ~ 1
  sepia: number;       // 0 ~ 1
  saturate: number;    // 0 ~ 10
  hueRotate: number;   // 0 ~ 360
  brightness: number;  // 0 ~ 2
  contrast: number;    // 0 ~ 2
}

interface SolverResult {
  filter: string;
  loss: number;        // 误差值，越小越精确
}

export interface HexColorIconProps extends React.HTMLAttributes<HTMLElement> {
  /** 图标资源 URL */
  src: string;
  /** 染色目标颜色（hex），不传则原图原色显示 */
  color?: string;
  /** 尺寸：number → px；string → 原样写入 width/height */
  size?: number | string;
  /** alt 文本（mask 模式下作为 aria-label） */
  alt?: string;
}

// ==================== 渲染策略：能力检测 ====================

/**
 * 检测当前浏览器是否支持 CSS `mask-image: url(...)`。
 *
 * 现代浏览器（Chrome 79+ / Safari 15.4+ / iOS Safari 14+ / 微信内核）原生支持，
 * 旧 WebKit 仍走 -webkit-mask-image 前缀。两者只要任一支持，就能 100% 精准染色。
 *
 * 该检测仅做一次，结果缓存到模块级常量，避免每次渲染重复计算。
 */
const supportsMaskImage = (() => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || !CSS.supports) {
    // SSR 或非常古老的环境，保守降级到 filter 方案
    return false;
  }
  try {
    return (
      CSS.supports('mask-image', 'url("")') ||
      CSS.supports('-webkit-mask-image', 'url("")')
    );
  } catch {
    return false;
  }
})();

// ==================== Color 类（模拟 CSS filter 对颜色的影响）====================

class Color {
  r: number;
  g: number;
  b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  clamp(): this {
    this.r = Math.max(0, Math.min(255, this.r));
    this.g = Math.max(0, Math.min(255, this.g));
    this.b = Math.max(0, Math.min(255, this.b));
    return this;
  }

  // 模拟 CSS invert()
  invert(value: number): this {
    this.r = this.r + (255 - 2 * this.r) * value;
    this.g = this.g + (255 - 2 * this.g) * value;
    this.b = this.b + (255 - 2 * this.b) * value;
    return this.clamp();
  }

  // 模拟 CSS sepia()
  sepia(value: number): this {
    const r = this.r, g = this.g, b = this.b;
    this.r = Math.min(r * (1 - 0.607 * value) + g * 0.769 * value + b * 0.189 * value, 255);
    this.g = Math.min(r * 0.349 * value + g * (1 - 0.314 * value) + b * 0.168 * value, 255);
    this.b = Math.min(r * 0.272 * value + g * 0.534 * value + b * (1 - 0.869 * value), 255);
    return this.clamp();
  }

  // 模拟 CSS saturate()
  saturate(value: number): this {
    const r = this.r, g = this.g, b = this.b;
    this.r = Math.min(r * (0.213 + 0.787 * value) + g * (0.715 - 0.715 * value) + b * (0.072 - 0.072 * value), 255);
    this.g = Math.min(r * (0.213 - 0.213 * value) + g * (0.715 + 0.285 * value) + b * (0.072 - 0.072 * value), 255);
    this.b = Math.min(r * (0.213 - 0.213 * value) + g * (0.715 - 0.715 * value) + b * (0.072 + 0.928 * value), 255);
    return this.clamp();
  }

  // 模拟 CSS hue-rotate()
  hueRotate(angle: number): this {
    const rad = (angle / 180) * Math.PI;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const r = this.r, g = this.g, b = this.b;

    this.r = Math.min(
      r * (0.213 + cos * 0.787 - sin * 0.213) +
      g * (0.715 - cos * 0.715 - sin * 0.715) +
      b * (0.072 - cos * 0.072 + sin * 0.928),
      255
    );
    this.g = Math.min(
      r * (0.213 - cos * 0.213 + sin * 0.143) +
      g * (0.715 + cos * 0.285 + sin * 0.140) +
      b * (0.072 - cos * 0.072 - sin * 0.283),
      255
    );
    this.b = Math.min(
      r * (0.213 - cos * 0.213 - sin * 0.787) +
      g * (0.715 - cos * 0.715 + sin * 0.715) +
      b * (0.072 + cos * 0.928 + sin * 0.072),
      255
    );
    return this.clamp();
  }

  // 模拟 CSS brightness()
  brightness(value: number): this {
    this.r *= value;
    this.g *= value;
    this.b *= value;
    return this.clamp();
  }

  // 模拟 CSS contrast()
  contrast(value: number): this {
    this.r = this.r * value + 128 * (1 - value);
    this.g = this.g * value + 128 * (1 - value);
    this.b = this.b * value + 128 * (1 - value);
    return this.clamp();
  }

  // 计算与目标颜色的误差（欧氏距离）
  loss(target: Color): number {
    return (
      Math.pow(this.r - target.r, 2) +
      Math.pow(this.g - target.g, 2) +
      Math.pow(this.b - target.b, 2)
    );
  }

  // 转为 HSL（用于初始值估算）
  toHsl(): [number, number, number] {
    const r = this.r / 255, g = this.g / 255, b = this.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      switch (max) {
        case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / delta + 2) / 6; break;
        case b: h = ((r - g) / delta + 4) / 6; break;
      }
    }
    return [h * 360, s * 100, l * 100];
  }

  clone(): Color {
    return new Color(this.r, this.g, this.b);
  }
}

// ==================== SPSA 求解器（filter fallback 路径） ====================

class Solver {
  private target: Color;
  private targetHsl: [number, number, number];

  // 各参数的取值范围
  private readonly ranges = [1, 1, 100, 100, 1, 1] as const;

  constructor(target: Color) {
    this.target = target;
    this.targetHsl = target.toHsl();
  }

  /**
   * 对给定参数应用 filter，返回结果颜色
   * 参数顺序: [invert, sepia, saturate, hueRotate, brightness, contrast]
   * 起点是纯黑色 rgb(0,0,0)，因为我们先用 brightness(0) 将图片变黑
   */
  private applyFilter(params: number[]): Color {
    const color = new Color(0, 0, 0);
    color
      .invert(params[0])
      .sepia(params[1])
      .saturate(params[2])
      .hueRotate(params[3])
      .brightness(params[4])
      .contrast(params[5]);
    return color;
  }

  /**
   * 计算当前参数的总误差
   */
  private loss(params: number[]): number {
    const result = this.applyFilter(params);
    return result.loss(this.target);
  }

  /**
   * SPSA（同步扰动随机近似）优化算法
   * 通过随机扰动参数，迭代逼近最优解
   */
  private spsa(
    A: number,
    a: number[],
    c: number,
    params: number[],
    iters: number
  ): { params: number[]; loss: number } {
    const alpha = 1;
    const gamma = 0.16667;
    let bestParams = [...params];
    let bestLoss = this.loss(params);

    for (let k = 0; k < iters; k++) {
      const ck = c / Math.pow(k + 1, gamma);

      // 随机扰动方向（Bernoulli 分布）
      const delta = Array.from({ length: 6 }, () =>
        Math.random() > 0.5 ? 1 : -1
      );

      const paramsPlus = params.map((p, i) =>
        Math.max(0, Math.min(this.ranges[i], p + ck * delta[i]))
      );
      const paramsMinus = params.map((p, i) =>
        Math.max(0, Math.min(this.ranges[i], p - ck * delta[i]))
      );

      const lossPlus = this.loss(paramsPlus);
      const lossMinus = this.loss(paramsMinus);
      const gradient = (lossPlus - lossMinus) / (2 * ck);

      const ak = a.map((ai, i) => ai / Math.pow(A + k + 1, alpha));

      // 更新参数
      params = params.map((p, i) =>
        Math.max(0, Math.min(this.ranges[i], p - ak[i] * gradient * delta[i]))
      );

      const currentLoss = this.loss(params);
      if (currentLoss < bestLoss) {
        bestLoss = currentLoss;
        bestParams = [...params];
      }
    }

    return { params: bestParams, loss: bestLoss };
  }

  /**
   * 根据 HSL 估算初始参数（加速收敛）
   */
  private getInitialParams(): number[] {
    const [h, s, l] = this.targetHsl;
    return [
      l / 100,           // invert
      0.5,               // sepia
      s / 100 * 5,       // saturate
      h,                 // hueRotate
      1,                 // brightness
      1,                 // contrast
    ];
  }

  /**
   * 主求解入口
   * 多次随机初始化 + SPSA 优化，取最优结果
   */
  solve(): SolverResult {
    let bestResult: { params: number[]; loss: number } | null = null;

    // 第一次：使用 HSL 估算的初始值（更快收敛）
    const initialParams = this.getInitialParams();
    const firstResult = this.spsa(
      15,
      [0.25, 0.25, 1.25, 1.25, 0.25, 0.25],
      0.1,
      initialParams,
      500
    );
    bestResult = firstResult;

    // 多次随机初始化，避免陷入局部最优
    for (let i = 0; i < 5; i++) {
      const randomParams = [
        Math.random(),
        Math.random(),
        Math.random() * 10,
        Math.random() * 360,
        Math.random() * 2,
        Math.random() * 2,
      ];

      const result = this.spsa(
        15,
        [0.25, 0.25, 1.25, 1.25, 0.25, 0.25],
        0.1,
        randomParams,
        500
      );

      if (result.loss < bestResult.loss) {
        bestResult = result;
      }

      // 误差足够小，提前退出
      if (bestResult.loss < 1) break;
    }

    return this.buildResult(bestResult!.params, bestResult!.loss);
  }

  /**
   * 将参数数组转为 CSS filter 字符串
   */
  private buildResult(params: number[], loss: number): SolverResult {
    const [invert, sepia, saturate, hueRotate, brightness, contrast] = params;

    const fmt = (v: number, decimals = 0) =>
      parseFloat(v.toFixed(decimals));

    const filter = [
      'brightness(0)',
      'saturate(100%)',
      `invert(${fmt(invert * 100)}%)`,
      `sepia(${fmt(sepia * 100)}%)`,
      `saturate(${fmt(saturate * 100)}%)`,
      `hue-rotate(${fmt(hueRotate, 1)}deg)`,
      `brightness(${fmt(brightness * 100)}%)`,
      `contrast(${fmt(contrast * 100)}%)`,
    ].join(' ');

    return { filter, loss };
  }
}

// ==================== 工具函数 ====================

function hexToRgb(hex: string): RGB | null {
  // 支持 3 位简写
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const normalized = hex.replace(shorthand, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);

  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function isValidHex(hex: string): boolean {
  return /^#?([a-f\d]{3}|[a-f\d]{6})$/i.test(hex.trim());
}

/**
 * 缓存 filter 计算结果，避免重复计算
 * （仅 fallback 路径使用；mask 路径无开销，无需缓存）
 */
const filterCache = new Map<string, string>();

function hexToFilter(hex: string): string {
  const key = hex.toLowerCase().trim();

  if (filterCache.has(key)) {
    return filterCache.get(key)!;
  }

  // 特殊颜色直接返回
  if (key === '#000' || key === '#000000') {
    filterCache.set(key, 'brightness(0)');
    return 'brightness(0)';
  }
  if (key === '#fff' || key === '#ffffff') {
    filterCache.set(key, 'brightness(0) invert(1)');
    return 'brightness(0) invert(1)';
  }

  const rgb = hexToRgb(hex);
  if (!rgb) return 'none';

  const target = new Color(rgb.r, rgb.g, rgb.b);
  const solver = new Solver(target);
  const result = solver.solve();

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(
      `[HexColorIcon][filter-fallback] ${hex} → loss: ${result.loss.toFixed(2)} (${
        result.loss < 5 ? '✅ 精确' : result.loss < 15 ? '⚠️ 一般' : '❌ 偏差较大'
      })`
    );
  }

  filterCache.set(key, result.filter);
  return result.filter;
}

// ==================== 组件 ====================
//
// 渲染策略（按优先级）：
//   1) **方案 1（首选）**：CSS `mask-image` + `background-color`
//      - 用主题色作为背景，用图片本身作为遮罩
//      - 染色 100% 精准，无任何色差，性能最佳（GPU 合成）
//      - 现代浏览器（含 iOS Safari 14+/微信内核）原生支持
//      - DOM 输出：<span role="img">
//
//   2) **方案 2（fallback）**：SPSA 求解 CSS `filter` 链
//      - 通过 invert/sepia/saturate/hue-rotate/brightness/contrast 6 段链路逼近目标色
//      - 仅当浏览器不支持 mask-image 时启用
//      - DOM 输出：<img>
//
// 不传 color 时：直接渲染 <img>，保持原图原色（用于 inactive 态等场景）。
//

const HexColorIcon: React.FC<HexColorIconProps> = ({
  src,
  color,
  size,
  className,
  style,
  alt = 'icon',
  ...restProps
}) => {
  // 尺寸样式（共享给两种渲染分支）
  const sizeStyle: CSSProperties = useMemo(() => {
    if (size === undefined) return {};
    const v = typeof size === 'number' ? `${size}px` : size;
    return { width: v, height: v };
  }, [size]);

  // 校验 color：无效或未传 → 走原图渲染
  const validColor = useMemo(() => {
    if (!color) return undefined;
    if (!isValidHex(color)) {
      // eslint-disable-next-line no-console
      console.warn(`[HexColorIcon] 无效的 hex 颜色: "${color}"`);
      return undefined;
    }
    return color.startsWith('#') ? color : `#${color}`;
  }, [color]);

  // ---------- 分支 1：未指定颜色 → 原图原色 ----------
  if (!validColor) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...sizeStyle, ...style }}
        {...(restProps as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  }

  // ---------- 分支 2：mask-image 渲染（首选，100% 精准） ----------
  if (supportsMaskImage) {
    const maskUrl = `url("${src}")`;
    const maskStyle: CSSProperties = {
      display: 'inline-block',
      backgroundColor: validColor,
      // 同时设置 mask 与 -webkit-mask 以兼容旧 WebKit
      WebkitMaskImage: maskUrl,
      maskImage: maskUrl,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      ...sizeStyle,
      ...style,
    };
    return (
      <span
        role="img"
        aria-label={alt}
        className={className}
        style={maskStyle}
        {...restProps}
      />
    );
  }

  // ---------- 分支 3：filter fallback（SPSA 求解） ----------
  const filter = hexToFilter(validColor);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ ...sizeStyle, ...(filter ? { filter } : {}), ...style }}
      {...(restProps as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
};

export default HexColorIcon;
export { hexToFilter, hexToRgb, isValidHex, filterCache, supportsMaskImage };
export type { RGB, FilterParams, SolverResult };