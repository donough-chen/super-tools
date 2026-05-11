import { listAuditLogs, getAuditLog, exportAuditLogs } from '@/services/audit-log';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('audit-log service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listAuditLogs → 全部 7 维 query 字段拼装到 URL', async () => {
    await listAuditLogs({
      page: 1,
      pageSize: 20,
      startTime: '2026-05-01',
      endTime: '2026-05-11',
      userId: 1,
      module: 'role',
      action: 'update',
      status: 1,
      keyword: 'admin',
    });
    expect(request).toHaveBeenCalledWith('/api/admin/audit-logs', {
      params: expect.objectContaining({
        startTime: '2026-05-01',
        module: 'role',
        action: 'update',
        status: 1,
        keyword: 'admin',
      }),
    });
  });

  it('getAuditLog → GET /:id', async () => {
    await getAuditLog(123);
    expect(request).toHaveBeenCalledWith('/api/admin/audit-logs/123');
  });

  it('exportAuditLogs → responseType:blob + getResponse:true', async () => {
    await exportAuditLogs({ module: 'role' });
    expect(request).toHaveBeenCalledWith('/api/admin/audit-logs/export', {
      params: { module: 'role' },
      responseType: 'blob',
      getResponse: true,
    });
  });
});
