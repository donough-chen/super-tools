import request from '@/utils/request';

// ==================== 类型定义 ====================

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'batch_update'
  | 'assign_permissions'
  | 'reply'                                      // Spec-A2 新增
  | 'update_level' | 'update_plan'
  | 'adjust_points' | 'adjust_level' | 'activate_plan'
  | 'export';

export interface AuditLogListQuery {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  userId?: number;
  module?: string;
  action?: AuditAction;
  status?: 0 | 1;
  keyword?: string;
}

export interface AuditLogRow {
  id: number;
  userId: number;
  username: string;
  module: string;
  action: AuditAction;
  bizType: string;
  bizId: string;
  description: string;
  ip: string;
  requestUrl: string;
  requestMethod: string;
  responseCode: number;
  costTime: number;
  status: 0 | 1;
  failReason: string | null;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLogRow {
  beforeData: any;
  afterData: any;
  requestParams: any;
}

// ==================== API 封装 ====================

export async function listAuditLogs(params?: AuditLogListQuery) {
  return request('/api/admin/audit-logs', { params });
}

export async function getAuditLog(id: number) {
  return request(`/api/admin/audit-logs/${id}`);
}

/**
 * 导出审计日志为 CSV
 * - 浏览器原生下载（responseType:'blob'）
 * - 调用方拿到 blob 后自行触发 <a download>
 * - getResponse:true 拿到完整 response 以便检测 X-Audit-Truncated header
 */
export async function exportAuditLogs(
  params: Omit<AuditLogListQuery, 'page' | 'pageSize'> & { max?: number },
) {
  return request('/api/admin/audit-logs/export', {
    params,
    responseType: 'blob',
    getResponse: true,
  });
}
