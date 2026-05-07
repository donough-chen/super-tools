// 全局应用入口
// 初始化主题（在 JS 执行时立即应用，避免闪烁）
const savedTheme =
  localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

// 初始化主题色（在 JS 执行时立即应用，避免闪烁）
const savedAccent = localStorage.getItem('accentColor') || 'indigo';
document.documentElement.setAttribute('data-accent', savedAccent);
