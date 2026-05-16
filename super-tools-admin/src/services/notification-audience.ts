import request from '@/utils/request';

export async function listAudiences(params?: any) {
  return request('/api/admin/notification/audiences', { params });
}
export async function detailAudience(id: number) {
  return request(`/api/admin/notification/audiences/${id}`);
}
export async function createAudience(data: any) {
  return request('/api/admin/notification/audiences', { method: 'POST', data });
}
export async function updateAudience(id: number, data: any) {
  return request(`/api/admin/notification/audiences/${id}`, { method: 'PUT', data });
}
export async function deleteAudience(id: number) {
  return request(`/api/admin/notification/audiences/${id}`, { method: 'DELETE' });
}
export async function previewAudience(dynamicRules: any) {
  return request('/api/admin/notification/audiences/preview', { method: 'POST', data: { dynamicRules } });
}
export async function getFieldWhitelist() {
  return request('/api/admin/notification/audiences/fields');
}
