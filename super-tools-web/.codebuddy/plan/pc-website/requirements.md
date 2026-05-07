# PC端工具网站项目需求文档

## 引言

本项目为 `super-tools-web` Monorepo 中的 PC 端官网子项目，位于 `packages/pc/` 目录下。基于 React 16 + UmiJS 3 + DVA + TypeScript 技术栈，使用 Ant Design 作为 UI 组件库，iconfont.cn 提供图标资源。

项目目标是构建一个功能完善、视觉美观的在线工具聚合网站，参考图片中的设计风格（奇妙工具箱），提供工具分类导航、搜索、主题切换等核心功能，并充分适配 PC 端和移动端两种使用场景。

工具列表数据参考 `demo.js` 文件，包含视频工具、音频工具、图片工具、PDF工具、文本工具、编程工具、加密工具、查询工具等多个分类，共 100+ 个工具页面。

---

## 需求

### 需求 1：整体页面布局结构

**用户故事：** 作为一名访问者，我希望看到清晰的页面布局结构（Header + Sidebar + Main + Footer），以便快速定位和使用各类工具。

#### 验收标准

1. WHEN 用户访问网站 THEN 系统 SHALL 展示包含 Header、分割线、主体内容区（Sidebar + Main）、分割线、Footer 的完整页面布局
2. WHEN 页面渲染完成 THEN 系统 SHALL 保证各区域在 PC 端（≥1024px）正确分区显示，不出现布局错乱
3. IF 用户在 PC 端访问 THEN 系统 SHALL 显示左侧 Sidebar 侧边栏和右侧 Main 内容区的双栏布局
4. WHEN 页面内容超出视口高度 THEN 系统 SHALL 支持整体页面垂直滚动，Header 固定在顶部

---

### 需求 2：Header 区域

**用户故事：** 作为一名用户，我希望 Header 区域提供 Logo、天气、搜索、窗口标签管理、设置和登录入口，以便快速访问常用功能。

#### 验收标准

1. WHEN 页面加载 THEN 系统 SHALL 在 Header 左侧显示网站 Logo 图标和网站名称文字
2. WHEN 页面加载 THEN 系统 SHALL 在 Header 中间上栏左侧显示天气信息（城市名 + 温度范围 + 天气状况），数据通过 Mock 接口获取
3. WHEN 页面加载 THEN 系统 SHALL 在 Header 中间上栏右侧显示搜索框，搜索框内显示工具总数提示文字（如"搜索171项功能"）
4. WHEN 用户在搜索框输入关键词 THEN 系统 SHALL 以下拉弹窗形式展示匹配的工具列表，支持滚动浏览，点击结果跳转对应工具页
5. WHEN 用户打开多个工具窗口 THEN 系统 SHALL 在 Header 中间下栏以横向滚动标签列表展示已打开的窗口标题，每个标签带关闭按钮
6. WHEN 已打开窗口数量超过 10 个 THEN 系统 SHALL 在标签列表区域显示警告提示"窗口缓存过多影响加载，请关闭闲置窗口"
7. WHEN 用户点击窗口标签的关闭按钮 THEN 系统 SHALL 移除对应标签并更新标签列表
8. WHEN 页面加载 THEN 系统 SHALL 在 Header 右侧显示设置按钮和登录按钮
9. WHEN 用户点击设置按钮 THEN 系统 SHALL 跳转至设置页面
10. WHEN 用户点击登录按钮 THEN 系统 SHALL 打开登录弹窗（Modal 形式）

---

### 需求 3：Sidebar 侧边栏

**用户故事：** 作为一名用户，我希望通过左侧侧边栏快速切换工具分类，以便高效找到目标工具。

#### 验收标准

1. WHEN 页面加载 THEN 系统 SHALL 在左侧 Sidebar 显示所有工具分类列表，每项包含分类图标（iconfont）和分类名称
2. WHEN 页面加载完成 THEN 系统 SHALL 默认高亮第一个分类项（首页/全部）
3. WHEN 用户点击某个分类项 THEN 系统 SHALL 将该项切换为 active 高亮状态，并平滑滚动右侧 Main 内容区到对应锚点位置
4. WHEN 用户在 Main 区域滚动 THEN 系统 SHALL 自动更新 Sidebar 中对应分类项的 active 状态（滚动监听联动）
5. WHEN 分类列表超出 Sidebar 高度 THEN 系统 SHALL 支持 Sidebar 内部垂直滚动，不影响整体页面布局
6. IF 用户在移动端访问 THEN 系统 SHALL 隐藏 Sidebar，改为顶部菜单图标触发抽屉式弹出

---

### 需求 4：Main 内容区

**用户故事：** 作为一名用户，我希望在 Main 区域看到按分类组织的工具卡片列表，以便浏览和选择工具。

#### 验收标准

1. WHEN 页面加载 THEN 系统 SHALL 在 Main 区域按分类分组展示工具卡片，每个分类有锚点标题
2. WHEN 工具卡片渲染 THEN 系统 SHALL 每张卡片显示工具图标、工具名称和简短描述
3. WHEN 用户点击工具卡片 THEN 系统 SHALL 在新标签页或内嵌窗口中打开对应工具页面，并在 Header 标签栏新增标签
4. WHEN Main 区域渲染 THEN 系统 SHALL 采用响应式网格布局，PC 端每行显示 4-5 个卡片，平板端 3 个，移动端 2 个
5. WHEN 页面加载 THEN 系统 SHALL 在首页分类顶部显示"下载队列"和"添加功能"两个快捷入口卡片
6. IF 用户已登录 THEN 系统 SHALL 支持用户自定义首页常用工具的展示顺序

---

### 需求 5：Footer 区域

**用户故事：** 作为一名访问者，我希望在页面底部看到版权信息和相关链接，以便了解网站基本信息。

#### 验收标准

1. WHEN 页面加载 THEN 系统 SHALL 在 Footer 居中显示版权信息（Copyright © 年份 + 公司名称）
2. WHEN 页面加载 THEN 系统 SHALL 在 Footer 显示 ICP 备案号链接和客户端下载入口
3. WHEN 用户点击 ICP 备案号 THEN 系统 SHALL 在新标签页打开工信部备案查询页面

---

### 需求 6：主题切换功能

**用户故事：** 作为一名用户，我希望能够切换网站的亮色/暗色主题，以便在不同光线环境下获得舒适的阅读体验。

#### 验收标准

1. WHEN 用户点击主题切换按钮 THEN 系统 SHALL 在亮色主题和暗色主题之间切换，切换效果平滑过渡
2. WHEN 用户切换主题 THEN 系统 SHALL 将主题偏好写入 localStorage 持久化存储
3. WHEN 用户再次访问网站 THEN 系统 SHALL 读取 localStorage 中的主题设置并自动应用
4. WHEN 主题切换 THEN 系统 SHALL 同时更新 PC 端和移动端所有页面区域的主题样式
5. IF 用户未设置主题偏好 THEN 系统 SHALL 默认跟随系统主题（prefers-color-scheme）

---

### 需求 7：移动端适配

**用户故事：** 作为一名移动端用户，我希望在手机上也能流畅使用工具网站，以便随时随地访问工具。

#### 验收标准

1. WHEN 用户在移动端（<768px）访问 THEN 系统 SHALL 将 Header 左侧 Logo 替换为菜单图标（汉堡菜单）
2. WHEN 移动端用户点击菜单图标 THEN 系统 SHALL 从左侧滑出抽屉式 Sidebar 弹窗，点击遮罩层关闭
3. WHEN 用户在移动端访问 THEN 系统 SHALL 隐藏 Header 中的天气模块
4. WHEN 用户在移动端访问 THEN 系统 SHALL 将搜索框替换为搜索图标，点击图标跳转搜索页
5. WHEN 移动端用户点击登录按钮 THEN 系统 SHALL 跳转至独立登录页面（而非弹窗）
6. WHEN 用户在移动端访问 THEN 系统 SHALL 隐藏左侧 Sidebar 固定栏，Main 内容区占满全宽
7. WHEN 移动端 Main 区域渲染 THEN 系统 SHALL 工具卡片以 2 列网格布局展示，保持居中对齐

---

### 需求 8：样式规范与视觉设计

**用户故事：** 作为一名用户，我希望网站具有统一美观的视觉风格，以便获得良好的使用体验。

#### 验收标准

1. WHEN 项目初始化 THEN 系统 SHALL 创建公共样式变量文件（CSS Variables / Less Variables），统一管理主色调、字体、圆角、间距、阴影等设计 Token
2. WHEN 编写 CSS 类名 THEN 系统 SHALL 遵循 BEM 命名规范（Block__Element--Modifier），按模块语义化命名
3. WHEN 渲染悬浮层、下拉弹窗、抽屉等覆盖元素 THEN 系统 SHALL 应用毛玻璃效果（backdrop-filter: blur）
4. WHEN 渲染卡片、按钮、输入框等 UI 元素 THEN 系统 SHALL 统一使用圆角处理（border-radius）
5. WHEN 用户切换 Sidebar 分类标签 THEN 系统 SHALL 展示动画跟随效果（active 指示器平滑移动）
6. WHEN Header 窗口标签切换 THEN 系统 SHALL 展示 Tab 切换动画跟随效果
7. WHEN 渲染工具卡片 THEN 系统 SHALL 鼠标悬浮时显示上浮阴影动效

---

### 需求 9：路由与页面结构

**用户故事：** 作为一名开发者，我希望项目具有清晰的路由结构和页面组织，以便后续逐步开发各工具页面。

#### 验收标准

1. WHEN 项目初始化 THEN 系统 SHALL 按照 UmiJS 3 配置式路由规范，在 `.umirc.ts` 中声明所有工具页面路由（参考 demo.js 中的路由列表）
2. WHEN 工具页面路由声明 THEN 系统 SHALL 对尚未开发的页面路由添加注释，标注"待开发"状态
3. WHEN 项目构建 THEN 系统 SHALL 支持路由级代码分割（dynamicImport），避免首屏加载过多资源
4. WHEN 访问不存在的路由 THEN 系统 SHALL 展示 404 页面并提供返回首页的入口

---

### 需求 10：Mock 数据与接口层

**用户故事：** 作为一名开发者，我希望前期使用 Mock 数据进行联调，后期能平滑切换到真实接口，以便独立开发不依赖后端进度。

#### 验收标准

1. WHEN 开发环境启动 THEN 系统 SHALL 使用 UmiJS Mock 功能提供天气信息、用户登录态、工具列表等接口的 Mock 数据
2. WHEN Mock 接口定义 THEN 系统 SHALL 与真实接口保持相同的数据结构，确保后期切换无需修改业务代码
3. WHEN 接口请求发生错误 THEN 系统 SHALL 展示友好的错误提示，不影响页面其他功能的正常使用
4. IF 接口切换为真实接口 THEN 系统 SHALL 仅需修改请求 baseURL 配置，无需改动页面组件代码
