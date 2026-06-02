/**
 * PostCSS 插件类型声明
 *
 * autoprefixer@9 和 postcss-pxtorem@5 均无内置 TypeScript 类型声明，
 * 在此统一声明，消除 config.ts 中的 TS2307 错误。
 */
declare module 'autoprefixer' {
  const autoprefixer: (options?: Record<string, any>) => any;
  export = autoprefixer;
}

declare module 'postcss-pxtorem' {
  const pxtorem: (options?: Record<string, any>) => any;
  export = pxtorem;
}
