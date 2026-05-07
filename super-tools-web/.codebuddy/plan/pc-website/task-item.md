# 实施计划

- [ ] 1. 初始化项目结构与基础配置
   - 在 `packages/pc/` 下初始化 UmiJS 3 + TypeScript 项目，配置 `package.json`、`.umirc.ts`、`tsconfig.json`
   - 在 `.umirc.ts` 中按 `demo.js` 的 router 对象声明全部 130+ 条工具页面路由，未开发页面路由添加注释标注"待开发"，开启 `dynamicImport` 代码分割
   - 创建 `src/` 目录结构：`pages/`、`components/`、`layouts/`、`models/`、`services/`、`mock/`、`styles/`
   - _需求：9.1、9.2、9.3_

- [ ] 2. 建立公共样式体系
   - 创建 `src/styles/variables.less`，定义主色调、字体、圆角、间距、阴影、毛玻璃等设计 Token CSS 变量
   - 创建 `src/styles/themes.less`，定义亮色主题（`:root`）和暗色主题（`[data-theme="dark"]`）两套变量覆盖规则
   - 创建 `src/styles/global.less`，引入变量文件并设置全局 reset 样式、BEM 公共类
   - _需求：8.1、8.2、6.1、6.4_

- [ ] 3. 实现主题切换功能与持久化
   - 创建 `src/models/theme.ts` DVA Model，管理 `theme` 状态（light/dark），初始化时读取 `localStorage` 或 `prefers-color-scheme`
   - 在 Model 的 effect 中实现切换逻辑：更新 `document.documentElement` 的 `data-theme` 属性并写入 `localStorage`
   - 在全局 Layout 中连接 theme Model，确保主题切换对所有页面生效
   - _需求：6.1、6.2、6.3、6.4、6.5_

- [ ] 4. 搭建整体页面布局（BasicLayout）
   - 创建 `src/layouts/BasicLayout/index.tsx`，实现 Header 固定顶部 + 分割线 + 主体双栏（Sidebar + Main）+ 分割线 + Footer 的整体骨架
   - 使用 CSS Flexbox/Grid 实现 PC 端双栏布局，Header `position: sticky; top: 0`，整体支持垂直滚动
   - 创建 `src/layouts/BasicLayout/index.less`，遵循 BEM 命名规范编写布局样式
   - _需求：1.1、1.2、1.3、1.4_

- [ ] 5. 开发 Header 组件
   - 创建 `src/components/Header/` 组件，实现三列结构：左侧 Logo + 网站名称、中间（上栏：天气 + 搜索框；下栏：窗口标签列表）、右侧（设置按钮 + 登录按钮）
   - 实现搜索框下拉弹窗（Ant Design AutoComplete + 自定义 dropdown），支持关键词过滤工具列表、结果滚动、点击跳转；搜索框 placeholder 显示工具总数
   - 实现窗口标签栏：横向滚动容器，每个标签带关闭按钮，超过 10 个时显示警告提示；Tab 切换实现动画跟随效果（active 指示器平滑位移）
   - 实现登录弹窗（Ant Design Modal），PC 端点击登录按钮弹出，包含账号密码表单
   - 悬浮层（下拉弹窗、Modal）应用毛玻璃效果（`backdrop-filter: blur`）
   - _需求：2.1～2.10、8.3、8.6_

- [ ] 6. 开发 Sidebar 侧边栏组件
   - 创建 `src/components/Sidebar/` 组件，从 Mock 数据读取分类列表，渲染带 iconfont 图标和分类名称的列表项
   - 实现 active 高亮状态：默认高亮第一项，点击切换高亮并触发 Main 区域平滑滚动到对应锚点；active 指示器实现动画跟随效果
   - 实现滚动监听联动：监听 Main 区域滚动事件，自动更新 Sidebar active 状态；Sidebar 内部超出高度时独立滚动
   - _需求：3.1～3.5、8.5_

- [ ] 7. 开发 Main 内容区与工具卡片
   - 创建 `src/pages/Home/index.tsx`，按分类分组渲染工具卡片，每个分类设置锚点 `id`，顶部显示"下载队列"和"添加功能"快捷入口
   - 创建 `src/components/ToolCard/` 组件，展示工具图标（iconfont）、工具名称、简短描述；鼠标悬浮时显示上浮阴影动效（`transform: translateY + box-shadow` 过渡）
   - 实现响应式网格布局：PC 端 4-5 列（`grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`），平板 3 列，移动端 2 列
   - 点击工具卡片时在 Header 标签栏新增对应标签，并跳转工具路由
   - _需求：4.1～4.5、8.4、8.7_

- [ ] 8. 开发 Footer 组件与 Mock 数据层
   - 创建 `src/components/Footer/` 组件，居中显示版权信息、ICP 备案号（外链）、客户端下载入口
   - 创建 `mock/index.ts`，提供天气信息接口（`GET /api/weather`）、工具列表接口（`GET /api/tools`）、用户登录接口（`POST /api/login`）的 Mock 数据，数据结构与真实接口对齐
   - 创建 `src/services/api.ts`，封装 `request` 工具函数，统一配置 baseURL，接口错误时展示 Ant Design Message 提示
   - _需求：5.1～5.3、10.1～10.4_

- [ ] 9. 实现移动端适配
   - 在 Header 组件中添加响应式逻辑：移动端（`<768px`）隐藏 Logo 文字、天气模块，将搜索框替换为搜索图标按钮，登录按钮点击跳转登录页
   - 将 PC 端 Logo 区域替换为汉堡菜单图标，点击触发 Ant Design Drawer 从左侧滑出 Sidebar 内容，点击遮罩层关闭
   - 在 BasicLayout 中通过媒体查询隐藏固定 Sidebar，Main 内容区在移动端占满全宽，工具卡片切换为 2 列布局
   - _需求：7.1～7.7_

- [ ] 10. 完善 404 页面与整体联调
   - 创建 `src/pages/404/index.tsx`，展示友好的 404 提示页面，提供"返回首页"按钮
   - 在 `.umirc.ts` 中配置 `routes` 末尾添加 `{ path: '/*', component: '@/pages/404' }` 兜底路由
   - 全流程联调：验证主题切换持久化、搜索下拉弹窗、窗口标签管理（超 10 个警告）、Sidebar 滚动联动、移动端抽屉、Mock 接口数据渲染等核心功能
   - _需求：9.4、1.1～1.4、2.4～2.7、3.3～3.4、6.2～6.3、10.3_
