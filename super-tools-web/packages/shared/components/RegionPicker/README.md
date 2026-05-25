# RegionPicker

省市区三级联动选择器（基于 [Picker](../Picker/README.md) 封装，复用其阻尼滚动 / 渐隐遮罩 / 选中高亮等所有视觉与交互特性）。

## 设计原则

1. **纯展示层**：组件本身**不发任何网络请求**，由调用方在页面层拉取地区数据后通过 `tree` 传入
2. **自动级联**：切省时市/区自动重置为新省的第一项；切市时区自动重置为新市的第一项
3. **智能列数**：当某级数据缺失时（如直辖市无"市"层级、部分市无"区"层级），自动隐藏多余列
4. **字段兜底**：`name` 缺失时回退到 `fullname`（部分数据源仅区/县级有 `fullname`）
5. **受控/非受控两用**：传入 `value`（行政区划 id）即受控；不传则默认定位到 tree 首个叶子节点
6. **自愈**：当外部 `value` / `tree` 变化导致内部选中态与新数据集不一致时，自动校正到第一项
7. **可选搜索**：`searchable` 开启后展示顶部搜索栏，支持中文 + 拼音匹配，**默认关闭**

## 基础用法

```tsx
import React, { useEffect, useState } from 'react';
import RegionPicker, { RegionPickerNode } from '@/components/RegionPicker';
import { getAllRegions } from '@/services/region';

function MyForm() {
  const [tree, setTree] = useState<RegionPickerNode[]>([]);
  const [code, setCode] = useState<string>('');

  // 数据请求在页面层完成，组件不发请求
  useEffect(() => {
    getAllRegions().then(res => {
      if (res?.code === 0 && Array.isArray(res.data)) {
        setTree(res.data as RegionPickerNode[]);
      }
    });
  }, []);

  return (
    <RegionPicker
      tree={tree}
      value={code}
      onChange={(id, path) => {
        // id：当前末级 id（区 > 市 > 省 优先级）
        // path：{ province, city, district }，可拼接成完整路径文本
        setCode(id);
        const label = [path.province?.fullname, path.city?.fullname, path.district?.fullname]
          .filter(Boolean)
          .join(' ');
        console.log('选中：', label);
      }}
    />
  );
}
```

## 与弹窗配合（推荐用法）

由于 Picker 滑动期间会持续触发 `onChange`，通常需要"滑动暂存 + 确认提交"模式：

```tsx
const [modalVisible, setModalVisible] = useState(false);
const [tempValue, setTempValue] = useState<{ id: string; label: string }>({ id: '', label: '' });

<AppModal
  visible={modalVisible}
  title="选择所在地区"
  confirmText="确定"
  cancelText="取消"
  onConfirm={() => {
    if (tempValue.id) setField('regionCode', tempValue.id); // 确认才回写表单
    setModalVisible(false);
  }}
  onCancel={() => setModalVisible(false)}
  content={
    <RegionPicker
      tree={tree}
      value={tempValue.id || formValues.regionCode}
      searchable // 启用搜索框
      searchPlaceholder="搜索省/市/区，支持拼音"
      onChange={(id, path) => {
        const label = [path.province?.fullname, path.city?.fullname, path.district?.fullname]
          .filter(Boolean)
          .join(' ');
        setTempValue({ id, label }); // 滑动期间仅更新临时态，不写表单 dirty
      }}
    />
  }
/>;
```

## 搜索功能

`searchable` 开关控制（默认 `false`，向后兼容）。开启后：

- 顶部展示搜索栏（带 🔍 图标 / 清除按钮 / 取消按钮）
- 输入框聚焦后自动展开搜索结果，**覆盖**联动 Picker；点击"取消"返回常规模式
- 实时搜索 + 防抖（默认 200ms，可通过 `searchDebounce` 配置）
- 同时支持**中文**与**拼音**：纯英文字母时优先按拼音匹配，中文按 `name`/`fullname` 匹配
- 匹配范围覆盖**省、市、区**三级；命中后展示完整路径文本（如"广东省 / 深圳市 / 南山区"）
- 关键字片段在结果项中以 `<mark>` 高亮
- 点击结果 → 自动定位到对应省/市/区层级 → 关闭搜索界面 → 触发 `onChange`
- 数据预处理：tree 变化时一次性构建扁平化索引（包含 `pathText` / `matchPinyin`）
- 缓存机制：相同关键字命中缓存，无需重复扫描索引
- 长结果保护：最多展示 `maxSearchResults` 条（默认 100），超过则提示"还有 N 条匹配，请输入更精确的关键词"

## 组件 API

### RegionPickerProps

```ts
interface RegionPickerProps {
  /** 完整省市区树（由父组件通过接口获取后传入） */
  tree: RegionPickerNode[];
  /** 当前选中的最末级 id（如区/县 id；若仅到省/市层级则为对应级 id） */
  value?: string;
  /** 选中变更回调：返回最末级 id 与完整路径 */
  onChange?: (id: string, path: RegionPickerPath) => void;
  /** 容器高度（含遮罩），默认 240 */
  height?: number;
  /** 单行高度，默认 44 */
  itemHeight?: number;
  /** 是否启用搜索功能，默认 false（不展示搜索框） */
  searchable?: boolean;
  /** 搜索框占位文本，默认"搜索省/市/区，支持拼音" */
  searchPlaceholder?: string;
  /** 搜索结果最大展示条数（超过则提示"还有 N 条"），默认 100 */
  maxSearchResults?: number;
  /** 搜索防抖时间（ms），默认 200 */
  searchDebounce?: number;
  className?: string;
  style?: React.CSSProperties;
}
```

### RegionPickerNode

最小数据契约——只关心三个字段，其它字段（pinyin、lat、lng、hasArea 等）一并透传保留：

```ts
interface RegionPickerNode {
  id: string; // 行政区划编码，如 "440300"
  name: string; // 简称，如 "深圳"（区/县级数据源可能缺失，组件会回退到 fullname）
  fullname: string; // 全称，如 "深圳市"
  cids?: RegionPickerNode[]; // 子级
}
```

### RegionPickerPath

```ts
interface RegionPickerPath {
  province?: RegionPickerNode;
  city?: RegionPickerNode;
  district?: RegionPickerNode;
}
```

## 数据契约说明

- 顶层 `tree` 应为**省级数组**，每项的 `cids` 是市级，市的 `cids` 是区/县级
- 直辖市等两级结构：省的 `cids` 直接是区/县（无中间"市"层）—— 组件会**自动隐藏第三列**
- 区/县级 `cids` 通常为 `[]`，作为递归终点
- 若 `tree` 为空数组，组件展示"地区数据加载中..."占位

## 后端配套接口

推荐与 `super-tool-node` 的地区接口配合使用：

| 接口                                 | 说明                                          |
| ------------------------------------ | --------------------------------------------- |
| `GET /api/region/all`                | 一次性获取完整树（Redis 缓存 24h，推荐）      |
| `GET /api/region/provinces`          | 仅省级（轻量）                                |
| `GET /api/region/children/:parentId` | 按需懒加载某级子项                            |
| `GET /api/region/path/:id`           | 反查完整路径文本（如 `广东省/深圳市/南山区`） |

## 已知边界场景

| 场景                                | 行为                                |
| ----------------------------------- | ----------------------------------- |
| `tree` 为 `[]`                      | 渲染占位"地区数据加载中..."         |
| `value` 在 `tree` 中找不到          | 自动定位到 tree 第一个叶子节点      |
| 切换到只有两级结构的省（如直辖市）  | 第三列隐藏                          |
| 区/县数据缺 `name` 字段             | 显示文本回退到 `fullname`           |
| 外部 `value` 异步变化               | 内部 `pickerValue` 自动同步         |
| 滚动时父级变化导致下级 id 失效      | 自愈 useEffect 自动校正到下级第一项 |
| 搜索输入纯字母（如 `shenzhen`）     | 优先走拼音匹配，同时兜底中文匹配    |
| 搜索结果命中数 > `maxSearchResults` | 仅展示前 N 条 + "还有 X 条匹配"提示 |
| 搜索点击结果命中省/市层级（无区）   | 自动选中对应层级 + 默认子级第一项   |

## 注意事项

1. `onChange` 在**滑动过程中持续触发**，频繁回写到表单会导致 dirty 状态污染；**强烈建议**使用临时态 + 弹窗确认提交模式（参考"与弹窗配合"章节）
2. `tree` 数据建议在父组件 `useState` 中持久化（或放到全局 store），避免每次打开弹窗都重新拉取
3. 对应后端接口 `/api/region/all` 后端已做 Redis 缓存（24h），前端可放心一次性拉取
