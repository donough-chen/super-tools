import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tree, Input, Spin, Empty } from 'antd';
import { getPermissionTree, PermissionTreeNode } from '@/services/permission';
import { toAntdTreeData } from '@/pages/System/_shared/treeUtils';
import PermissionDetailDrawer from './PermissionDetailDrawer';
import './index.less';

/** 递归过滤树节点：保留 code/name 命中关键字 + 其祖先 */
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

  useEffect(() => {
    setLoading(true);
    getPermissionTree()
      .then((res: any) => {
        const tree: PermissionTreeNode[] = res?.data || [];
        setPermTree(tree);
        setExpandedKeys(tree.map((n) => n.id));  // 默认展开 type=1 顶级
      })
      .finally(() => setLoading(false));
  }, []);

  const { filtered, matchedAncestors } = useMemo(
    () => filterTreeByKeyword(permTree, keyword),
    [permTree, keyword],
  );

  // 搜索时自动展开匹配祖先
  useEffect(() => {
    if (keyword) {
      setExpandedKeys(matchedAncestors);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  return (
    <Card
      title="权限管理（只读）"
      className="page-system-permissions"
      extra={
        <Input.Search
          placeholder="搜索 code / name"
          style={{ width: 280 }}
          allowClear
          onSearch={setKeyword}
          onChange={(e) => !e.target.value && setKeyword('')}
        />
      }
    >
      <Spin spinning={loading}>
        {filtered.length === 0 && !loading ? (
          <Empty description="无匹配权限" />
        ) : (
          <Tree
            showLine
            treeData={toAntdTreeData(filtered)}
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
      />
    </Card>
  );
};

export default PermissionsPage;
