/**
 * 图标资源解析工具
 *
 * 后端下发的 icon 路径格式为 "/assets/<子目录>/xxx.<ext>"，
 * 例如 "/assets/imgs/coin_two.svg"、"/assets/icons/home.png"。
 * 前端需要通过 webpack 模块系统加载 `src/assets/` 下的实际文件。
 *
 * 实现方式：使用 require.context 在编译时递归预加载 assets/ 下所有支持的图片，
 * 构建 { '<subdir>/<filename>': '编译后的URL', '<filename>': '编译后的URL' } 字典。
 * 运行时优先按「子目录/文件名」精确匹配，失败再回退到仅按「文件名」匹配。
 *
 * 支持的图片格式：svg / png / jpg / jpeg / gif / webp / bmp / ico / avif
 *
 * 优点：
 * - 不使用运行时动态 require（避免 webpack 警告 / 路径解析问题）
 * - 一次性构建映射表，查找 O(1)
 * - 新增图片到 assets/ 任意子目录下会自动纳入（无需修改代码）
 * - 不同子目录下的同名文件可通过「子目录/文件名」精确区分
 */

const SUPPORTED_EXT_REGEX = /\.(svg|png|jpe?g|gif|webp|bmp|ico|avif)$/i;

const iconContext = (require as any).context('@/assets', true, /\.(svg|png|jpe?g|gif|webp|bmp|ico|avif)$/i);

/** 精确映射：key = "<subdir>/<filename>"，如 "icons/home.png"、"imgs/coin_two.svg" */
const ICON_MAP: Record<string, string> = {};
/** 回退映射：key = "<filename>"，仅当文件名全局唯一时有效；冲突时置为 null */
const FILENAME_MAP: Record<string, string | null> = {};

iconContext.keys().forEach((key: string) => {
  // key 形如 "./imgs/coin_two.svg"、"./icons/home.png"
  const relPath = key.replace(/^\.\//, '');
  const url = iconContext(key);
  ICON_MAP[relPath] = url;

  const filename = relPath.split('/').pop() as string;
  if (filename in FILENAME_MAP) {
    // 同名文件在多个子目录出现，禁用回退匹配
    FILENAME_MAP[filename] = null;
  } else {
    FILENAME_MAP[filename] = url;
  }
});

/**
 * 将后端 icon 路径解析为实际可用的图片 URL
 *
 * @param iconPath 后端下发的 icon 路径，如 "/assets/imgs/coin_two.svg"、"/assets/icons/home.png"
 * @returns webpack 编译后的图片 URL；若路径为空或找不到对应文件则返回 undefined
 *
 * @example
 * resolveIcon('/assets/imgs/coin_two.svg')   // -> "/static/coin_two.xxxxxx.svg"
 * resolveIcon('/assets/icons/home.png')      // -> "/static/home.xxxxxx.png"
 * resolveIcon('/assets/icons/avatar.webp')   // -> "/static/avatar.xxxxxx.webp"
 * resolveIcon(undefined)                     // -> undefined
 * resolveIcon('/assets/imgs/not_exist.svg')  // -> undefined
 */
export function resolveIcon(iconPath?: string | null): string | undefined {
  if (!iconPath) return undefined;
  if (!SUPPORTED_EXT_REGEX.test(iconPath)) return undefined;

  // 1) 优先按「子目录/文件名」精确匹配：/assets/icons/home.png → "icons/home.png"
  const assetsIdx = iconPath.indexOf('/assets/');
  if (assetsIdx !== -1) {
    const relPath = iconPath.slice(assetsIdx + '/assets/'.length);
    const hit = ICON_MAP[relPath];
    if (hit) return hit;
  }

  // 2) 回退：仅按文件名匹配（当不同子目录同名时不会误命中）
  const filename = iconPath.split('/').pop();
  if (!filename) return undefined;
  const fallback = FILENAME_MAP[filename];
  return fallback || undefined;
}

/**
 * 获取全部已注册的图标映射表（调试用）
 * key 为相对 `assets/` 的路径，如 "icons/home.png"、"imgs/coin_two.svg"
 */
export function getIconMap(): Readonly<Record<string, string>> {
  return ICON_MAP;
}
