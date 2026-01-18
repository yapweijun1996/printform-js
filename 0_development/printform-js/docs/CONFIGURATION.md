# PrintForm.js 配置参考

> 自动生成于: 2026-01-18T05:22:21.254Z
> 来源: js/printform/config.js

## 使用说明

所有配置属性都应用在 `.printform` 容器元素上:

```html
<div class="printform"
     data-papersize-width="750"
     data-papersize-height="1050"
     data-repeat-header="y">
  <!-- 内容 -->
</div>
```

## 布尔值格式

布尔类型的配置接受以下值:
- **True**: `y`, `yes`, `true`, `1`
- **False**: `n`, `no`, `false`, `0`

---

## 主要配置


### N-Up 打印

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-n-up` | Number | 1 | 每个物理页面包含的逻辑页面数量 |
| `data-show-logical-page-number` | Boolean | true | 显示逻辑页码 (Page 1 of 3) |
| `data-show-physical-page-number` | Boolean | false | 显示物理页码 (Sheet 1 of 2) |

### 纸张尺寸

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-papersize-width` | Number | 750 | 页面宽度(像素),打印目标应 <= 750px |
| `data-papersize-height` | Number | 1050 | 页面高度(像素) |
| `data-paper-size` | String | "" | 预设纸张大小 (A4, A5, LETTER, LEGAL) |
| `data-orientation` | String | portrait | 纸张方向 |
| `data-dpi` | Number | 96 | DPI 设置,用于从预设纸张大小计算像素尺寸 |

### 虚拟行填充

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-height-of-dummy-row-item` | Number | 18 | 虚拟行项目的高度(像素) |
| `data-fill-page-height-after-footer` | Boolean | true | 页脚之后补齐页面高度 |
| `data-insert-dummy-row-item-while-format-table` | Boolean | true | 插入虚拟行项目填充剩余空间 |
| `data-insert-ptac-dummy-row-items` | Boolean | true | PTAC 页面允许虚拟行项目 |
| `data-insert-dummy-row-while-format-table` | Boolean | false | 插入单个完整高度虚拟表格 |
| `data-insert-footer-spacer-while-format-table` | Boolean | true | 在页脚前插入间隔符 |
| `data-insert-footer-spacer-with-dummy-row-item-while-format-table` | Boolean | true | 使用虚拟行项目填充页脚间隔 |
| `data-custom-dummy-row-item-content` | String | "" | 自定义虚拟行项目 HTML 内容 |

### 调试

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-debug` | Boolean | false | 启用详细控制台日志 |

### 重复元素

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-repeat-header` | Boolean | true | 每页重复 .pheader 头部 |
| `data-repeat-docinfo` | Boolean | true | 每页重复 .pdocinfo 文档信息 |
| `data-repeat-docinfo002` | Boolean | true | 每页重复 .pdocinfo002 文档信息 |
| `data-repeat-docinfo003` | Boolean | true | 每页重复 .pdocinfo003 文档信息 |
| `data-repeat-docinfo004` | Boolean | true | 每页重复 .pdocinfo004 文档信息 |
| `data-repeat-docinfo005` | Boolean | true | 每页重复 .pdocinfo005 文档信息 |
| `data-repeat-rowheader` | Boolean | true | 每页重复 .prowheader 表格行头 |
| `data-repeat-ptac-rowheader` | Boolean | true | PTAC 页面重复 .prowheader 表格行头 |
| `data-repeat-footer` | Boolean | false | 每页重复 .pfooter 页脚 |
| `data-repeat-footer002` | Boolean | false | 每页重复 .pfooter002 页脚 |
| `data-repeat-footer003` | Boolean | false | 每页重复 .pfooter003 页脚 |
| `data-repeat-footer004` | Boolean | false | 每页重复 .pfooter004 页脚 |
| `data-repeat-footer005` | Boolean | false | 每页重复 .pfooter005 页脚 |
| `data-repeat-footer-logo` | Boolean | false | 每页重复 .pfooter_logo 页脚 Logo |
| `data-repeat-footer-pagenum` | Boolean | false | 每页重复 .pfooter_pagenum 页码区域 |

---

## PADDT 配置

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-repeat-paddt` | Boolean | true | 重复 PADDT (保留,暂未使用) |
| `data-insert-paddt-dummy-row-items` | Boolean | true | PADDT 页面允许虚拟行项目 |
| `data-paddt-max-words-per-segment` | Number | 200 | 每个 PADDT 段落的最大单词数 |
| `data-repeat-paddt-rowheader` | Boolean | true | PADDT 页面重复行头 |
| `data-paddt-debug` | Boolean | false | 启用 PADDT 调试日志 |
| `data-repeat-paddt-docinfo` | Boolean | true | PADDT 页面重复 .pdocinfo 文档信息 |
| `data-repeat-paddt-docinfo002` | Boolean | true | PADDT 页面重复 .pdocinfo002 文档信息 |
| `data-repeat-paddt-docinfo003` | Boolean | true | PADDT 页面重复 .pdocinfo003 文档信息 |
| `data-repeat-paddt-docinfo004` | Boolean | true | PADDT 页面重复 .pdocinfo004 文档信息 |
| `data-repeat-paddt-docinfo005` | Boolean | true | PADDT 页面重复 .pdocinfo005 文档信息 |

---

## 使用示例

### 最小配置

```html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">
  <!-- 内容 -->
</div>
```

### 完整配置示例

```html
<div class="printform" 
     data-debug="y"
     data-papersize-width="750" 
     data-papersize-height="1050"
     data-repeat-header="y"
     data-repeat-footer-logo="y"
     data-repeat-footer-pagenum="y">
  <!-- 内容 -->
</div>
```
