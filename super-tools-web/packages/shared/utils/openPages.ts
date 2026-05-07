// 向 App 外部开放的页面路径白名单
// 这些页面不会被重定向到下载引导页
const openPageList: string[] = [
  '/fe/other/rules/allow',
  '/fe/other/rules/privacy',
  '/fe/other/rules/lead',
];

export default new Set(openPageList);
