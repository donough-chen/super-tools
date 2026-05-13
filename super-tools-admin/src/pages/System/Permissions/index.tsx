import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Tree, Input, Spin, Empty, Button, Space, Popconfirm, message, Tag, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/lib/tree';
import AuthButton from '@/components/AuthButton';
import { getPermissionTree, deletePermission, PermissionTreeNode } from '@/services/permission';
import PermissionDetailDrawer from './PermissionDetailDrawer';
import PermissionFormModal from './PermissionFormModal';
import BatchAssignRolesModal from './BatchAssignRolesModal';
import './index.less';

/** 递归过滤树节点 */
function filterTreeByKeyword(
  tree: PermissionTreeNode[],
  keyword: string,
): { filtered: PermissionTreeNode[]; matchedAncestors: number[] } {
  if (!keyword) return { filtered: tree, matchedAncestors: tree.map((n) => n.id) };
  const kw = keyword.toLowerCase();
  const ancestors = new Set<number>();

  const walk = (nodes: PermissionTreeNode[]): PermissionTreeNode[] => {
    const result: PermissionTreeNode[] = [];
    for (const n of nodes) {
      const childrenFiltered = n.children ? walk(n.children) : [];
      const selfMatch =
        n.code.toLowerCase().includes(kw) ||
        n.name.toLowerCase().includes(kw);
      if (selfMatch || childrenFiltered.length > 0) {
        result.push({
          ...n,
          children: childrenFiltered.length > 0 ? childrenFiltered : n.children,
        });
        ancestors.add(n.id);
      }
    }
    return result;
  };

  const filtered = walk(tree);
  return { filtered, matchedAncestors: Array.from(ancestors) };
}

/** 从树中按 id 找节点 */
function findNodeById(tree: PermissionTreeNode[], id: number): PermissionTreeNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

const PermissionsPage: React.FC = () => {
  const [permTree, setPermTree] = useState<PermissionTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<number[]>([]);
  const [selectedNode, setSelectedNode] = useState<PermissionTreeNode | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // CRUD
  const [formVisible, setFormVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<PermissionTreeNode | null>(null);
  const [parentNodeForCreate, setParentNodeForCreate] = useState<PermissionTreeNode | null>(null);
  // 批量赋权
  const [batchAssignVisible, setBatchAssignVisible] = useState(false);
  const [batchAssignPerm, setBatchAssignPerm] = useState<PermissionTreeNode | null>(null);

  const fetchTree = useCallback(() => {
    setLoading(true);
    getPermissionTree()
      .then((res: any) => {
        const tree: PermissionTreeNode[] = res?.data || [];
        setPermTree(tree);
        setExpandedKeys(tree.map((n) => n.id));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const { filtered, matchedAncestors } = useMemo(
    () => filterTreeByKeyword(permTree, keyword),
    [permTree, keyword],
  );

  useEffect(() => {
    if (keyword) {
      setExpandedKeys(matchedAncestors);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const handleDelete = async (node: PermissionTreeNode) => {
    const res: any = await deletePermission(node.id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetchTree();
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  const handleOpenBatchAssign = useCallback((perm: PermissionTreeNode) => {
    setBatchAssignPerm(perm);
    setBatchAssignVisible(true);
  }, []);

  /** 转换权限树为 Ant Design TreeData（含操作按钮） */
  const toTreeData = useCallback((nodes: PermissionTreeNode[]): DataNode[] => {
    return nodes.map((n) => ({
      key: n.id,
      title: (
        <span className="perm-tree-node">
          <span className="perm-tree-node-title">
            <Space>
              <Tag>{n.code}</Tag>
              <span>{n.name}</span>
              {n.type === 3 && <Tag color="purple">按钮</Tag>}
              {n.type === 4 && <Tag color="cyan">{n.method}</Tag>}
            </Space>
          </span>
          <span className="perm-tree-node-actions" onClick={(e) => e.stopPropagation()}>
            <AuthButton permCode="system:permission:create">
              <Tooltip title="新建子权限">
                <PlusOutlined
                  className="perm-action-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingNode(null);
                    setParentNodeForCreate(n);
                    setFormVisible(true);
                  }}
                />
              </Tooltip>
            </AuthButton>
            <AuthButton permCode="system:permission:update">
              <Tooltip title="编辑">
                <EditOutlined
                  className="perm-action-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingNode(n);
                    setParentNodeForCreate(null);
                    setFormVisible(true);
                  }}
                />
              </Tooltip>
            </AuthButton>
            <AuthButton permCode="system:permission:batch-assign">
              <Tooltip title="批量赋权">
                <ApartmentOutlined
                  className="perm-action-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBatchAssign(n);
                  }}
                />
              </Tooltip>
            </AuthButton>
            <AuthButton permCode="system:permission:delete">
              <Popconfirm
                title="确定删除？存在子权限时无法删除。"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDelete(n);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Tooltip title="删除">
                  <DeleteOutlined
                    className="perm-action-icon perm-action-danger"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </AuthButton>
          </span>
        </span>
      ),
      children: n.children?.length ? toTreeData(n.children) : undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleOpenBatchAssign]);

  const treeData = useMemo(() => toTreeData(filtered), [filtered, toTreeData]);

  return (
    <Card
      title="权限管理"
      className="page-system-permissions"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索 code / name"
            style={{ width: 280 }}
            allowClear
            onSearch={setKeyword}
            onChange={(e) => !e.target.value && setKeyword('')}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTree}>刷新</Button>
          <AuthButton permCode="system:permission:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingNode(null);
                setParentNodeForCreate(null);
                setFormVisible(true);
              }}
            >
              新建权限
            </Button>
          </AuthButton>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {filtered.length === 0 && !loading ? (
          <Empty description="无匹配权限" />
        ) : (
          <Tree
            showLine
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as number[])}
            onSelect={(_, info) => {
              const id = Number(info.node.key);
              const node = findNodeById(permTree, id);
              if (node) {
                setSelectedNode(node);
                setDetailVisible(true);
              }
            }}
          />
        )}
      </Spin>

      <PermissionDetailDrawer
        visible={detailVisible}
        permission={selectedNode}
        onClose={() => setDetailVisible(false)}
        onBatchAssign={handleOpenBatchAssign}
      />

      <PermissionFormModal
        visible={formVisible}
        editing={editingNode}
        parentNode={parentNodeForCreate}
        onClose={() => setFormVisible(false)}
        onSuccess={fetchTree}
      />

      <BatchAssignRolesModal
        visible={batchAssignVisible}
        permission={batchAssignPerm}
        onClose={() => setBatchAssignVisible(false)}
        onSuccess={fetchTree}
      />
    </Card>
  );
};

export default PermissionsPage;
