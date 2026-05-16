import request from '@/utils/request';

// ==================== Types ====================
export async function listTypes(params?: any) {
  return request('/api/admin/notification/types', { params });
}
export async function createType(data: any) {
  return request('/api/admin/notification/types', { method: 'POST', data });
}
export async function updateType(id: number, data: any) {
  return request(`/api/admin/notification/types/${id}`, { method: 'PUT', data });
}
export async function deleteType(id: number) {
  return request(`/api/admin/notification/types/${id}`, { method: 'DELETE' });
}

// ==================== Templates ====================
export async function listTemplates(params?: any) {
  return request('/api/admin/notification/templates', { params });
}
export async function detailTemplate(id: number) {
  return request(`/api/admin/notification/templates/${id}`);
}
export async function createTemplate(data: any) {
  return request('/api/admin/notification/templates', { method: 'POST', data });
}
export async function updateTemplate(id: number, data: any) {
  return request(`/api/admin/notification/templates/${id}`, { method: 'PUT', data });
}
export async function publishTemplate(id: number, data?: any) {
  return request(`/api/admin/notification/templates/${id}/publish`, { method: 'POST', data });
}
export async function previewTemplate(id: number, variables: any) {
  return request(`/api/admin/notification/templates/${id}/preview`, { method: 'POST', data: { variables } });
}
export async function testSendTemplate(id: number, data: any) {
  return request(`/api/admin/notification/templates/${id}/test-send`, { method: 'POST', data });
}

// ==================== Tasks ====================
export async function listTasks(params?: any) {
  return request('/api/admin/notification/tasks', { params });
}
export async function detailTask(id: number) {
  return request(`/api/admin/notification/tasks/${id}`);
}
export async function createTask(data: any) {
  return request('/api/admin/notification/tasks', { method: 'POST', data });
}

// ==================== Messages (admin) ====================
export async function listMessages(params?: any) {
  return request('/api/admin/notification/messages', { params });
}
export async function detailMessage(id: number) {
  return request(`/api/admin/notification/messages/${id}`);
}

// ==================== My notifications (C-end API) ====================
export async function listMyNotifications(params?: any) {
  return request('/api/notifications', { params });
}
export async function unreadCount() {
  return request('/api/notifications/unread-count');
}
export async function markRead(ids: number[]) {
  return request('/api/notifications/mark-read', { method: 'POST', data: { ids } });
}
export async function markAllRead() {
  return request('/api/notifications/mark-all-read', { method: 'POST' });
}
