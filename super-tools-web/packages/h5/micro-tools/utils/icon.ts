/**
 * 图标资源解析工具
 *
 * 后端下发的 icon 路径格式为 "/assets/imgs/xxx.svg"，
 * 前端需要通过 webpack 模块系统加载 `src/assets/imgs/` 下的实际文件。
 *
 * 实现方式：使用 require.context 在编译时预加载 assets/imgs/ 下所有 SVG，
 * 构建 { 'filename.svg': '编译后的URL' } 字典。运行时通过文件名查找。
 *
 * 优点：
 * - 不使用运行时动态 require（避免 webpack 警告 / 路径解析问题）
 * - 一次性构建映射表，查找 O(1)
 * - 新增 SVG 到 assets/imgs/ 目录会自动纳入（无需修改代码）
 */

const iconContext = (require as any).context('@/assets/imgs', false, /\.svg$/);

const ICON_MAP: Record<string, string> = {};

iconContext.keys().forEach((key: string) => {
  // key 格式为 "./filename.svg"，去掉 "./" 前缀得到 "filename.svg"
  const filename = key.replace(/^\.\//, '');
  ICON_MAP[filename] = iconContext(key);
});

/**
 * 将后端 icon 路径解析为实际可用的图片 URL
 *
 * @param iconPath 后端下发的 icon 路径，如 "/assets/imgs/coin_two.svg"
 * @returns webpack 编译后的图片 URL；若路径为空或找不到对应文件则返回 undefined
 *
 * @example
 * resolveIcon('/assets/imgs/coin_two.svg')  // -> "/static/coin_two.xxxxxx.svg"
 * resolveIcon(undefined)                      // -> undefined
 * resolveIcon('/assets/imgs/not_exist.svg')   // -> undefined
 */
export function resolveIcon(iconPath?: string | null): string | undefined {
  if (!iconPath) return undefined;
  // 提取文件名：后端格式 "/assets/imgs/filename.svg" → "filename.svg"
  const filename = iconPath.split('/').pop();
  if (!filename) return undefined;
  return ICON_MAP[filename] || undefined;
}

/**
 * 获取全部已注册的图标映射表（调试用）
 */
export function getIconMap(): Readonly<Record<string, string>> {
  return ICON_MAP;
}
