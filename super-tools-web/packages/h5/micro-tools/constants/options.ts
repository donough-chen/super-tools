/**
 * 用户资料编辑常用选项常量
 * 由 profile 编辑、settings 偏好等页面共用
 */

export const GENDER_OPTIONS: Array<{ value: 0 | 1 | 2; label: string }> = [
  { value: 0, label: '保密' },
  { value: 1, label: '男' },
  { value: 2, label: '女' },
];

export const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
];

export const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Asia/Shanghai', label: '上海 (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: '香港 (GMT+8)' },
  { value: 'Asia/Taipei', label: '台北 (GMT+8)' },
  { value: 'Asia/Tokyo', label: '东京 (GMT+9)' },
  { value: 'Asia/Singapore', label: '新加坡 (GMT+8)' },
  { value: 'America/Los_Angeles', label: '洛杉矶 (GMT-8)' },
  { value: 'America/New_York', label: '纽约 (GMT-5)' },
  { value: 'Europe/London', label: '伦敦 (GMT+0)' },
  { value: 'Europe/Berlin', label: '柏林 (GMT+1)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

/** 根据 value 反查 label */
export const findOptionLabel = <T,>(
  options: Array<{ value: T; label: string }>,
  value: T | null | undefined,
  fallback = '-',
): string => {
  if (value === null || value === undefined) return fallback;
  return options.find(o => o.value === value)?.label || fallback;
};
