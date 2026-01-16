# PrintForm.js Data Attributes 审查报告

## 审查日期
2026-01-16

## 审查范围
- JavaScript 配置文件: `js/printform/config.js`
- JavaScript 辅助文件: `js/printform/helpers.js`
- 所有 HTML 测试文件

---

## 📋 完整 Data 属性清单

### 一、容器配置属性 (Container Configuration)

这些属性应用在 `.printform` 容器元素上,用于配置整体分页行为。

#### 1. 纸张尺寸配置 (Paper Size Configuration)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-papersize-width` | Number | 750 | 页面宽度(像素) |
| `data-papersize-height` | Number | 1050 | 页面高度(像素) |
| `data-paper-size` | String | "" | 预设纸张大小 (A4, A5, LETTER, LEGAL) |
| `data-orientation` | String | "portrait" | 纸张方向 (portrait/landscape) |
| `data-dpi` | Number | 96 | DPI 设置,用于计算纸张尺寸 |

**使用示例:**
```html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">
```

或使用预设纸张:
```html
<div class="printform" 
     data-paper-size="A4" 
     data-orientation="portrait" 
     data-dpi="96">
```

---

#### 2. N-Up 打印配置 (N-Up Printing)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-n-up` | Number | 1 | 每个物理页面包含的逻辑页面数量 |
| `data-show-logical-page-number` | Boolean | true | 显示逻辑页码 |
| `data-show-physical-page-number` | Boolean | false | 显示物理页码 |

**使用示例:**
```html
<div class="printform" 
     data-n-up="2" 
     data-show-logical-page-number="y" 
     data-show-physical-page-number="y">
```

---

#### 3. 重复元素配置 (Repeating Elements)

##### 3.1 头部和文档信息

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-header` | Boolean | true | 每页重复 `.pheader` |
| `data-repeat-docinfo` | Boolean | true | 每页重复 `.pdocinfo` |
| `data-repeat-docinfo002` | Boolean | true | 每页重复 `.pdocinfo002` |
| `data-repeat-docinfo003` | Boolean | true | 每页重复 `.pdocinfo003` |
| `data-repeat-docinfo004` | Boolean | true | 每页重复 `.pdocinfo004` |
| `data-repeat-docinfo005` | Boolean | true | 每页重复 `.pdocinfo005` |

##### 3.2 表格行头

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-rowheader` | Boolean | true | 每页重复 `.prowheader` |
| `data-repeat-ptac-rowheader` | Boolean | true | PTAC 页面重复 `.prowheader` |

##### 3.3 页脚

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-footer` | Boolean | false | 每页重复 `.pfooter` |
| `data-repeat-footer002` | Boolean | false | 每页重复 `.pfooter002` |
| `data-repeat-footer003` | Boolean | false | 每页重复 `.pfooter003` |
| `data-repeat-footer004` | Boolean | false | 每页重复 `.pfooter004` |
| `data-repeat-footer005` | Boolean | false | 每页重复 `.pfooter005` |
| `data-repeat-footer-logo` | Boolean | false | 每页重复 `.pfooter_logo` |
| `data-repeat-footer-pagenum` | Boolean | false | 每页重复 `.pfooter_pagenum` |

**使用示例:**
```html
<div class="printform" 
     data-repeat-header="y" 
     data-repeat-docinfo="y" 
     data-repeat-rowheader="y" 
     data-repeat-footer="n" 
     data-repeat-footer-logo="y" 
     data-repeat-footer-pagenum="y">
```

---

#### 4. 虚拟行填充配置 (Dummy Row Configuration)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-height-of-dummy-row-item` | Number | 18 | 虚拟行项目的高度(像素) |
| `data-insert-dummy-row-item-while-format-table` | Boolean | true | 插入虚拟行项目填充剩余空间 |
| `data-insert-dummy-row-while-format-table` | Boolean | false | 插入单个完整高度虚拟表格 |
| `data-insert-footer-spacer-while-format-table` | Boolean | true | 在页脚前插入间隔符 |
| `data-insert-footer-spacer-with-dummy-row-item-while-format-table` | Boolean | true | 使用虚拟行项目作为间隔符 |
| `data-custom-dummy-row-item-content` | String | "" | 自定义虚拟行内容(通过 `<template>` 提供) |

**使用示例:**
```html
<div class="printform" 
     data-height-of-dummy-row-item="26" 
     data-insert-dummy-row-item-while-format-table="y" 
     data-insert-footer-spacer-while-format-table="y">
  
  <!-- 自定义虚拟行模板 -->
  <template class="custom-dummy-row-item-content">
    <tr>
      <td style="border:0;"></td>
    </tr>
  </template>
</div>
```

---

#### 5. PTAC 配置 (Purchase Terms and Conditions)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-ptac-rowheader` | Boolean | true | PTAC 页面重复行头 |
| `data-insert-ptac-dummy-row-items` | Boolean | true | PTAC 页面允许虚拟行项目 |

**使用示例:**
```html
<div class="printform" 
     data-repeat-ptac-rowheader="n" 
     data-insert-ptac-dummy-row-items="n">
```

---

#### 6. PADDT 配置 (Post-Audit Data Terms)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-paddt` | Boolean | true | 重复 PADDT (保留,暂未使用) |
| `data-repeat-paddt-rowheader` | Boolean | true | PADDT 页面重复行头 |
| `data-insert-paddt-dummy-row-items` | Boolean | true | PADDT 页面允许虚拟行项目 |
| `data-paddt-max-words-per-segment` | Number | 200 | 每个 PADDT 段落的最大单词数 |
| `data-paddt-debug` | Boolean | false | 启用 PADDT 调试日志 |

##### PADDT 文档信息配置

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-repeat-paddt-docinfo` | Boolean | true | PADDT 页面显示 `.pdocinfo` |
| `data-repeat-paddt-docinfo002` | Boolean | true | PADDT 页面显示 `.pdocinfo002` |
| `data-repeat-paddt-docinfo003` | Boolean | true | PADDT 页面显示 `.pdocinfo003` |
| `data-repeat-paddt-docinfo004` | Boolean | true | PADDT 页面显示 `.pdocinfo004` |
| `data-repeat-paddt-docinfo005` | Boolean | true | PADDT 页面显示 `.pdocinfo005` |

**使用示例:**
```html
<div class="printform" 
     data-repeat-paddt="n" 
     data-repeat-paddt-rowheader="n" 
     data-insert-paddt-dummy-row-items="n" 
     data-paddt-max-words-per-segment="180" 
     data-paddt-debug="n" 
     data-repeat-paddt-docinfo="n">
```

---

#### 7. 调试配置 (Debug Configuration)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-debug` | Boolean | false | 启用详细控制台日志 |

**使用示例:**
```html
<div class="printform" data-debug="y">
```

---

#### 8. 页面分隔符配置 (Page Break Configuration)

| Data 属性 | 数据类型 | 默认值 | 说明 |
|-----------|---------|--------|------|
| `data-div-page-break-before-class-append` | String | "" | 附加到 `.div_page_break_before` 节点的额外 CSS 类 |

**使用示例:**
```html
<div class="printform" 
     data-div-page-break-before-class-append="pagebreak_bf_processed">
```

---

### 二、内容元素属性 (Content Element Attributes)

这些属性用于页面内容元素,控制页码显示等功能。

#### 1. 页码显示属性

| Data 属性 | 用途 | 使用位置 |
|-----------|------|---------|
| `data-page-number` | 显示当前逻辑页码 | 页脚元素内的 `<span>` |
| `data-page-total` | 显示总逻辑页数 | 页脚元素内的 `<span>` |
| `data-page-number-container` | 指定页码容器 | 页脚元素内的容器 |
| `data-physical-page-number` | 显示当前物理页码 | 页脚元素内的 `<span>` |
| `data-physical-page-total` | 显示总物理页数 | 页脚元素内的 `<span>` |
| `data-physical-page-number-container` | 指定物理页码容器 | 页脚元素内的容器 |

**使用示例:**
```html
<!-- 逻辑页码 -->
<div class="pfooter_pagenum">
  <table>
    <tr>
      <td>
        Page <span data-page-number></span> of <span data-page-total></span>
      </td>
    </tr>
  </table>
</div>

<!-- 物理页码 -->
<div class="pfooter_pagenum">
  <table>
    <tr>
      <td>
        Sheet <span data-physical-page-number></span> of <span data-physical-page-total></span>
      </td>
    </tr>
  </table>
</div>

<!-- 自定义容器 -->
<div class="pfooter_pagenum">
  <table>
    <tr>
      <td data-page-number-container>
        <!-- 页码将插入这里 -->
      </td>
    </tr>
  </table>
</div>
```

---

## 🔍 属性命名规则

### JavaScript 中的命名转换

PrintForm.js 使用以下规则在 HTML `data-*` 属性和 JavaScript 配置键之间转换:

1. **HTML → JavaScript (camelCase)**
   - `data-papersize-width` → `papersizeWidth`
   - `data-repeat-header` → `repeatHeader`
   - `data-insert-dummy-row-item-while-format-table` → `insertDummyRowItemWhileFormatTable`

2. **Legacy 全局变量 (snake_case)**
   - `papersize_width`
   - `repeat_header`
   - `insert_dummy_row_item_while_format_table`

### 配置优先级

配置值按以下优先级合并(从低到高):
1. **默认值** (DEFAULT_CONFIG)
2. **Legacy 全局变量** (window.papersize_width 等)
3. **Dataset 属性** (data-papersize-width)
4. **函数参数覆盖** (overrides)

---

## ✅ 属性验证检查

### 已定义且已使用的属性

所有以下属性都在 `config.js` 中定义,并在 HTML 文件中使用:

#### 主配置 (CONFIG_DESCRIPTORS) - 共 27 个
- ✅ `data-papersize-width`
- ✅ `data-papersize-height`
- ✅ `data-paper-size`
- ✅ `data-orientation`
- ✅ `data-dpi`
- ✅ `data-n-up`
- ✅ `data-show-logical-page-number`
- ✅ `data-show-physical-page-number`
- ✅ `data-height-of-dummy-row-item`
- ✅ `data-repeat-header`
- ✅ `data-repeat-docinfo`
- ✅ `data-repeat-docinfo002`
- ✅ `data-repeat-docinfo003`
- ✅ `data-repeat-docinfo004`
- ✅ `data-repeat-docinfo005`
- ✅ `data-repeat-rowheader`
- ✅ `data-repeat-ptac-rowheader`
- ✅ `data-repeat-footer`
- ✅ `data-repeat-footer002`
- ✅ `data-repeat-footer003`
- ✅ `data-repeat-footer004`
- ✅ `data-repeat-footer005`
- ✅ `data-repeat-footer-logo`
- ✅ `data-repeat-footer-pagenum`
- ✅ `data-insert-dummy-row-item-while-format-table`
- ✅ `data-insert-ptac-dummy-row-items`
- ✅ `data-insert-dummy-row-while-format-table`
- ✅ `data-insert-footer-spacer-while-format-table`
- ✅ `data-insert-footer-spacer-with-dummy-row-item-while-format-table`
- ✅ `data-custom-dummy-row-item-content`
- ✅ `data-debug`

#### PADDT 配置 (PADDT_CONFIG_DESCRIPTORS) - 共 10 个
- ✅ `data-repeat-paddt`
- ✅ `data-insert-paddt-dummy-row-items`
- ✅ `data-paddt-max-words-per-segment`
- ✅ `data-repeat-paddt-rowheader`
- ✅ `data-paddt-debug`
- ✅ `data-repeat-paddt-docinfo`
- ✅ `data-repeat-paddt-docinfo002`
- ✅ `data-repeat-paddt-docinfo003`
- ✅ `data-repeat-paddt-docinfo004`
- ✅ `data-repeat-paddt-docinfo005`

#### 内容元素属性 - 共 6 个
- ✅ `data-page-number`
- ✅ `data-page-total`
- ✅ `data-page-number-container`
- ✅ `data-physical-page-number`
- ✅ `data-physical-page-total`
- ✅ `data-physical-page-number-container`

#### 其他属性 - 共 1 个
- ✅ `data-div-page-break-before-class-append`

---

## 📊 统计摘要

| 类别 | 数量 |
|------|------|
| **容器配置属性** | 31 |
| **PADDT 专用配置** | 10 |
| **内容元素属性** | 6 |
| **其他属性** | 1 |
| **总计** | **48** |

---

## ⚠️ 潜在问题和建议

### 1. 命名一致性

**问题:** 某些属性命名过长
- `data-insert-footer-spacer-with-dummy-row-item-while-format-table` (60 字符)

**建议:** 考虑简化命名,例如:
- `data-footer-spacer-with-dummy` 或
- `data-spacer-mode="dummy-items"`

### 2. 布尔值处理

**当前:** 接受多种格式 (`y`, `yes`, `true`, `1`, `n`, `no`, `false`, `0`)

**建议:** 
- ✅ 保持当前灵活性,用户体验好
- 📝 在文档中明确推荐使用 `y`/`n` 以保持一致性

### 3. 未使用的属性

**发现:** `data-repeat-paddt` 在代码中被读取但未实际使用

**位置:** `config.js` 第 216 行
```javascript
{ key: "repeatPaddt", datasetKey: "repeatPaddt", legacyKey: "repeat_paddt", defaultValue: true, parser: parseBooleanFlag },
```

**建议:**
- 如果计划使用,添加实现
- 如果不需要,考虑移除或添加注释说明保留原因

### 4. 文档同步

**问题:** HTML 文件中的配置注释需要与 `config.js` 保持同步

**建议:**
- 创建单一的配置文档来源 (例如 `docs/CONFIGURATION.md`)
- 使用脚本从 `config.js` 自动生成文档
- 在 HTML 中引用文档而不是重复内容

### 5. 类型安全

**当前:** 使用字符串和手动解析

**建议:** 考虑添加 TypeScript 类型定义:
```typescript
interface PrintFormConfig {
  papersizeWidth: number;
  papersizeHeight: number;
  repeatHeader: boolean;
  // ...
}
```

---

## 🎯 最佳实践建议

### 1. 最小配置示例
```html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">
  <!-- 其他配置使用默认值 -->
</div>
```

### 2. 完整配置示例
```html
<div class="printform" 
     data-debug="y"
     data-papersize-width="750" 
     data-papersize-height="1050"
     data-height-of-dummy-row-item="26"
     data-repeat-header="y"
     data-repeat-docinfo="y"
     data-repeat-rowheader="y"
     data-repeat-footer="n"
     data-repeat-footer-logo="y"
     data-repeat-footer-pagenum="y"
     data-insert-dummy-row-item-while-format-table="y"
     data-insert-footer-spacer-while-format-table="y">
  <!-- 内容 -->
</div>
```

### 3. N-Up 打印示例
```html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050"
     data-n-up="2"
     data-show-logical-page-number="y"
     data-show-physical-page-number="y">
  <!-- 内容 -->
</div>
```

---

## 📝 下一步行动

1. [ ] 审查 `data-repeat-paddt` 的使用情况,决定是否实现或移除
2. [ ] 考虑简化过长的属性名称
3. [ ] 创建自动化文档生成脚本
4. [ ] 添加 TypeScript 类型定义
5. [ ] 在 README.md 中添加完整的配置参考链接
6. [ ] 创建交互式配置生成器工具

---

## 📚 相关文档

- [README.md](./README.md) - 项目概述和快速开始
- [DEVELOPER_BOOK.md](./DEVELOPER_BOOK.md) - 开发者手册
- [js/printform/config.js](./js/printform/config.js) - 配置定义源代码
- [js/printform/helpers.js](./js/printform/helpers.js) - 辅助函数

---

**审查完成日期:** 2026-01-16  
**审查人员:** AI Assistant  
**版本:** 1.0
