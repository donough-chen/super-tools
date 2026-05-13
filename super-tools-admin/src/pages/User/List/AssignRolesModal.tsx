import React, { useEffect, useState } from 'react';
import { Modal, Checkbox, Space, Tag, Spin, Tooltip, message, Typography } from 'antd';
import { listRoles, Role } from '@/services/role';
import { getUser, assignUserRoles, User } from '@/services/user';

const { Text } = Typography;

interface Props {
  visible: boolean;
  target: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignRolesModal: React.FC<Props> = ({ visible, target, onClose, onSuccess }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && target) {
      setLoading(true);
      Promise.all([
        listRoles({ pageSize: 100 }),
        getUser(target.id),
      ]).then(([rolesRes, userRes]: any[]) => {
        const allRoles: Role[] = rolesRes?.data?.list || [];
        setRoles(allRoles.filter(r => r.code !== 'super_admin'));
        const currentRoleIds = (userRes?.data?.roles || [])
          .map((r: any) => Number(r.id))
          .filter((id: number) => !Number.isNaN(id));
        const saRole = allRoles.find(r => r.code === 'super_admin');
        setCheckedIds(currentRoleIds.filter((id: number) => id !== saRole?.id));
      }).catch((e: any) => {
        message.error(e?.message || '加载角色数据失败');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setRoles([]);
      setCheckedIds([]);
    }
  }, [visible, target]);

  const handleOk = async () => {
    if (!target) return;
    if (checkedIds.length === 0) {
      message.warning('至少保留一个角色');
      return;
    }
    setSaving(true);
    try {
      const res: any = await assignUserRoles(target.id, checkedIds);
      if (res?.code === 200) {
        message.success('角色分配成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '分配失败');
      }
    } catch (e: any) {
      message.error(e?.message || '分配失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (roleId: number, checked: boolean) => {
    if (checked) {
      setCheckedIds(prev => [...prev, roleId]);
    } else {
      const next = checkedIds.filter(id => id !== roleId);
      if (next.length === 0) {
        message.warning('至少保留一个角色');
        return;
      }
      setCheckedIds(next);
    }
  };

  return (
    <Modal
      title={`分配角色 - ${target?.nickname || target?.username || ''}`}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnClose
      width={520}
    >
      <Spin spinning={loading}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          当前用户：{target?.username} (ID: {target?.id})
        </Text>
        <Space direction="vertical" style={{ width: '100%' }}>
          {roles.map(role => (
            <div key={role.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Checkbox
                checked={checkedIds.includes(role.id)}
                onChange={(e) => handleChange(role.id, e.target.checked)}
              >
                <Tag color="blue">{role.name}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {role.description || role.code}
                </Text>
              </Checkbox>
            </div>
          ))}
        </Space>
        <Tooltip title="超级管理员角色仅可通过数据库直接操作">
          <Text type="warning" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
            ⚠ 超级管理员角色不在此列表中显示
          </Text>
        </Tooltip>
      </Spin>
    </Modal>
  );
};

export default AssignRolesModal;
