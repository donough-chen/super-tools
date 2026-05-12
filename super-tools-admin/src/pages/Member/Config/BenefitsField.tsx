import React, { useEffect, useState } from 'react';
import { Input } from 'antd';

interface Props {
  value?: object;
  onChange?: (v: object) => void;
}

/**
 * benefits JSON 编辑器（自定义受控组件）
 *
 * - Textarea 输入 JSON 字符串
 * - 实时 try parse → 成功调 onChange(object)，失败显示红字
 * - 外部 value 变化时同步 text（编辑模式打开时回填）
 */
const BenefitsField: React.FC<Props> = ({ value, onChange }) => {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 外部 value 变化（编辑模式打开新行）时同步 text
    setText(JSON.stringify(value ?? {}, null, 2));
    setError(null);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    try {
      const parsed = v.trim() ? JSON.parse(v) : {};
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('benefits 必须是 JSON 对象');
        return;
      }
      setError(null);
      onChange?.(parsed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <Input.TextArea
        rows={6}
        value={text}
        onChange={handleChange}
        style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: 13 }}
        placeholder='{"discount": 0.8, "freeTools": ["calc","note"]}'
      />
      {error && (
        <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 12 }}>
          JSON 格式错误：{error}
        </div>
      )}
    </div>
  );
};

export default BenefitsField;
