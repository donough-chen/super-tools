# DatePicker 日期选择器

基于 [`Picker`](../Picker/README.md) 阻尼滚动组件封装的年 / 月 / 日联动选择器，视觉风格与 [`RegionPicker`](../RegionPicker/README.md) 保持一致。组件**仅负责选择本身**，不带弹窗外壳；建议放入项目内通用的 `AppModal` 中使用。

## 特性

- ✅ 阻尼滚动 + 触摸 / 鼠标滚轮 + 渐隐遮罩，与 Picker / RegionPicker 体验一致
- ✅ **年 / 月 / 日 三级联动**，自动处理闰年与每月天数（不会出现 2 月 31 日）
- ✅ **范围裁剪**：通过 `minDate` / `maxDate` 限制可选区间，越界自动夹取
- ✅ **三种模式**：`date`（年月日）/ `year-month`（年月）/ `year`（仅年）
- ✅ **受控 + 非受控** 两用：受控传 `value`，非受控传 `defaultValue`
- ✅ 标量化对外：内部以三列驱动 Picker，但 `value` / `onChange` 都使用 `'YYYY-MM-DD'` 标准字符串
- ✅ 完整 TypeScript 类型定义
- ✅ 移动端友好：触控阻尼 + 大字号高亮项

## 安装与导入

```tsx
import DatePicker, { DatePickerProps } from '@/components/DatePicker';
```

> 路径取决于工作区 alias，本项目 `super-tools-web` 中 H5 子包通过 `@/components/DatePicker` 即可访问。

## 基础用法

### 受控

```tsx
import React, { useState } from 'react';
import DatePicker from '@/components/DatePicker';

export default function Demo() {
  const [date, setDate] = useState('1995-08-15');

  return (
    <DatePicker
      value={date}
      minDate="1900-01-01"
      maxDate={new Date().toISOString().slice(0, 10)}
      onChange={v => setDate(v)}
    />
  );
}
```

### 非受控

```tsx
<DatePicker defaultValue="2000-01-01" onChange={(v, parts) => console.log(v, parts)} />
```

### 仅年月

```tsx
<DatePicker mode="year-month" value="2026-05" />
```

> `mode="year-month"` 时仅渲染年、月两列；`onChange` 给出的 `value` 仍为 `'YYYY-MM-DD'`，其中 `day` 默认为 `01`。如果只想拿到 `YYYY-MM`，请通过 `parts.year`、`parts.month` 自行拼接。

### 仅年

```tsx
<DatePicker mode="year" defaultValue="2024-01-01" />
```

### 隐藏单位（不显示 "年/月/日" 后缀）

```tsx
<DatePicker showLabel={false} />
```

### 在弹窗中使用（与 profile 页一致的写法）

```tsx
import AppModal from '@/components/AppModal';
import DatePicker from '@/components/DatePicker';

<AppModal
  visible={visible}
  title="选择生日"
  contentType="text"
  content={
    <div className="profile-picker">
      <DatePicker
        value={pickerValue}
        minDate="1900-01-01"
        maxDate={new Date().toISOString().slice(0, 10)}
        onChange={setPickerValue}
      />
    </div>
  }
  showClose
  confirmText="确定"
  cancelText="取消"
  onConfirm={() => {
    setBirthday(pickerValue);
    setVisible(false);
  }}
  onCancel={() => setVisible(false)}
  onClose={() => setVisible(false)}
/>;
```

## API

| 属性           | 类型                                                   | 默认值         | 说明                              |
| -------------- | ------------------------------------------------------ | -------------- | --------------------------------- |
| `value`        | `string` (`'YYYY-MM-DD'`)                              | -              | 受控值。优先级高于 `defaultValue` |
| `defaultValue` | `string` (`'YYYY-MM-DD'`)                              | -              | 非受控初始值                      |
| `onChange`     | `(value: string, parts: { year, month, day }) => void` | -              | 选中变更回调                      |
| `minDate`      | `string` (`'YYYY-MM-DD'`)                              | `'1900-01-01'` | 最小可选日期                      |
| `maxDate`      | `string` (`'YYYY-MM-DD'`)                              | 当天           | 最大可选日期                      |
| `mode`         | `'date' \| 'year-month' \| 'year'`                     | `'date'`       | 选择模式                          |
| `height`       | `number`                                               | `240`          | 容器高度（px）                    |
| `itemHeight`   | `number`                                               | `44`           | 单行高度（px）                    |
| `showLabel`    | `boolean`                                              | `true`         | 是否在数字旁附加单位（年/月/日）  |
| `yearLabel`    | `string`                                               | `'年'`         | 年单位文案                        |
| `monthLabel`   | `string`                                               | `'月'`         | 月单位文案                        |
| `dayLabel`     | `string`                                               | `'日'`         | 日单位文案                        |
| `className`    | `string`                                               | -              | 自定义类名                        |
| `style`        | `React.CSSProperties`                                  | -              | 自定义内联样式                    |

### `onChange` 参数说明

```ts
onChange(value: string, parts: { year: number; month: number; day: number }): void
```

- `value`：始终为 ISO 标准 `'YYYY-MM-DD'` 字符串（即使 `mode='year-month'`，`day` 也会保留为合法值）。
- `parts`：数字三段，便于自行格式化展示（如 `${year}/${month}` / 时间戳计算等）。

## 行为约定

1. **受控同步**：传入 `value` 后，外部数据变化会同步刷新滚轮位置（受 `min`/`max` 夹取）。
2. **联动校正**：
   - 切换"年" → 月份范围按 `min`/`max` 重算；如果当前月超出范围，自动夹到边界
   - 切换"年" 或 "月" → 日范围按该月天数（含闰年）重算；如果当前日超过该月天数，自动回退到该月最大值
3. **越界保护**：所有由滚动产生的中间状态都会通过 `clampParts` 二次夹取，绝不会抛出范围之外的值。
4. **空值处理**：未传 `value`/`defaultValue` 时，组件以 `maxDate`（默认当天）作为初始定位。

## 与 RegionPicker / Picker 的关系

```
Picker（基础阻尼滚动多列选择器）
 ├── RegionPicker（省/市/区 联动 + 可选搜索）
 └── DatePicker（年/月/日 联动 + 范围裁剪）
```

三者样式 token 一致（CSS 变量 + BEM 命名），可在同一个弹窗 / 表单中混用而不冲突。

## 注意事项

- 组件不内置确认/取消按钮；请由父级（如 `AppModal`）统一控制提交流程。
- 受控模式下，请确保 `value` 是合法的 `'YYYY-MM-DD'` 字符串，否则会被忽略，使用上一次有效值。
- 滚动期间 `onChange` 会**实时触发**（与 RegionPicker 一致）。如果业务希望"确认才回填"，请由父组件维护临时态再在确认时写入表单（参考 profile 页的 `genderPickerValue` / `regionPickerValue` 模式）。
