/**
 * @file 定时任务处理器注册入口
 * @description 导入并注册所有通知系统的定时任务处理器。
 *   应用启动时通过 import 此文件完成所有 handler 的注册。
 *
 * @module lib/notification-handlers/index
 */
import './memberExpireSoon';
import './cleanupMessages';
import './cleanupSendLogs';
import './cleanupExports';
import './mailHealthCheck';
