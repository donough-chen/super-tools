import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Tree, Table, Button, Input, Select, Space, Popconfirm, message, Tag, Modal, Upload, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ImportOutlined, ExportOutlined,
  EditOutlined, DeleteOutlined, FolderOutlined, TeamOutlined,
} from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import {
  getSnippetCategoryTree, deleteSnippetCategory, createSnippetCategory, updateSnippetCategory,
  getSnippetList, deleteSnippet, publishSnippet, disableSnippet,
  exportSnippets, importSnippets,
  Snippet, SnippetCategory, SnippetStatus,
} from '@/services/feedbackSnippet';
import { formatDateTime } from '@/utils/format';
import SnippetEditDrawer from './SnippetEditDrawer';
import VersionHistoryDrawer from './VersionHistoryDrawer';
import CategoryRolePermDrawer from './CategoryRolePermDrawer';
import CategoryEditModal from './CategoryEditModal';
import './index.less';

const STATUS_LABELS: Record<SnippetStatus, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '已发布', color: 'green' },
  2: { text: '已停用', color: 'default' },
};

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 0 },
  { label: '已发布', value: 1 },
  { label: '已停用', value: 2 },
];

interface TreeNode {
  key: number;
  title: React.ReactNode;
  raw: SnippetCategory;
  children?: TreeNode[];
}

const SnippetsPage: React.FC = () => {
  // 分类
  const [tree, setTree] = useState<SnippetCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | undefined>(undefined);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editCat, setEditCat] = useState<SnippetCategory | null>(null);
  const [permDrawerCat, setPermDrawerCat] = useState<SnippetCategory | null>(null);

  // 话术
  const [list, setList] = useState<Snippet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<SnippetStatus | ''>('');
  const [loading, setLoading] = useState(false);

  // Drawer
  const [editDrawer, setEditDrawer] = useState<{ visible: boolean; data?: Snippet | null }>({ visible: false });
  const [versionDrawer, setVersionDrawer] = useState<{ visible: boolean; snippet?: Snippet | null }>({ visible: false });

  // ============ 分类相关 ============

  const loadTree = useCallback(async () => {
    const res: any = await getSnippetCategoryTree();
    if (res?.code === 200) setTree(res.data || []);
  }, []);

  const treeData: TreeNode[] = useMemo(() => {
    const build = (nodes: SnippetCategory[]): TreeNode[] =>
      (nodes || []).map((n) => ({
        key: n.id,
        title: (
          <span className="cat-row">
            <span>
              <FolderOutlined style={{ color: n.color || '#1677ff', marginRight: 6 }} />
              {n.name}
              {n.status === 0 && <Tag color="default" style={{ marginLeft: 6 }}>禁用</Tag>}
              {n.isSystem === 1 && <Tag color="blue" style={{ marginLeft: 6 }}>系统</Tag>}
            </span>
            <span className="cat-actions">
              <Space size={4}>
                <AuthButton permCode="feedback:snippet:category:role-perm">
                  <Tooltip title="角色访问权限">
                    <Button
                      size="small" type="text" icon={<TeamOutlined />}
                      onClick={(e) => { e.stopPropagation(); setPermDrawerCat(n); }}
                    />
                  </Tooltip>
                </AuthButton>
                <AuthButton permCode="feedback:snippet:category:update">
                  <Tooltip title="编辑">
                    <Button
                      size="small" type="text" icon={<EditOutlined />}
                      onClick={(e) => { e.stopPropagation(); setEditCat(n); setCatModalVisible(true); }}
                    />
                  </Tooltip>
                </AuthButton>
                {n.isSystem !== 1 && (
                  <AuthButton permCode="feedback:snippet:category:delete">
                    <Popconfirm
                      title={`删除分类「${n.name}」?`}
                      onConfirm={async (e) => {
                        e?.stopPropagation();
                        const res: any = await deleteSnippetCategory(n.id);
                        if (res?.code === 200) {
                          message.success('已删除');
                          loadTree();
                        } else {
                          message.error(res?.message || '删除失败');
                        }
                      }}
                    >
                      <Button
                        size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </AuthButton>
                )}
              </Space>
            </span>
          </span>
        ),
        raw: n,
        children: n.children && n.children.length > 0 ? build(n.children) : undefined,
      }));
    return build(tree);
  }, [tree, loadTree]);

  // ============ 话术相关 ============

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getSnippetList({
        page, pageSize,
        categoryId: selectedCatId,
        status: status === '' ? undefined : status as SnippetStatus,
        keyword: keyword || undefined,
      });
      if (res?.code === 200) {
        setList(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally { setLoading(false); }
  }, [page, pageSize, selectedCatId, status, keyword]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { loadList(); }, [loadList]);

  // ============ 操作 ============

  const handleDelete = async (row: Snippet) => {
    const res: any = await deleteSnippet(row.id);
    if (res?.code === 200) { message.success('已删除'); loadList(); }
    else message.error(res?.message || '删除失败');
  };

  const handlePublish = async (row: Snippet) => {
    const res: any = await publishSnippet(row.id);
    if (res?.code === 200) { message.success(`已发布 v${res.data.version}`); loadList(); }
    else message.error(res?.message || '发布失败');
  };

  const handleDisable = async (row: Snippet) => {
    const res: any = await disableSnippet(row.id);
    if (res?.code === 200) { message.success('已停用'); loadList(); }
    else message.error(res?.message || '操作失败');
  };

  const handleExport = async () => {
    const res: any = await exportSnippets();
    if (res?.code === 200 && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-snippets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已导出');
    } else {
      message.error(res?.message || '导出失败');
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const res: any = await importSnippets(data);
        if (res?.code === 200) {
          const r = res.data;
          message.success(`导入成功：分类 ${r.categoriesCreated} 个，话术 ${r.snippetsCreated} 条`);
          if (r.skipped?.length) {
            Modal.info({ title: '部分跳过', content: r.skipped.join('\n'), width: 600 });
          }
          loadTree();
          loadList();
        } else {
          message.error(res?.message || '导入失败');
        }
      } catch (err: any) {
        message.error(`JSON 解析失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    return false;
  };

  // ============ 渲染 ============

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Code', dataIndex: 'code', width: 160 },
    {
      title: '标题', dataIndex: 'title', ellipsis: true,
      render: (t: string, r: Snippet) => (
        <span>
          {t}
          {r.tags && (
            <span style={{ marginLeft: 8 }}>
              {String(r.tags).split('|').filter(Boolean).slice(0, 3).map((tag) => (
                <Tag key={tag} style={{ marginRight: 4 }}>{tag}</Tag>
              ))}
            </span>
          )}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: SnippetStatus) => <Tag color={STATUS_LABELS[s].color}>{STATUS_LABELS[s].text}</Tag>,
    },
    { title: '版本', dataIndex: 'currentVersion', width: 70, render: (v: number) => `v${v}` },
    { title: '使用次数', dataIndex: 'usageCount', width: 90 },
    {
      title: '更新时间', dataIndex: 'updatedAt', width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作', width: 280, fixed: 'right' as const,
      render: (_: any, row: Snippet) => (
        <Space size={4} wrap>
          <AuthButton permCode="feedback:snippet:update">
            <Button size="small" type="link" onClick={() => setEditDrawer({ visible: true, data: row })}>编辑</Button>
          </AuthButton>
          <AuthButton permCode="feedback:snippet:publish">
            {row.status !== 1 ? (
              <Popconfirm title="发布当前内容为新版本?" onConfirm={() => handlePublish(row)}>
                <Button size="small" type="link">发布</Button>
              </Popconfirm>
            ) : (
              <Popconfirm title="停用此话术?" onConfirm={() => handleDisable(row)}>
                <Button size="small" type="link">停用</Button>
              </Popconfirm>
            )}
          </AuthButton>
          <AuthButton permCode="feedback:snippet:versions">
            <Button size="small" type="link" onClick={() => setVersionDrawer({ visible: true, snippet: row })}>版本</Button>
          </AuthButton>
          <AuthButton permCode="feedback:snippet:delete">
            <Popconfirm title="删除此话术?" onConfirm={() => handleDelete(row)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          </AuthButton>
        </Space>
      ),
    },
  ];

  return (
    <div className="snippets-page">
      <div className="snippets-sider">
        <div className="sider-header">
          <span>分类</span>
          <AuthButton permCode="feedback:snippet:category:create">
            <Button
              size="small" type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditCat(null); setCatModalVisible(true); }}
            >
              新建
            </Button>
          </AuthButton>
        </div>
        <Tree
          treeData={[
            { key: 0, title: '全部分类', raw: null as any },
            ...treeData,
          ] as any}
          defaultExpandAll
          selectedKeys={selectedCatId !== undefined ? [selectedCatId] : [0]}
          onSelect={(keys) => {
            const k = keys[0];
            setSelectedCatId(k === 0 ? undefined : (k as number));
            setPage(1);
          }}
          blockNode
        />
      </div>

      <div className="snippets-main">
        <div className="toolbar">
          <Input.Search
            placeholder="搜索 标题/内容/code"
            allowClear
            style={{ width: 280 }}
            onSearch={(v) => { setKeyword(v); setPage(1); }}
          />
          <Select
            value={status}
            options={STATUS_OPTIONS}
            style={{ width: 120 }}
            onChange={(v) => { setStatus(v); setPage(1); }}
          />
          <Button icon={<ReloadOutlined />} onClick={loadList}>刷新</Button>
          <div style={{ flex: 1 }} />
          <AuthButton permCode="feedback:snippet:create">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditDrawer({ visible: true, data: null })}>
              新建话术
            </Button>
          </AuthButton>
          <AuthButton permCode="feedback:snippet:import-export">
            <Upload accept=".json" beforeUpload={handleImport} showUploadList={false}>
              <Button icon={<ImportOutlined />}>导入</Button>
            </Upload>
          </AuthButton>
          <AuthButton permCode="feedback:snippet:import-export">
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          </AuthButton>
        </div>

        <div className="table-wrap">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={list}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page, pageSize, total,
              showSizeChanger: true,
              showTotal: (n) => `共 ${n} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
            expandable={{
              expandedRowRender: (row: Snippet) => (
                <div className="snippet-content-preview">{row.content}</div>
              ),
            }}
          />
        </div>
      </div>

      {/* 分类编辑 Modal */}
      <CategoryEditModal
        visible={catModalVisible}
        category={editCat}
        parentCategories={tree}
        onClose={() => setCatModalVisible(false)}
        onSaved={() => { setCatModalVisible(false); loadTree(); }}
      />

      {/* 分类角色权限 Drawer */}
      <CategoryRolePermDrawer
        category={permDrawerCat}
        onClose={() => setPermDrawerCat(null)}
      />

      {/* 话术编辑 Drawer */}
      <SnippetEditDrawer
        visible={editDrawer.visible}
        snippet={editDrawer.data}
        categories={tree}
        onClose={() => setEditDrawer({ visible: false })}
        onSaved={() => { setEditDrawer({ visible: false }); loadList(); }}
      />

      {/* 版本历史 Drawer */}
      <VersionHistoryDrawer
        visible={versionDrawer.visible}
        snippet={versionDrawer.snippet || null}
        onClose={() => setVersionDrawer({ visible: false })}
        onRollback={() => { setVersionDrawer({ visible: false }); loadList(); }}
      />
    </div>
  );
};

export default SnippetsPage;
