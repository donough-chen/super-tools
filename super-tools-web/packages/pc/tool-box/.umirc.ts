import { defineConfig } from 'umi';

export default defineConfig({
  // 标题
  title: 'Super Tools - 在线工具箱',
  // 开启 hash（文件名 hash，非路由 hash）
  hash: true,
  // 动态加载（路由级代码分割），指定 Loading 占位组件
  dynamicImport: {
    loading: '@/Loading',
  },
  // 全局 less 变量
  theme: {
    'primary-color': '#4f46e5',
    'border-radius-base': '8px',
  },
  // 路由配置
  routes: [
    // 登录页（独立于 BasicLayout，无 Header/Sidebar）
    { path: '/login', component: '@/pages/Login', exact: true },

    {
      exact: false,
      path: '/',
      component: '@/layouts/BasicLayout',
      routes: [
        { path: '/', component: '@/pages/Home', exact: true },

        // ==================== 视频工具 ====================
        { path: '/video-compress', component: '@/pages/tools' },
        { path: '/video-convert', component: '@/pages/tools' },
        { path: '/video-converter', component: '@/pages/tools' },
        { path: '/screen-record', component: '@/pages/tools' },
        { path: '/video-extract-audio', component: '@/pages/tools' },
        { path: '/video-speed', component: '@/pages/tools' },
        { path: '/video-merge', component: '@/pages/tools' },
        { path: '/video-cut', component: '@/pages/tools' },
        { path: '/video-volume', component: '@/pages/tools' },
        { path: '/video-to-gif', component: '@/pages/tools' },

        // ==================== 音频工具 ====================
        { path: '/audio-convert', component: '@/pages/tools' },
        { path: '/audio-cut', component: '@/pages/tools' },
        { path: '/audio-compress', component: '@/pages/tools' },
        { path: '/audio-volume', component: '@/pages/tools' },
        { path: '/audio-speed', component: '@/pages/tools' },
        { path: '/audio-merge', component: '@/pages/tools' },

        // ==================== 图片工具 ====================
        { path: '/image-compress', component: '@/pages/tools' },
        { path: '/image-round', component: '@/pages/tools' },
        { path: '/image-batch-resize', component: '@/pages/tools' },
        { path: '/icon-maker', component: '@/pages/tools' },
        { path: '/image-pixelate', component: '@/pages/tools' },
        { path: '/image-crop', component: '@/pages/tools' },
        { path: '/base64-to-image', component: '@/pages/tools' },
        { path: '/image-to-base64', component: '@/pages/tools' },
        { path: '/color-preview', component: '@/pages/tools' },
        { path: '/image-split', component: '@/pages/tools' },
        { path: '/image-resize', component: '@/pages/tools' },
        { path: '/image-convert', component: '@/pages/tools' },
        { path: '/image-color-picker', component: '@/pages/tools' },
        { path: '/remove-background', component: '@/pages/tools' },
        { path: '/image-merge', component: '@/pages/tools' },
        { path: '/image-to-link', component: '@/pages/tools' },
        { path: '/image-sharpening', component: '@/pages/tools' },
        { path: '/face-enhancement', component: '@/pages/tools' },
        { path: '/image-moire-removal', component: '@/pages/tools' },
        { path: '/solid-color-generator', component: '@/pages/tools' },
        { path: '/image-grayscale', component: '@/pages/tools' },
        { path: '/image-matting', component: '@/pages/tools' },
        { path: '/image-invert', component: '@/pages/tools' },
        { path: '/image-watermark', component: '@/pages/tools' },
        { path: '/image-background', component: '@/pages/tools' },
        { path: '/image-to-gif', component: '@/pages/tools' },
        { path: '/gif-split', component: '@/pages/tools' },
        { path: '/gif-edit', component: '@/pages/tools' },
        { path: '/svg-preview', component: '@/pages/tools' },

        // ==================== PDF工具 ====================
        { path: '/pdf-merge', component: '@/pages/tools' },
        { path: '/image-to-pdf', component: '@/pages/tools' },
        { path: '/pdf-to-image', component: '@/pages/tools' },
        { path: '/pdf-to-doc', component: '@/pages/tools' },
        { path: '/pdf-encrypt', component: '@/pages/tools' },
        { path: '/pdf-decrypt', component: '@/pages/tools' },
        { path: '/pdf-compress', component: '@/pages/tools' },
        { path: '/doc-to-pdf', component: '@/pages/tools' },
        { path: '/doc-to-image', component: '@/pages/tools' },

        // ==================== 文本工具 ====================
        { path: '/markdown-editor', component: '@/pages/tools' },
        { path: '/markdown-to-file', component: '@/pages/tools' },
        { path: '/word-to-markdown', component: '@/pages/tools' },
        { path: '/text-diff', component: '@/pages/tools' },
        { path: '/text-replace', component: '@/pages/tools' },
        { path: '/text-count', component: '@/pages/tools' },
        { path: '/text-url-extractor', component: '@/pages/tools' },
        { path: '/magic-text', component: '@/pages/tools' },
        { path: '/text-recognition', component: '@/pages/tools' },
        { path: '/speech-to-text', component: '@/pages/tools' },
        { path: '/text-to-speech', component: '@/pages/tools' },
        { path: '/table-ocr', component: '@/pages/tools' },
        { path: '/document-enhancement', component: '@/pages/tools' },
        { path: '/document-correction', component: '@/pages/tools' },
        { path: '/url-filename-extractor', component: '@/pages/tools' },
        { path: '/telegraph-translator', component: '@/pages/tools' },

        // ==================== 文字应用 ====================
        { path: '/english-text-converter', component: '@/pages/tools' },
        { path: '/text-line-remover', component: '@/pages/tools' },
        { path: '/punctuation-converter', component: '@/pages/tools' },
        { path: '/case-converter', component: '@/pages/tools' },
        { path: '/text-deduplicator', component: '@/pages/tools' },
        { path: '/keyword-filter', component: '@/pages/tools' },
        { path: '/link-extractor', component: '@/pages/tools' },
        { path: '/link-list-converter', component: '@/pages/tools' },
        { path: '/number-extractor', component: '@/pages/tools' },
        { path: '/text-to-list', component: '@/pages/tools' },
        { path: '/ip-extractor', component: '@/pages/tools' },
        { path: '/text-prefix-suffix', component: '@/pages/tools' },
        { path: '/regex-tester', component: '@/pages/tools' },
        { path: '/word-frequency', component: '@/pages/tools' },
        { path: '/datetime-formatter', component: '@/pages/tools' },

        // ==================== 编程工具 ====================
        { path: '/json-parser', component: '@/pages/tools' },
        { path: '/base64-converter', component: '@/pages/tools' },
        { path: '/url-encoder', component: '@/pages/tools' },
        { path: '/url-encode', component: '@/pages/tools' },
        { path: '/md5-digest', component: '@/pages/tools' },
        { path: '/unicode-converter', component: '@/pages/tools' },
        { path: '/rc4-converter', component: '@/pages/tools' },
        { path: '/mac-generator', component: '@/pages/tools' },
        { path: '/user-agent-tool', component: '@/pages/tools' },
        { path: '/js-obfuscator', component: '@/pages/tools' },
        { path: '/binary-converter', component: '@/pages/tools' },
        { path: '/html-preview', component: '@/pages/tools' },

        // ==================== 编程应用 ====================
        { path: '/xml-formatter', component: '@/pages/tools' },
        { path: '/sql-formatter', component: '@/pages/tools' },
        { path: '/file-base64-converter', component: '@/pages/tools' },
        { path: '/directory-tree-converter', component: '@/pages/tools' },
        { path: '/user-agent-generator', component: '@/pages/tools' },
        { path: '/meta-tag-generator', component: '@/pages/tools' },
        { path: '/css-to-js', component: '@/pages/tools' },
        { path: '/html-tag-remover', component: '@/pages/tools' },
        { path: '/html-all-tags-remover', component: '@/pages/tools' },
        { path: '/scss-to-css', component: '@/pages/tools' },
        { path: '/browser-fingerprint', component: '@/pages/tools' },
        { path: '/json-extractor', component: '@/pages/tools' },
        { path: '/cookie-to-json', component: '@/pages/tools' },
        { path: '/base-converter', component: '@/pages/tools' },
        { path: '/crontab-calculator', component: '@/pages/tools' },
        { path: '/json-merger', component: '@/pages/tools' },
        { path: '/regex-collection', component: '@/pages/tools' },
        { path: '/json-to-excel', component: '@/pages/tools' },
        { path: '/ueditor', component: '@/pages/tools' },
        { path: '/uuid-generator', component: '@/pages/tools' },
        { path: '/excel-to-json', component: '@/pages/tools' },

        // ==================== 加密应用 ====================
        { path: '/rsa-key-generator', component: '@/pages/tools' },
        { path: '/sha-encryption', component: '@/pages/tools' },
        { path: '/aes-encryption', component: '@/pages/tools' },

        // ==================== 二维码工具 ====================
        { path: '/qr-code-generator', component: '@/pages/tools' },
        { path: '/qr-code-scanner', component: '@/pages/tools' },
        { path: '/barcode-generator', component: '@/pages/tools' },
        { path: '/qr-code-repair', component: '@/pages/tools' },

        // ==================== 单位转换 ====================
        { path: '/currency-converter', component: '@/pages/tools' },
        { path: '/time-converter', component: '@/pages/tools' },
        { path: '/area-converter', component: '@/pages/tools' },
        { path: '/volume-converter', component: '@/pages/tools' },
        { path: '/temperature-converter', component: '@/pages/tools' },
        { path: '/speed-converter', component: '@/pages/tools' },
        { path: '/energy-converter', component: '@/pages/tools' },

        // ==================== 实用工具 ====================
        { path: '/password-generator', component: '@/pages/tools' },
        { path: '/random-number', component: '@/pages/tools' },
        { path: '/color-palette', component: '@/pages/tools' },
        { path: '/drawing-board', component: '@/pages/tools' },
        { path: '/calendar', component: '@/pages/tools' },
        { path: '/world-time', component: '@/pages/tools' },
        { path: '/lottery', component: '@/pages/tools' },
        { path: '/random-lottery', component: '@/pages/tools' },
        { path: '/competition-grouping', component: '@/pages/tools' },
        { path: '/relationship-calculator', component: '@/pages/tools' },
        { path: '/remove-watermark', component: '@/pages/tools' },
        { path: '/resource-sniffer', component: '@/pages/tools' },

        // ==================== 生活应用 ====================
        { path: '/id-card-validator', component: '@/pages/tools' },
        { path: '/pregnancy-calculator', component: '@/pages/tools' },
        { path: '/bmi-calculator', component: '@/pages/tools' },
        { path: '/menstrual-calculator', component: '@/pages/tools' },

        // ==================== 其他应用 ====================
        { path: '/credit-card-apr-calculator', component: '@/pages/tools' },
        { path: '/dynasty-calculator', component: '@/pages/tools' },
        { path: '/chinese-calendar-calculator', component: '@/pages/tools' },

        // ==================== 查询工具 ====================
        { path: '/weather-forecast', component: '@/pages/tools' },
        { path: '/ip-location', component: '@/pages/tools' },
        { path: '/company-query', component: '@/pages/tools' },
        { path: '/postcode-query', component: '@/pages/tools' },
        { path: '/university-query', component: '@/pages/tools' },
        { path: '/phone-number', component: '@/pages/tools' },
        { path: '/emoji-list', component: '@/pages/tools' },
        { path: '/symbol-list', component: '@/pages/tools' },
        { path: '/phone-code-list', component: '@/pages/tools' },
        { path: '/license-plate-list', component: '@/pages/tools' },
        { path: '/ascii-table', component: '@/pages/tools' },
        { path: '/capital-list', component: '@/pages/tools' },
        { path: '/country-code-list', component: '@/pages/tools' },
        { path: '/location-query', component: '@/pages/tools' },
        { path: '/coordinate-query', component: '@/pages/tools' },
        { path: '/trademark-query', component: '@/pages/tools' },
        { path: '/oil-price', component: '@/pages/tools' },
        { path: '/gold-price', component: '@/pages/tools' },

        // ==================== 资讯工具 ====================
        { path: '/news-center', component: '@/pages/tools' },
        { path: '/hot-list', component: '@/pages/tools' },
        { path: '/morning-paper', component: '@/pages/tools' },
        { path: '/movie-box-office', component: '@/pages/tools' },
        { path: '/news-browser', component: '@/pages/tools' },

        // ==================== 系统工具 ====================
        { path: '/download-queue', component: '@/pages/tools' },
        { path: '/website-synthesis', component: '@/pages/tools' },

        // ==================== 设置页 ====================
        { path: '/settings', component: '@/pages/Settings' },

        // 404 兜底
        { component: '@/pages/404' },
      ],
    },
  ],
});
