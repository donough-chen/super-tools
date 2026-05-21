import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, Timeline, Button, Tag, Space, Popconfirm, message, Empty, Spin } from 'antd';
import AuthButton from '@/components/AuthButton';
import {
  getSnippetVersions, rollbackSnippet, Snippet, SnippetVersion,
} from '@/services/feedbackSnippet';
import { formatDateTime } from '@/utils/format';

interface Props {
  visible: boolean;
  snippet: Snippet | null;
  onClose: () => void;
  onRollback: () => void;
}

const VersionHistoryDrawer: React.FC<Props> = ({ visible, snippet, onClose, onRollback }) => {
  const [versions, setVersions] = useState<SnippetVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!snippet) return;
    setLoading(true);
    try {
      const res: any = await getSnippetVersions(snippet.id);
      if (res?.code === 200) setVersions(res.data || []);
    } finally { setLoading(false); }
  }, [snippet]);

  useEffect(() => {
    if (visible && snippet) load();
  }, [visible, snippet, load]);

  const handleRollback = async (v: SnippetVersion) => {
    if (!snippet) return;
    const res: any = await rollbackSnippet(snippet.id, v.id);
    if (res?.code === 200) {
      message.success(`已回滚到 v${v.version}（新版本号 v${res.data.version}）`);
      onRollback();
    } else {
      message.error(res?.message || '回滚失败');
    }
  };

  return (
    <Drawer
      title={snippet ? `版本历史 - ${snippet.title}` : '版本历史'}
      open={visible}
      onClose={onClose}
      width={680}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : versions.length === 0 ? (
        <Empty description="暂无版本记录（话术尚未发布过）" />
      ) : (
        <Timeline
          items={versions.map((v) => ({
            color: v.version === snippet?.currentVersion ? 'green' : 'gray',
            children: (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Space>
                    <Tag color={v.version === snippet?.currentVersion ? 'green' : 'default'}>
                      v{v.version}{v.version === snippet?.currentVersion ? ' (当前)' : ''}
                    </Tag>
                    <span style={{ color: '#666', fontSize: 12 }}>
                      {formatDateTime(v.publishedAt)}
                    </span>
                    {v.changeNote && (
                      <span style={{ color: '#999', fontSize: 12 }}>{v.changeNote}</span>
                    )}
                  </Space>
                </div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{v.title}</div>
                <div className="snippet-content-preview" style={{ maxHeight: 120 }}>
                  {v.content}
                </div>
                {v.tags && (
                  <div style={{ marginTop: 6 }}>
                    {String(v.tags).split('|').filter(Boolean).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                )}
                {v.version !== snippet?.currentVersion && (
                  <div style={{ marginTop: 8 }}>
                    <AuthButton permCode="feedback:snippet:rollback-api">
                      <Popconfirm
                        title={`回滚到 v${v.version}?`}
                        description="将基于此版本生成新版本（不删除已有版本）"
                        onConfirm={() => handleRollback(v)}
                      >
                        <Button size="small" type="primary" ghost>回滚到此版本</Button>
                      </Popconfirm>
                    </AuthButton>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
};

export default VersionHistoryDrawer;
