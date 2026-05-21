import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Form, Input, Button, Space, Select, TreeSelect, Tag, message, Alert, Divider,
} from 'antd';
import {
  createSnippet, updateSnippet,
  Snippet, SnippetCategory, SnippetCreatePayload,
} from '@/services/feedbackSnippet';
import {
  classifyVariables, renderPreview, tagsToArray, arrayToTags, BUILTIN_VARS,
} from '@/utils/snippetVars';

interface Props {
  visible: boolean;
  snippet: Snippet | null | undefined;
  categories: SnippetCategory[];
  onClose: () => void;
  onSaved: () => void;
}

function flattenCats(nodes: SnippetCategory[]): any[] {
  return (nodes || []).map((n) => ({
    title: n.name,
    value: n.id,
    children: n.children && n.children.length > 0 ? flattenCats(n.children) : undefined,
  }));
}

const SnippetEditDrawer: React.FC<Props> = ({ visible, snippet, categories, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const isEdit = !!snippet;
  const [content, setContent] = useState('');
  const [tagsArr, setTagsArr] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [sampleVars, setSampleVars] = useState<Record<string, any>>({});
  const [sampleJsonError, setSampleJsonError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (snippet) {
        form.setFieldsValue({
          ...snippet,
          sampleVariablesJson: snippet.sampleVariables
            ? JSON.stringify(snippet.sampleVariables, null, 2) : '',
        });
        setContent(snippet.content || '');
        setTagsArr(tagsToArray(snippet.tags));
        setSampleVars(snippet.sampleVariables || {});
      } else {
        form.resetFields();
        setContent('');
        setTagsArr([]);
        setSampleVars({});
      }
      setSampleJsonError('');
      setTagInput('');
    }
  }, [visible, snippet, form]);

  const { builtin, custom } = useMemo(() => classifyVariables(content), [content]);
  const previewBuiltinValues = useMemo(() => ({
    currentDate: new Date().toISOString().slice(0, 10),
    feedbackId: '12345',
    feedbackType: '建议',
    userName: '张三',
    adminName: '管理员',
  }), []);
  const previewVars = { ...previewBuiltinValues, ...sampleVars };
  const preview = useMemo(() => renderPreview(content, previewVars), [content, previewVars]);

  const handleAddTag = (val: string) => {
    const t = val.trim();
    if (!t) return;
    if (tagsArr.includes(t)) { message.warning('标签已存在'); return; }
    if (tagsArr.length >= 10) { message.warning('最多 10 个标签'); return; }
    if (t.length > 20) { message.warning('单标签不超过 20 字'); return; }
    setTagsArr([...tagsArr, t]);
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTagsArr(tagsArr.filter((x) => x !== t));
  };

  const handleSampleJsonChange = (val: string) => {
    form.setFieldValue('sampleVariablesJson', val);
    if (!val.trim()) {
      setSampleVars({});
      setSampleJsonError('');
      return;
    }
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setSampleJsonError('必须是 JSON 对象');
        return;
      }
      setSampleVars(parsed);
      setSampleJsonError('');
    } catch (e: any) {
      setSampleJsonError('JSON 解析错误：' + e.message);
    }
  };

  const handleSubmit = async () => {
    const v = await form.validateFields();
    if (sampleJsonError) { message.error(sampleJsonError); return; }

    const payload: any = {
      categoryId: v.categoryId,
      title: v.title,
      content,
      tags: arrayToTags(tagsArr) || null,
      sampleVariables: Object.keys(sampleVars).length > 0 ? sampleVars : null,
      description: v.description || null,
    };

    let res: any;
    if (isEdit && snippet) {
      res = await updateSnippet(snippet.id, payload);
    } else {
      payload.code = v.code;
      res = await createSnippet(payload as SnippetCreatePayload);
    }

    if (res?.code === 200 || res?.code === 201) {
      message.success(isEdit ? '已更新' : '已创建');
      onSaved();
    } else {
      message.error(res?.message || '保存失败');
    }
  };

  return (
    <Drawer
      title={isEdit ? `编辑话术 - ${snippet?.title}` : '新建话术'}
      open={visible}
      onClose={onClose}
      width={720}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit}>保存</Button>
        </Space>
      }
    >
      {isEdit && snippet?.status === 1 && (
        <Alert
          showIcon type="warning" style={{ marginBottom: 16 }}
          message="此话术已发布，标题与内容不能直接修改。如需修改请先停用或发布新版本。"
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          label="分类" name="categoryId"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <TreeSelect
            treeData={flattenCats(categories)}
            placeholder="选择分类"
            treeDefaultExpandAll
          />
        </Form.Item>
        <Form.Item
          label="Code" name="code"
          rules={[
            { required: true, message: '请输入 code' },
            { pattern: /^[a-z][a-z0-9_-]{1,63}$/i, message: 'code 仅允许字母数字下划线短横' },
          ]}
        >
          <Input disabled={isEdit} placeholder="例如 refund-process" />
        </Form.Item>
        <Form.Item
          label="标题" name="title"
          rules={[{ required: true, message: '请输入标题' }, { max: 100 }]}
        >
          <Input placeholder="一句话简介此话术用途" />
        </Form.Item>

        <Form.Item label="标签（关键词）">
          <Space wrap>
            {tagsArr.map((t) => (
              <Tag key={t} closable onClose={() => handleRemoveTag(t)}>{t}</Tag>
            ))}
            <Input
              size="small" style={{ width: 120 }}
              placeholder="按回车添加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault();
                handleAddTag(tagInput);
              }}
              onBlur={() => tagInput && handleAddTag(tagInput)}
            />
          </Space>
          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
            最多 10 个，单个不超过 20 字。用于智能推荐时关键词匹配。
          </div>
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>话术内容</span>
              <Tag>支持变量 {`{{varName}}`}</Tag>
            </Space>
          }
          required
        >
          <Input.TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            maxLength={5000}
            showCount
            placeholder={`例如：\n您好 {{userName}}，您的反馈 #{{feedbackId}} 已收到，我们会尽快处理。\n\n—— {{adminName}}  {{currentDate}}`}
          />
        </Form.Item>

        {(builtin.length > 0 || custom.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>识别到的变量：</strong>
            </div>
            <Space wrap>
              {builtin.map((v) => (
                <Tag key={v} color="blue">{`{{${v}}}`} <span style={{ color: '#999' }}>(内置)</span></Tag>
              ))}
              {custom.map((v) => (
                <Tag key={v} color="orange">{`{{${v}}}`} <span style={{ color: '#999' }}>(自定义)</span></Tag>
              ))}
            </Space>
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
              内置可用：{BUILTIN_VARS.join('，')}
            </div>
          </div>
        )}

        <Form.Item
          label={
            <Space>
              <span>变量样本（JSON，自定义变量预览用）</span>
              {sampleJsonError && <Tag color="red">{sampleJsonError}</Tag>}
            </Space>
          }
          name="sampleVariablesJson"
        >
          <Input.TextArea
            rows={4}
            placeholder='{"orderNo": "ORD-001", "amount": 99.5}'
            onChange={(e) => handleSampleJsonChange(e.target.value)}
          />
        </Form.Item>

        <Divider>实时预览</Divider>
        <div className="snippet-content-preview" style={{ marginBottom: 16 }}>
          {preview.result || <span style={{ color: '#bbb' }}>（输入内容后预览）</span>}
        </div>
        {preview.missing.length > 0 && (
          <Alert
            type="info" showIcon
            message={`未提供值的变量：${preview.missing.join('，')}`}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="备注" name="description">
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default SnippetEditDrawer;
