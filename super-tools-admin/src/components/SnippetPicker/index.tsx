import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Button, Space, Popover, Modal, Tag, Input, Empty, Spin, message, Form, Tooltip,
} from 'antd';
import {
  BulbOutlined, BookOutlined, FireOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import {
  getSnippetRecommend, getSnippetPicker, renderSnippet,
  PickerData, RecommendItem,
} from '@/services/feedbackSnippet';
import { classifyVariables, BUILTIN_VARS } from '@/utils/snippetVars';
import './index.less';

interface Props {
  feedbackId: number;
  /** 当前回复内容（用于追加 / 替换） */
  currentValue?: string;
  /** 选中话术后的回调：返回 (renderedContent, snippetId) */
  onSelect: (content: string, snippetId: number) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

const SnippetPicker: React.FC<Props> = ({ feedbackId, currentValue, onSelect, disabled }) => {
  // 推荐
  const [recList, setRecList] = useState<RecommendItem[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recPopoverOpen, setRecPopoverOpen] = useState(false);

  // 完整库
  const [libModalOpen, setLibModalOpen] = useState(false);
  const [pickerData, setPickerData] = useState<PickerData | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [activeCatId, setActiveCatId] = useState<number | 'all'>('all');
  const [keyword, setKeyword] = useState('');

  // 自定义变量填写
  const [varModal, setVarModal] = useState<{
    visible: boolean;
    snippetId?: number;
    customVars: string[];
    title?: string;
  }>({ visible: false, customVars: [] });
  const [varForm] = Form.useForm();

  // ============ 推荐 ============

  const loadRecommend = useCallback(async () => {
    setRecLoading(true);
    try {
      const res: any = await getSnippetRecommend(feedbackId);
      if (res?.code === 200) setRecList(res.data?.list || []);
    } finally { setRecLoading(false); }
  }, [feedbackId]);

  // ============ 完整库 ============

  const loadPicker = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res: any = await getSnippetPicker();
      if (res?.code === 200) setPickerData(res.data || { categories: [], snippets: [] });
    } finally { setPickerLoading(false); }
  }, []);

  const filteredSnippets = useMemo(() => {
    if (!pickerData) return [];
    let list = pickerData.snippets;
    if (activeCatId !== 'all') {
      list = list.filter((s) => s.categoryId === activeCatId);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      list = list.filter((s) =>
        (s.title || '').toLowerCase().includes(k)
        || (s.content || '').toLowerCase().includes(k)
        || (s.tags || '').toLowerCase().includes(k)
        || (s.code || '').toLowerCase().includes(k),
      );
    }
    return list;
  }, [pickerData, activeCatId, keyword]);

  // ============ 选中话术处理 ============

  /**
   * 选中一条话术后的处理：
   * 1. 调用后端 /render 渲染内置变量
   * 2. 检查是否含自定义变量（非内置）
   * 3. 有自定义变量 → 弹表单让用户填
   * 4. 无 → 直接 onSelect
   */
  const handlePickSnippet = async (snippetId: number, snippetContent: string, snippetTitle: string) => {
    const { custom } = classifyVariables(snippetContent);

    if (custom.length === 0) {
      // 直接渲染（仅内置变量）
      const res: any = await renderSnippet(snippetId, { feedbackId });
      if (res?.code === 200) {
        onSelect(res.data.content, snippetId);
        setRecPopoverOpen(false);
        setLibModalOpen(false);
        message.success(`已插入「${snippetTitle}」`);
      } else {
        message.error(res?.message || '渲染失败');
      }
    } else {
      // 关闭主弹窗，打开变量填写表单
      setRecPopoverOpen(false);
      setLibModalOpen(false);
      varForm.resetFields();
      setVarModal({
        visible: true,
        snippetId,
        customVars: custom,
        title: snippetTitle,
      });
    }
  };

  const handleVarSubmit = async () => {
    if (!varModal.snippetId) return;
    const v = await varForm.validateFields();
    const res: any = await renderSnippet(varModal.snippetId, {
      feedbackId,
      variables: v,
    });
    if (res?.code === 200) {
      onSelect(res.data.content, varModal.snippetId);
      setVarModal({ visible: false, customVars: [] });
      message.success(`已插入「${varModal.title}」`);
    } else {
      message.error(res?.message || '渲染失败');
    }
  };

  // 自动加载（首次打开 popover/modal 时）
  useEffect(() => {
    if (recPopoverOpen && recList.length === 0) loadRecommend();
  }, [recPopoverOpen, recList.length, loadRecommend]);

  useEffect(() => {
    if (libModalOpen && !pickerData) loadPicker();
  }, [libModalOpen, pickerData, loadPicker]);

  // ============ 渲染 ============

  const recommendContent = (
    <div className="snippet-picker-recommend-popover">
      {recLoading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : recList.length === 0 ? (
        <Empty description="暂无推荐" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        recList.map((it) => (
          <div
            key={it.id}
            className="recommend-item"
            onClick={() => handlePickSnippet(it.id, it.content, it.title)}
          >
            <div className="item-title">
              <span>{it.title}</span>
              <Tag color="orange" style={{ marginLeft: 8 }}>
                <FireOutlined /> {(it.score * 100).toFixed(0)}
              </Tag>
            </div>
            <div className="item-content">{it.content}</div>
            <div className="item-meta">
              {it.tags && String(it.tags).split('|').filter(Boolean).slice(0, 3).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
              <span style={{ marginLeft: 8 }}>使用 {it.usageCount} 次</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <div className="snippet-picker-toolbar">
        <Popover
          content={recommendContent}
          title={
            <Space>
              <BulbOutlined style={{ color: '#fa8c16' }} />
              <span>智能推荐</span>
            </Space>
          }
          trigger="click"
          placement="bottomLeft"
          open={recPopoverOpen}
          onOpenChange={setRecPopoverOpen}
        >
          <Tooltip title="基于反馈类型与关键词推荐">
            <Button
              size="small" icon={<BulbOutlined />}
              disabled={disabled}
            >
              智能推荐
            </Button>
          </Tooltip>
        </Popover>

        <Button
          size="small" icon={<BookOutlined />}
          disabled={disabled}
          onClick={() => setLibModalOpen(true)}
        >
          话术库
        </Button>

        {currentValue && (
          <Button
            size="small" type="text" danger
            icon={<CloseCircleOutlined />}
            onClick={() => onSelect('', 0)}
          >
            清空
          </Button>
        )}
      </div>

      {/* 完整库 Modal */}
      <Modal
        title="选择话术"
        open={libModalOpen}
        onCancel={() => setLibModalOpen(false)}
        footer={null}
        width={840}
        className="snippet-picker-modal"
        destroyOnClose
      >
        {pickerLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : (
          <div className="picker-layout">
            <div className="picker-cats">
              <div
                className={`cat-item ${activeCatId === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCatId('all')}
              >
                全部分类 ({pickerData?.snippets.length || 0})
              </div>
              {(pickerData?.categories || []).map((c) => {
                const count = (pickerData?.snippets || []).filter((s) => s.categoryId === c.id).length;
                return (
                  <div
                    key={c.id}
                    className={`cat-item ${activeCatId === c.id ? 'active' : ''}`}
                    onClick={() => setActiveCatId(c.id)}
                  >
                    {c.name} ({count})
                  </div>
                );
              })}
            </div>
            <div className="picker-list">
              <Input.Search
                className="picker-search"
                placeholder="搜索 标题/内容/标签"
                allowClear
                onChange={(e) => setKeyword(e.target.value)}
              />
              {filteredSnippets.length === 0 ? (
                <Empty description="未找到匹配的话术" />
              ) : (
                filteredSnippets.map((s) => (
                  <div
                    key={s.id} className="item-card"
                    onClick={() => handlePickSnippet(s.id, s.content, s.title)}
                  >
                    <div className="card-title">
                      {s.title}
                      <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                        使用 {s.usageCount}
                      </span>
                    </div>
                    <div className="card-content">{s.content}</div>
                    {s.tags && (
                      <div style={{ marginTop: 4 }}>
                        {String(s.tags).split('|').filter(Boolean).map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 自定义变量填写 Modal */}
      <Modal
        title={`填写变量 - ${varModal.title || ''}`}
        open={varModal.visible}
        onOk={handleVarSubmit}
        onCancel={() => setVarModal({ visible: false, customVars: [] })}
        width={520}
        destroyOnClose
      >
        <div style={{ color: '#999', marginBottom: 16, fontSize: 13 }}>
          内置变量（{BUILTIN_VARS.join('、')}）将自动注入，仅需填写自定义变量：
        </div>
        <Form form={varForm} layout="vertical">
          {varModal.customVars.map((name) => (
            <Form.Item
              key={name}
              label={
                <Space>
                  <Tag color="orange">{`{{${name}}}`}</Tag>
                </Space>
              }
              name={name}
              rules={[{ required: true, message: `请填写 ${name}` }]}
            >
              <Input placeholder={`输入 ${name} 的值`} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
};

export default SnippetPicker;
