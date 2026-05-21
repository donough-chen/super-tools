import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, Checkbox, Button, Space, message, Alert, Spin } from 'antd';
import {
  getCategoryRolePermissions, setCategoryRolePermissions, SnippetCategory,
} from '@/services/feedbackSnippet';
import { listRoles, Role } from '@/services/role';

interface Props {
  category: SnippetCategory | null;
  onClose: () => void;
}

const CategoryRolePermDrawer: React.FC<Props> = ({ category, onClose }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = !!category;

  const load = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    try {
      const [rolesRes, permRes]: any = await Promise.all([
        listRoles({ page: 1, pageSize: 100 }),
        getCategoryRolePermissions(category.id),
      ]);
      if (rolesRes?.code === 200) {
        // listRoles 返回 { rows, total } 或 { list, total }
        const data = rolesRes.data;
        setRoles(data?.rows || data?.list || data || []);
      }
      if (permRes?.code === 200) {
        setSelected(permRes.data?.roleIds || []);
      }
    } finally { setLoading(false); }
  }, [category]);

  useEffect(() => {
    if (visible) load();
    else { setRoles([]); setSelected([]); }
  }, [visible, load]);

  const handleSave = async () => {
    if (!category) return;
    setSaving(true);
    try {
      const res: any = await setCategoryRolePermissions(category.id, selected);
      if (res?.code === 200) {
        message.success('已保存');
        onClose();
      } else {
        message.error(res?.message || '保存失败');
      }
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title={category ? `角色访问权限 - ${category.name}` : '角色访问权限'}
      open={visible}
      onClose={onClose}
      width={420}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="留空（不勾选任何角色）= 所有角色都可访问该分类下的话术。勾选后仅所选角色可见。"
      />
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <Checkbox.Group
          value={selected}
          onChange={(vals) => setSelected(vals as number[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {roles.map((r) => (
            <Checkbox key={r.id} value={r.id}>
              <span style={{ fontWeight: 500 }}>{r.name}</span>
              <span style={{ color: '#999', marginLeft: 8 }}>({r.code})</span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      )}
    </Drawer>
  );
};

export default CategoryRolePermDrawer;
