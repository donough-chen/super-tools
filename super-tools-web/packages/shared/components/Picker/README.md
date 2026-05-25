# Picker

级联筛选组件

## 基础用法

```JavaScript
import { useState } from 'react'
import Picker from '@shared/components/Picker'

const selections = {
  title: ['Mr.', 'Mrs.', 'Ms.', 'Dr.'],
  firstName: ['John', 'Micheal', 'Elizabeth'],
  lastName: ['Lennon', 'Jackson', 'Jordan', 'Legend', 'Taylor']
}

function MyPicker() {
  const [pickerValue, setPickerValue] = useState({
    title: 'Mr.',
    firstName: 'Micheal',
    lastName: 'Jordan'
  })

  return (
    <Picker value={pickerValue} onChange={setPickerValue}>
      {Object.keys(selections).map(name => (
        <Picker.Column key={name} name={name}>
          {selections[name].map(option => (
            <Picker.Item key={option} value={option}>
              {({ selected }) => (
                <div className={selected ? 'selected' : 'normal'}>{option}</div>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
      ))}
    </Picker>
  )
}
```

## 组件API

### Picker容器组件

```javascript
interface IProps {
  value: { [name: string]: string }; // 选中值的键值对
  onChange: (value: T, key: string) => void; // 滑动时选中值的change事件
  height?: number;      // 容器高度，默认216
  itemHeight?: number;  // item行高，默认36
  highlightBg?: string; // 高亮item背景色，默认'#9ecdfc'
  wheelMode?: 'off' | 'natural' | 'normal'; // 滚动模式，默认'off'
}
```

### Picker.Column列组件

```javascript
interface IProps {
  name: string; // 名称需要是 Picker 组件中值的键之一
}
```

### Picker.Item行选项组件

```javascript
interface IProps {
  value: string; // 当前选项的值
}
// render时的可选参数
interface RenderProps {
  selected?: boolean; // 是否选择了当前选项
}
```
