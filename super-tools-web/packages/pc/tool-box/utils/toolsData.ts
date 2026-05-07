// 工具数据类型定义
export interface ToolItem {
  key: string;
  name: string;
  description: string;
  keywords: string;
  category: string;
  path: string;
}

export interface CategoryItem {
  name: string;
  icon: string;  // iconfont 图标类名
  tools: ToolItem[];
}

// 分类图标映射（iconfont 类名）
export const CATEGORY_ICONS: Record<string, string> = {
  '视频工具': 'icon-video',
  '音频工具': 'icon-audio',
  '图片工具': 'icon-image',
  '图片应用': 'icon-image-app',
  'PDF工具': 'icon-pdf',
  '文本工具': 'icon-text',
  '文字应用': 'icon-text-app',
  '编程工具': 'icon-code',
  '编程应用': 'icon-code-app',
  '加密应用': 'icon-lock',
  '二维码工具': 'icon-qrcode',
  '单位转换': 'icon-convert',
  '实用工具': 'icon-tools',
  '生活应用': 'icon-life',
  '其他应用': 'icon-other',
  '查询工具': 'icon-search',
  '资讯工具': 'icon-news',
  '系统工具': 'icon-system',
};

// 工具列表数据（从 demo.js 提取）
export const TOOLS_LIST: ToolItem[] = [
  { key: 'video-compress', name: '视频压缩', description: '免费在线视频压缩工具，智能压缩MP4、AVI、MOV等格式视频', keywords: '视频压缩,视频文件压缩,在线视频压缩,MP4压缩', category: '视频工具', path: '/video-compress' },
  { key: 'video-convert', name: '视频格式转换', description: '专业在线视频格式转换工具，支持30+种视频格式互相转换', keywords: '视频转换,视频格式转换,MP4转换', category: '视频工具', path: '/video-convert' },
  { key: 'screen-record', name: '屏幕录制', description: '免费在线屏幕录制工具，支持录制整个屏幕、指定窗口', keywords: '屏幕录制,录屏工具,在线录屏', category: '视频工具', path: '/screen-record' },
  { key: 'video-extract-audio', name: '视频提取音频', description: '从视频中提取音频轨道，支持多种格式', keywords: '视频提取音频,视频转音频,MP4转MP3', category: '视频工具', path: '/video-extract-audio' },
  { key: 'video-speed', name: '视频变速', description: '在线调整视频播放速度，支持0.5倍至4倍速度调节', keywords: '视频变速,视频加速,视频减速', category: '视频工具', path: '/video-speed' },
  { key: 'video-merge', name: '视频合并', description: '将多个视频文件无缝合并为一个完整视频', keywords: '视频合并,视频拼接', category: '视频工具', path: '/video-merge' },
  { key: 'video-cut', name: '视频剪切', description: '精确剪切视频片段，支持按时间点裁剪', keywords: '视频剪切,视频裁剪,视频分割', category: '视频工具', path: '/video-cut' },
  { key: 'video-volume', name: '视频音量调节', description: '调整视频文件音量大小，支持音量增大、减小', keywords: '视频音量调节,视频音量调整', category: '视频工具', path: '/video-volume' },
  { key: 'video-to-gif', name: '视频转GIF', description: '在线视频转GIF动图工具，支持MP4、AVI、MOV等格式', keywords: '视频转gif,视频转动图,MP4转gif', category: '视频工具', path: '/video-to-gif' },
  { key: 'audio-convert', name: '音频格式转换', description: '专业在线音频格式转换器，支持20+种音频格式互相转换', keywords: '音频转换,音频格式转换,MP3转换', category: '音频工具', path: '/audio-convert' },
  { key: 'audio-cut', name: '音频剪切', description: '精确剪切音频片段，制作铃声、音效', keywords: '音频剪切,音频裁剪,铃声制作', category: '音频工具', path: '/audio-cut' },
  { key: 'audio-compress', name: '音频压缩', description: '智能音频压缩工具，减小音频文件大小', keywords: '音频压缩,音频文件压缩,MP3压缩', category: '音频工具', path: '/audio-compress' },
  { key: 'audio-volume', name: '音频音量调节', description: '调整音频文件音量大小，支持音量增大、减小', keywords: '音频音量调节,音频音量调整', category: '音频工具', path: '/audio-volume' },
  { key: 'audio-speed', name: '音频变速', description: '在线调整音频播放速度，支持变速不变调', keywords: '音频变速,音频加速,音频减速', category: '音频工具', path: '/audio-speed' },
  { key: 'audio-merge', name: '音频合并', description: '将多个音频文件无缝合并为一个完整音频', keywords: '音频合并,音频拼接', category: '音频工具', path: '/audio-merge' },
  { key: 'image-compress', name: '图片压缩', description: '智能图片压缩工具，支持JPG、PNG、WebP等格式压缩', keywords: '图片压缩,图像压缩,JPG压缩,PNG压缩', category: '图片工具', path: '/image-compress' },
  { key: 'image-round', name: '图片圆角处理', description: '为图片添加圆角效果，支持自定义圆角半径', keywords: '图片圆角,圆形图片,头像制作', category: '图片工具', path: '/image-round' },
  { key: 'image-batch-resize', name: '多尺寸图片批量生成', description: '批量生成多种尺寸的图片', keywords: '图片批量处理,图片尺寸调整,批量缩放', category: '图片工具', path: '/image-batch-resize' },
  { key: 'icon-maker', name: '图标制作工具', description: '在线图标制作工具，支持多种尺寸和格式', keywords: '图标制作,ICO制作,PNG图标', category: '图片工具', path: '/icon-maker' },
  { key: 'image-pixelate', name: '图片像素化马赛克处理', description: '将图片转换为像素化马赛克效果', keywords: '图片像素化,马赛克效果,像素艺术', category: '图片工具', path: '/image-pixelate' },
  { key: 'image-crop', name: '图片裁剪工具', description: '在线图片裁剪工具，支持自由裁剪、正方形裁剪', keywords: '图片裁剪,图像裁剪,照片裁剪', category: '图片工具', path: '/image-crop' },
  { key: 'base64-to-image', name: 'Base64转图片工具', description: '在线Base64编码转图片工具', keywords: 'Base64转图片,Base64解码', category: '图片工具', path: '/base64-to-image' },
  { key: 'image-to-base64', name: '图片转Base64工具', description: '在线图片转Base64编码工具', keywords: '图片转Base64,Base64编码', category: '图片工具', path: '/image-to-base64' },
  { key: 'color-preview', name: '颜色预览工具', description: '在线颜色预览和格式转换工具', keywords: '颜色预览,颜色转换,HEX转RGB', category: '图片工具', path: '/color-preview' },
  { key: 'image-split', name: '图片水平/垂直均等切割', description: '在线图片切割工具，支持水平、垂直、网格等多种切割模式', keywords: '图片切割,图片分割', category: '图片应用', path: '/image-split' },
  { key: 'image-resize', name: '图片尺寸调整', description: '在线调整图片尺寸大小', keywords: '图片尺寸调整,图片缩放', category: '图片工具', path: '/image-resize' },
  { key: 'image-convert', name: '图片格式转换', description: '专业图片格式转换工具，支持JPG、PNG、WebP等格式互相转换', keywords: '图片格式转换,JPG转PNG', category: '图片工具', path: '/image-convert' },
  { key: 'image-color-picker', name: '图片取色器', description: '从图片中精确提取颜色值', keywords: '图片取色,颜色提取', category: '图片工具', path: '/image-color-picker' },
  { key: 'remove-background', name: 'AI智能去背景', description: '使用AI技术智能去除图片背景，一键抠图', keywords: 'AI去背景,智能抠图,去除背景', category: '图片工具', path: '/remove-background' },
  { key: 'image-merge', name: '图片拼接合并', description: '将多张图片拼接合并为一张图片', keywords: '图片拼接,图片合并', category: '图片工具', path: '/image-merge' },
  { key: 'image-to-link', name: '图片转链接', description: '将图片转换为可分享的链接', keywords: '图片转链接,图片外链', category: '图片工具', path: '/image-to-link' },
  { key: 'image-sharpening', name: '图片锐化增强', description: 'AI图片锐化工具，智能增强图片清晰度', keywords: '图片锐化,图像增强', category: '图片工具', path: '/image-sharpening' },
  { key: 'face-enhancement', name: 'AI人脸修复', description: 'AI人脸修复增强工具，智能修复老照片人脸', keywords: 'AI人脸修复,人像修复', category: '图片工具', path: '/face-enhancement' },
  { key: 'image-moire-removal', name: '图片摩尔纹去除', description: '智能去除图片中的摩尔纹干扰', keywords: '摩尔纹去除,图片去噪', category: '图片工具', path: '/image-moire-removal' },
  { key: 'solid-color-generator', name: '纯色图片生成器', description: '在线生成纯色背景图片', keywords: '纯色图片生成,背景图片', category: '图片工具', path: '/solid-color-generator' },
  { key: 'image-grayscale', name: '图像黑白化', description: '在线图像黑白化工具，将彩色图片转换为黑白效果', keywords: '图像黑白化,黑白照片', category: '图片应用', path: '/image-grayscale' },
  { key: 'image-matting', name: '单色图像抠图', description: '在线单色图像抠图工具', keywords: '单色抠图,图像抠图', category: '图片应用', path: '/image-matting' },
  { key: 'regex-collection', name: '正则表达式大全', description: '常用正则表达式大全，包含手机号、邮箱、身份证等', keywords: '正则表达式,正则大全,表单验证', category: '图片应用', path: '/regex-collection' },
  { key: 'image-invert', name: '图片反相', description: '在线图片反相工具，将图片颜色进行反转处理', keywords: '图片反相,图片反转', category: '图片工具', path: '/image-invert' },
  { key: 'image-watermark', name: '图片水印平铺', description: '为图片添加平铺水印效果', keywords: '图片水印,水印平铺', category: '图片工具', path: '/image-watermark' },
  { key: 'image-background', name: 'PNG图片背景色添加', description: '为PNG图片添加背景色', keywords: 'PNG背景色,图片背景', category: '图片工具', path: '/image-background' },
  { key: 'image-to-gif', name: '图片合成GIF', description: '将多张图片合成为GIF动图', keywords: '图片合成GIF,制作GIF', category: '图片工具', path: '/image-to-gif' },
  { key: 'gif-split', name: 'GIF图片帧拆分', description: '将GIF动图拆分为单独的图片帧', keywords: 'GIF拆分,GIF帧提取', category: '图片应用', path: '/gif-split' },
  { key: 'gif-edit', name: 'GIF图片帧修改工具', description: '在线修改GIF动图效果', keywords: 'GIF修改,GIF编辑', category: '图片应用', path: '/gif-edit' },
  { key: 'svg-preview', name: 'SVG预览器', description: '在线SVG文件预览工具', keywords: 'SVG预览,SVG编辑器', category: '图片工具', path: '/svg-preview' },
  { key: 'pdf-merge', name: 'PDF合并', description: '将多个PDF文件快速合并为一个完整文档', keywords: 'PDF合并,PDF拼接', category: 'PDF工具', path: '/pdf-merge' },
  { key: 'image-to-pdf', name: '图片转PDF', description: '将图片文件转换为PDF文档', keywords: '图片转PDF,JPG转PDF', category: 'PDF工具', path: '/image-to-pdf' },
  { key: 'pdf-to-image', name: 'PDF转图片', description: '将PDF文档转换为高清图片', keywords: 'PDF转图片,PDF转JPG', category: 'PDF工具', path: '/pdf-to-image' },
  { key: 'pdf-to-doc', name: 'PDF转Word', description: '将PDF文档智能转换为可编辑的Word文档', keywords: 'PDF转Word,PDF转DOC', category: 'PDF工具', path: '/pdf-to-doc' },
  { key: 'pdf-encrypt', name: 'PDF加密', description: '为PDF文档设置密码保护', keywords: 'PDF加密,设置密码', category: 'PDF工具', path: '/pdf-encrypt' },
  { key: 'pdf-decrypt', name: 'PDF解密', description: '解除PDF文档密码保护', keywords: 'PDF解密,移除密码', category: 'PDF工具', path: '/pdf-decrypt' },
  { key: 'pdf-compress', name: 'PDF压缩', description: '在线压缩PDF，支持画质档位与分辨率缩放', keywords: 'PDF压缩,压缩PDF', category: 'PDF工具', path: '/pdf-compress' },
  { key: 'doc-to-pdf', name: 'Word转PDF', description: '将Word文档转换为PDF格式', keywords: 'Word转PDF,DOC转PDF', category: 'PDF工具', path: '/doc-to-pdf' },
  { key: 'doc-to-image', name: 'Word转图片', description: '将Word文档转换为高清图片', keywords: 'Word转图片,DOC转图片', category: 'PDF工具', path: '/doc-to-image' },
  { key: 'markdown-editor', name: 'Markdown编辑器', description: '专业在线Markdown编辑器，支持实时预览', keywords: 'Markdown编辑器,在线编辑器', category: '文本工具', path: '/markdown-editor' },
  { key: 'markdown-to-file', name: 'Markdown转文件', description: '将Markdown文档转换为多种格式文件', keywords: 'Markdown转换,Markdown转HTML', category: '文本工具', path: '/markdown-to-file' },
  { key: 'word-to-markdown', name: 'Word转Markdown', description: '将Word文档转换为Markdown格式', keywords: 'Word转Markdown,DOC转Markdown', category: '文本工具', path: '/word-to-markdown' },
  { key: 'text-diff', name: '文本对比', description: '智能文本对比工具，高亮显示两个文本的差异', keywords: '文本对比,文本比较', category: '文本工具', path: '/text-diff' },
  { key: 'text-replace', name: '文本替换', description: '批量文本替换工具，支持正则表达式', keywords: '文本替换,批量替换', category: '文本工具', path: '/text-replace' },
  { key: 'text-count', name: '字数统计', description: '精确统计文本的字数、词数、字符数', keywords: '字数统计,文本统计', category: '文本工具', path: '/text-count' },
  { key: 'text-url-extractor', name: 'URL链接提取器', description: '从文本中智能提取URL链接', keywords: 'URL提取,链接提取', category: '文本工具', path: '/text-url-extractor' },
  { key: 'magic-text', name: '魔法文本', description: '智能文本处理工具，支持文本美化、格式转换', keywords: '文本处理,文本美化', category: '文本工具', path: '/magic-text' },
  { key: 'text-recognition', name: 'OCR文字识别', description: '智能OCR文字识别工具，从图片中精确提取文字', keywords: 'OCR识别,文字识别', category: '文本工具', path: '/text-recognition' },
  { key: 'speech-to-text', name: '语音转文字', description: '智能语音识别工具，将音频文件转换为文字', keywords: '语音识别,语音转文字', category: '文本工具', path: '/speech-to-text' },
  { key: 'text-to-speech', name: '文字转语音', description: '智能文字转语音工具，将文本转换为自然语音', keywords: '文字转语音,语音合成,TTS', category: '文本工具', path: '/text-to-speech' },
  { key: 'table-ocr', name: '表格识别', description: '智能表格OCR识别工具，从图片中精确识别表格内容', keywords: '表格识别,表格OCR', category: '文本工具', path: '/table-ocr' },
  { key: 'document-enhancement', name: '文档增强', description: 'AI文档图片增强工具，智能优化扫描文档', keywords: '文档增强,文档优化', category: '文本工具', path: '/document-enhancement' },
  { key: 'document-correction', name: '文档纠正', description: '智能文档倾斜纠正工具', keywords: '文档纠正,倾斜纠正', category: '文本工具', path: '/document-correction' },
  { key: 'url-filename-extractor', name: '链接文件名提取', description: '从URL链接中提取文件名和扩展名', keywords: 'URL文件名提取,链接文件名', category: '文本工具', path: '/url-filename-extractor' },
  { key: 'telegraph-translator', name: '电报码翻译', description: '摩尔斯电报码在线翻译工具', keywords: '电报码翻译,摩尔斯电码', category: '文本工具', path: '/telegraph-translator' },
  { key: 'english-text-converter', name: '英文文本转换', description: '英文文本全能转换器，支持大小写转换、驼峰命名', keywords: '英文转换,大小写转换', category: '文字应用', path: '/english-text-converter' },
  { key: 'text-line-remover', name: '文本去空换行', description: '文本空行和换行处理工具', keywords: '文本处理,去空行', category: '文字应用', path: '/text-line-remover' },
  { key: 'punctuation-converter', name: '中英文符号转换', description: '中英文标点符号互转工具', keywords: '符号转换,标点符号', category: '文字应用', path: '/punctuation-converter' },
  { key: 'case-converter', name: '驼峰/下划线命名转换', description: '编程命名格式转换工具', keywords: '驼峰命名,下划线命名', category: '文字应用', path: '/case-converter' },
  { key: 'text-deduplicator', name: '文本去重', description: '文本行去重工具', keywords: '文本去重,行去重', category: '文字应用', path: '/text-deduplicator' },
  { key: 'keyword-filter', name: '关键词筛选过滤', description: '根据关键词筛选过滤文本内容', keywords: '关键词筛选,文本过滤', category: '文字应用', path: '/keyword-filter' },
  { key: 'link-extractor', name: '链接批量提取', description: '从文本中批量提取各种类型的链接', keywords: '链接提取,URL提取', category: '文字应用', path: '/link-extractor' },
  { key: 'link-list-converter', name: '链接列表转超链接工具', description: '将链接列表批量转换为HTML、Markdown等格式的超链接', keywords: '链接转换,超链接生成', category: '编程工具', path: '/link-list-converter' },
  { key: 'number-extractor', name: '数字号码提取', description: '从文本中批量提取各种数字号码', keywords: '号码提取,手机号提取', category: '文字应用', path: '/number-extractor' },
  { key: 'text-to-list', name: '文本转列表', description: '将文本按指定分隔符转换为列表格式', keywords: '文本转列表,分隔符转换', category: '文字应用', path: '/text-to-list' },
  { key: 'ip-extractor', name: 'IP地址批量提取', description: '从文本中批量提取IP地址', keywords: 'IP地址提取,IPv4提取', category: '文字应用', path: '/ip-extractor' },
  { key: 'text-prefix-suffix', name: '文本行前缀/后缀添加', description: '为文本的每一行添加自定义前缀和后缀', keywords: '文本前缀,文本后缀', category: '文字应用', path: '/text-prefix-suffix' },
  { key: 'regex-tester', name: '正则表达式测试', description: '在线正则表达式测试工具', keywords: '正则表达式,正则测试', category: '文字应用', path: '/regex-tester' },
  { key: 'word-frequency', name: '词频统计', description: '统计文本中单词和字符的出现频率', keywords: '词频统计,单词统计', category: '文字应用', path: '/word-frequency' },
  { key: 'datetime-formatter', name: '时间日期格式化', description: '时间日期格式转换工具', keywords: '时间格式化,日期转换', category: '文字应用', path: '/datetime-formatter' },
  { key: 'json-parser', name: 'JSON格式化', description: '专业JSON格式化工具，支持JSON美化、压缩、验证', keywords: 'JSON格式化,JSON美化', category: '编程工具', path: '/json-parser' },
  { key: 'base64-converter', name: 'Base64编码解码', description: 'Base64编码解码工具', keywords: 'Base64编码,Base64解码', category: '编程工具', path: '/base64-converter' },
  { key: 'url-encoder', name: 'URL编码解码', description: 'URL编码解码工具', keywords: 'URL编码,URL解码', category: '编程工具', path: '/url-encoder' },
  { key: 'url-encode', name: 'URL编码解码工具', description: 'URL编码解码工具，支持中文字符、特殊字符', keywords: 'URL编码,URL解码', category: '编程工具', path: '/url-encode' },
  { key: 'md5-digest', name: 'MD5加密', description: 'MD5哈希值计算工具', keywords: 'MD5加密,MD5哈希', category: '编程工具', path: '/md5-digest' },
  { key: 'unicode-converter', name: 'Unicode转换', description: 'Unicode编码转换工具', keywords: 'Unicode转换,Unicode编码', category: '编程工具', path: '/unicode-converter' },
  { key: 'rc4-converter', name: 'RC4加密解密', description: 'RC4对称加密解密工具', keywords: 'RC4加密,RC4解密', category: '编程工具', path: '/rc4-converter' },
  { key: 'xml-formatter', name: 'XML美化/压缩工具', description: '在线XML代码美化和压缩工具', keywords: 'XML美化,XML压缩', category: '编程应用', path: '/xml-formatter' },
  { key: 'sql-formatter', name: 'SQL美化/压缩工具', description: '在线SQL代码美化和压缩工具', keywords: 'SQL美化,SQL压缩', category: '编程应用', path: '/sql-formatter' },
  { key: 'file-base64-converter', name: '文件Base64互转', description: '在线文件与Base64编码互相转换工具', keywords: 'Base64转换,文件编码', category: '编程应用', path: '/file-base64-converter' },
  { key: 'directory-tree-converter', name: '目录树转目录', description: '在线目录树结构与目录列表互相转换工具', keywords: '目录树,目录列表', category: '编程应用', path: '/directory-tree-converter' },
  { key: 'mac-generator', name: 'MAC随机生成', description: '在线MAC地址生成工具', keywords: 'MAC地址生成,随机MAC', category: '编程应用', path: '/mac-generator' },
  { key: 'user-agent-tool', name: '浏览器UA查询', description: '在线UserAgent解析工具', keywords: 'UserAgent,浏览器检测', category: '编程应用', path: '/user-agent-tool' },
  { key: 'js-obfuscator', name: 'JS混淆', description: '在线JavaScript代码混淆工具', keywords: 'JS混淆,代码加密', category: '编程应用', path: '/js-obfuscator' },
  { key: 'binary-converter', name: '二进制转文本工具', description: '在线二进制转换工具', keywords: '二进制转换,文本转换', category: '编程应用', path: '/binary-converter' },
  { key: 'css-to-js', name: 'CSS转JS工具', description: '在线CSS转JavaScript工具', keywords: 'CSS转JS,CSS转JavaScript', category: '编程应用', path: '/css-to-js' },
  { key: 'html-tag-remover', name: 'HTML指定标签去除', description: '在线HTML标签移除工具', keywords: 'HTML标签移除,HTML清理', category: '编程应用', path: '/html-tag-remover' },
  { key: 'html-all-tags-remover', name: 'HTML标签去除', description: '在线HTML标签全部移除工具', keywords: 'HTML标签移除,HTML转文本', category: '编程应用', path: '/html-all-tags-remover' },
  { key: 'scss-to-css', name: 'SCSS转CSS工具', description: '在线SCSS转CSS工具', keywords: 'SCSS转CSS,Sass转CSS', category: '编程应用', path: '/scss-to-css' },
  { key: 'browser-fingerprint', name: '浏览器指纹检测工具', description: '在线浏览器指纹检测工具', keywords: '浏览器指纹,Canvas指纹', category: '编程应用', path: '/browser-fingerprint' },
  { key: 'json-extractor', name: 'JSON字段提取工具', description: '在线JSON数据字段提取工具', keywords: 'JSON提取,JSON字段', category: '编程应用', path: '/json-extractor' },
  { key: 'cookie-to-json', name: 'Cookie转JSON工具', description: '在线Cookie转JSON工具', keywords: 'Cookie转换,Cookie解析', category: '编程应用', path: '/cookie-to-json' },
  { key: 'base-converter', name: '进制转换', description: '在线进制转换工具，支持2-36进制任意转换', keywords: '进制转换,二进制', category: '编程应用', path: '/base-converter' },
  { key: 'crontab-calculator', name: 'Crontab表达式', description: '在线Crontab表达式解析和执行时间计算工具', keywords: 'Crontab,定时任务', category: '编程应用', path: '/crontab-calculator' },
  { key: 'json-merger', name: 'JSON数据合并工具', description: '在线JSON数据合并和格式化工具', keywords: 'JSON合并,数据合并', category: '编程应用', path: '/json-merger' },
  { key: 'html-preview', name: 'HTML运行', description: '在线HTML代码编辑器，支持实时预览', keywords: 'HTML编辑器,代码预览', category: '编程应用', path: '/html-preview' },
  { key: 'user-agent-generator', name: 'UserAgent生成器', description: '在线UserAgent字符串生成工具', keywords: 'UserAgent生成,浏览器标识', category: '编程应用', path: '/user-agent-generator' },
  { key: 'meta-tag-generator', name: '网页META生成器', description: '在线网页META标签生成工具', keywords: 'META标签,SEO优化', category: '编程应用', path: '/meta-tag-generator' },
  { key: 'json-to-excel', name: 'JSON转Excel', description: 'JSON数据转Excel文件工具', keywords: 'JSON转Excel,JSON转换', category: '编程应用', path: '/json-to-excel' },
  { key: 'ueditor', name: '富文本编辑器', description: '在线富文本编辑器', keywords: '富文本编辑器,HTML编辑器', category: '编程应用', path: '/ueditor' },
  { key: 'uuid-generator', name: 'UUID生成器', description: 'UUID生成和验证工具', keywords: 'UUID生成器,UUID验证', category: '编程应用', path: '/uuid-generator' },
  { key: 'excel-to-json', name: 'Excel转JSON', description: 'Excel文件转JSON数据工具', keywords: 'Excel转JSON,Excel转换', category: '编程应用', path: '/excel-to-json' },
  { key: 'rsa-key-generator', name: 'RSA密钥对生成工具', description: '在线RSA密钥对生成器', keywords: 'RSA密钥生成,公钥私钥', category: '加密应用', path: '/rsa-key-generator' },
  { key: 'sha-encryption', name: 'SHA加密工具', description: '在线SHA哈希加密工具', keywords: 'SHA加密,哈希算法', category: '加密应用', path: '/sha-encryption' },
  { key: 'aes-encryption', name: 'AES加密工具', description: '在线AES加密解密工具', keywords: 'AES加密,AES解密', category: '加密应用', path: '/aes-encryption' },
  { key: 'qr-code-generator', name: '二维码生成器', description: '专业二维码生成工具', keywords: '二维码生成,QR码生成', category: '二维码工具', path: '/qr-code-generator' },
  { key: 'qr-code-scanner', name: '二维码扫描识别', description: '在线二维码扫描识别工具', keywords: '二维码扫描,QR码识别', category: '二维码工具', path: '/qr-code-scanner' },
  { key: 'barcode-generator', name: '条形码生成器', description: '在线条形码生成工具', keywords: '条形码生成,一维码生成', category: '二维码工具', path: '/barcode-generator' },
  { key: 'qr-code-repair', name: '二维码修复', description: '智能二维码修复工具', keywords: '二维码修复,二维码恢复', category: '二维码工具', path: '/qr-code-repair' },
  { key: 'currency-converter', name: '汇率转换器', description: '实时汇率查询转换工具', keywords: '汇率转换,货币转换', category: '单位转换', path: '/currency-converter' },
  { key: 'time-converter', name: '时间戳转换', description: '时间戳转换工具', keywords: '时间转换,时间戳转换', category: '单位转换', path: '/time-converter' },
  { key: 'area-converter', name: '面积单位转换', description: '面积单位转换工具', keywords: '面积转换,面积单位转换', category: '单位转换', path: '/area-converter' },
  { key: 'volume-converter', name: '体积容量转换', description: '体积容量单位转换工具', keywords: '体积转换,容量转换', category: '单位转换', path: '/volume-converter' },
  { key: 'temperature-converter', name: '温度单位转换', description: '温度单位转换工具', keywords: '温度转换,摄氏度转换', category: '单位转换', path: '/temperature-converter' },
  { key: 'speed-converter', name: '速度单位转换', description: '速度单位转换工具', keywords: '速度转换,速度单位转换', category: '单位转换', path: '/speed-converter' },
  { key: 'energy-converter', name: '能量功率转换', description: '能量功率单位转换工具', keywords: '能量转换,功率转换', category: '单位转换', path: '/energy-converter' },
  { key: 'password-generator', name: '密码生成器', description: '安全密码生成器', keywords: '密码生成器,随机密码', category: '实用工具', path: '/password-generator' },
  { key: 'random-number', name: '随机数生成器', description: '随机数生成工具', keywords: '随机数生成,随机数字', category: '实用工具', path: '/random-number' },
  { key: 'color-palette', name: '颜色选择器', description: '专业颜色选择工具', keywords: '颜色选择器,颜色工具', category: '实用工具', path: '/color-palette' },
  { key: 'drawing-board', name: '在线画板', description: '在线画板绘图工具', keywords: '在线画板,绘图工具', category: '实用工具', path: '/drawing-board' },
  { key: 'calendar', name: '万年历', description: '在线万年历查询工具', keywords: '万年历,日历查询', category: '实用工具', path: '/calendar' },
  { key: 'world-time', name: '世界时间', description: '全球时区时间查询工具', keywords: '世界时间,时区查询', category: '实用工具', path: '/world-time' },
  { key: 'lottery', name: '彩票开奖查询', description: '随机抽奖工具', keywords: '随机抽奖,抽奖工具', category: '实用工具', path: '/lottery' },
  { key: 'random-lottery', name: '随机抽奖', description: '在线随机抽奖工具', keywords: '随机抽奖,抽奖工具', category: '实用工具', path: '/random-lottery' },
  { key: 'competition-grouping', name: '比赛活动分组', description: '智能比赛分组工具', keywords: '比赛分组,活动分组', category: '实用工具', path: '/competition-grouping' },
  { key: 'relationship-calculator', name: '亲戚关系计算器', description: '智能亲戚关系计算工具', keywords: '亲戚关系计算,称呼计算', category: '实用工具', path: '/relationship-calculator' },
  { key: 'remove-watermark', name: '去水印工具', description: '智能去除图片水印工具', keywords: '去水印,水印去除', category: '实用工具', path: '/remove-watermark' },
  { key: 'resource-sniffer', name: '资源嗅探工具', description: '支持Chrome、Firefox、Edge等主流浏览器扩展下载的资源嗅探工具', keywords: '资源嗅探,浏览器扩展', category: '实用工具', path: '/resource-sniffer' },
  { key: 'id-card-validator', name: '身份证查询', description: '身份证号码验证查询工具', keywords: '身份证验证,身份证查询', category: '生活应用', path: '/id-card-validator' },
  { key: 'pregnancy-calculator', name: '预产期计算器', description: '精准预产期计算工具', keywords: '预产期计算,怀孕计算器', category: '生活应用', path: '/pregnancy-calculator' },
  { key: 'bmi-calculator', name: 'BMI身体质量指数计算', description: 'BMI身体质量指数计算器', keywords: 'BMI计算,身体质量指数', category: '生活应用', path: '/bmi-calculator' },
  { key: 'menstrual-calculator', name: '女性生理期计算器', description: '智能生理期计算工具', keywords: '生理期计算,月经周期', category: '生活应用', path: '/menstrual-calculator' },
  { key: 'credit-card-apr-calculator', name: '信用卡利率计算', description: '信用卡分期真实年化利率计算器', keywords: '信用卡年化利率,分期利率计算', category: '其他应用', path: '/credit-card-apr-calculator' },
  { key: 'dynasty-calculator', name: '历史朝代年份计算器', description: '在线历史朝代年份计算器', keywords: '历史朝代,年份计算', category: '其他应用', path: '/dynasty-calculator' },
  { key: 'chinese-calendar-calculator', name: '日期天干地支计算器', description: '在线日期天干地支计算器', keywords: '天干地支,农历计算', category: '其他应用', path: '/chinese-calendar-calculator' },
  { key: 'weather-forecast', name: '天气预报', description: '精准天气预报查询', keywords: '天气预报,天气查询', category: '查询工具', path: '/weather-forecast' },
  { key: 'ip-location', name: 'IP地址查询', description: 'IP地址归属地查询工具', keywords: 'IP查询,IP地址查询', category: '查询工具', path: '/ip-location' },
  { key: 'company-query', name: '企业信息查询', description: '企业工商信息查询工具', keywords: '企业查询,工商信息查询', category: '查询工具', path: '/company-query' },
  { key: 'postcode-query', name: '邮编查询', description: '全国邮政编码查询工具', keywords: '邮编查询,邮政编码', category: '查询工具', path: '/postcode-query' },
  { key: 'university-query', name: '大学查询', description: '全国高校信息查询工具', keywords: '大学查询,高校查询', category: '查询工具', path: '/university-query' },
  { key: 'phone-number', name: '手机号归属地', description: '手机号码归属地查询工具', keywords: '手机号查询,号码归属地', category: '查询工具', path: '/phone-number' },
  { key: 'emoji-list', name: 'Emoji符号大全', description: 'Emoji表情符号大全', keywords: 'Emoji符号,表情符号', category: '查询工具', path: '/emoji-list' },
  { key: 'symbol-list', name: '常用特殊符号大全', description: '常用特殊符号大全', keywords: '特殊符号,符号大全', category: '查询工具', path: '/symbol-list' },
  { key: 'phone-code-list', name: '国际电话区号大全', description: '国际电话区号查询工具', keywords: '国际电话区号,电话区号查询', category: '查询工具', path: '/phone-code-list' },
  { key: 'license-plate-list', name: '车牌号码简称及归属地大全', description: '全国车牌简称查询工具', keywords: '车牌查询,车牌简称', category: '查询工具', path: '/license-plate-list' },
  { key: 'ascii-table', name: 'ASCII对照表', description: 'ASCII字符编码对照表', keywords: 'ASCII码表,ASCII对照表', category: '查询工具', path: '/ascii-table' },
  { key: 'capital-list', name: '世界各国首都大全', description: '世界各国首都查询工具', keywords: '世界首都,各国首都', category: '查询工具', path: '/capital-list' },
  { key: 'country-code-list', name: '国家简码信息表', description: '全球国家ISO代码查询工具', keywords: '国家代码,ISO代码', category: '查询工具', path: '/country-code-list' },
  { key: 'location-query', name: '位置查询', description: '地理位置查询工具', keywords: '位置查询,地理位置', category: '查询工具', path: '/location-query' },
  { key: 'coordinate-query', name: '坐标查询', description: '地理坐标查询工具', keywords: '坐标查询,地理坐标', category: '查询工具', path: '/coordinate-query' },
  { key: 'trademark-query', name: '商标查询', description: '商标信息查询工具', keywords: '商标查询,商标注册', category: '查询工具', path: '/trademark-query' },
  { key: 'oil-price', name: '油价查询', description: '全国油价查询工具', keywords: '油价查询,汽油价格', category: '查询工具', path: '/oil-price' },
  { key: 'gold-price', name: '金价查询', description: '实时贵金属价格查询', keywords: '金价查询,黄金价格', category: '查询工具', path: '/gold-price' },
  { key: 'news-center', name: '新闻中心', description: '聚合新闻资讯中心', keywords: '新闻中心,新闻资讯', category: '资讯工具', path: '/news-center' },
  { key: 'hot-list', name: '热榜聚合', description: '全网热搜榜单聚合', keywords: '热搜榜,热榜聚合', category: '资讯工具', path: '/hot-list' },
  { key: 'morning-paper', name: '每日早报', description: '每日新闻早报', keywords: '每日早报,新闻早报', category: '资讯工具', path: '/morning-paper' },
  { key: 'movie-box-office', name: '电影票房', description: '实时电影票房查询工具', keywords: '电影票房,票房排行', category: '资讯工具', path: '/movie-box-office' },
  { key: 'news-browser', name: '新闻浏览器', description: '专业新闻浏览工具', keywords: '新闻浏览器,新闻阅读', category: '资讯工具', path: '/news-browser' },
  { key: 'download-queue', name: '下载队列', description: '文件下载队列管理工具', keywords: '下载队列,文件下载', category: '系统工具', path: '/download-queue' },
  { key: 'website-synthesis', name: '网站综合信息', description: '网站综合信息查询工具', keywords: '网站查询,网站信息', category: '系统工具', path: '/website-synthesis' },
];

// 按分类分组
export const getToolsByCategory = (): CategoryItem[] => {
  const categoryMap = new Map<string, ToolItem[]>();
  
  TOOLS_LIST.forEach((tool) => {
    if (!categoryMap.has(tool.category)) {
      categoryMap.set(tool.category, []);
    }
    categoryMap.get(tool.category)!.push(tool);
  });

  return Array.from(categoryMap.entries()).map(([name, tools]) => ({
    name,
    icon: CATEGORY_ICONS[name] || 'icon-tools',
    tools,
  }));
};

// 搜索工具
export const searchTools = (keyword: string): ToolItem[] => {
  if (!keyword.trim()) return [];
  const kw = keyword.toLowerCase();
  return TOOLS_LIST.filter(
    (tool) =>
      tool.name.toLowerCase().includes(kw) ||
      tool.keywords.toLowerCase().includes(kw) ||
      tool.description.toLowerCase().includes(kw) ||
      tool.category.toLowerCase().includes(kw),
  ).slice(0, 20);
};
