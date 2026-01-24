# PrintForm.js

[English](./README.md) | [简体中文](./README.zh-CN.md)

**PrintForm.js** 是一个轻量级（零依赖 Vanilla JS）的浏览器端分页排版脚本。

它的核心作用是：**把一个长 HTML 容器（`.printform`）自动拆分成多个符合打印纸张大小的页面**。它会自动处理页眉、页脚、表头重复、页码更新以及空白行填充（Dummy Rows）。

## 📚 文档导航

- 项目概览: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- 快速上手: [QUICK_START.md](QUICK_START.md)
- 完整使用指南: [docs/USAGE_GUIDE.zh-CN.md](docs/USAGE_GUIDE.zh-CN.md)
- 配置参考: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- 代码结构: [CODE_STRUCTURE.md](CODE_STRUCTURE.md)

## 核心逻辑图解 (Logic Diagram)

为了帮助理解 `printform.js` 是如何工作的，请参考下方的流程图：
请查看：`docs/LOGIC_DIAGRAM.zh-CN.md`。

---

## 快速开始 (Quick Start)

### 1. 启动项目
你需要一个静态服务器来预览效果（避免浏览器跨域限制）。

```bash
# 方式 A: 使用 Python (推荐)
python3 -m http.server 8000

# 方式 B: 使用 Node/Vite
npm install
npm run dev
```

### 2. 预览
打开浏览器访问：
- `http://localhost:8000/index.html` (完整功能演示)
- `http://localhost:8000/index001.html` (基础结构演示)

---

## 如何使用 (How to Use)

使用 PrintForm 不需要复杂的构建工具，只需要遵循特定的 **HTML 结构约定**。

### Mobile（iOS/Android）渲染注意事项

部分移动端浏览器会自动调整字体大小（text autosizing）或允许用户缩放，导致布局测量发生变化，进而影响分页结果。为了保证渲染一致性，建议在页面加入：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
</style>
```

如果你需要保留双指缩放（可访问性考虑），可移除 `maximum-scale=1, user-scalable=no`，但请保留 `text-size-adjust`。

### 1. 基础结构
在页面中创建一个 `class="printform"` 的 `div`，并配置纸张大小。

```html
<!-- 容器：定义纸张大小 (例如 A4 宽 750px 高 1050px) -->
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">

    <!-- 1. 页眉 (每页顶部重复) -->
    <div class="pheader">...</div>

    <!-- 2. 文档信息 (默认每页重复，可按配置关闭) -->
    <div class="pdocinfo">...</div>

    <!-- 3. 表头 (表格列名，跨页时重复显示) -->
    <div class="prowheader">...</div>

    <!-- 4. 数据行 (核心内容，会自动拆分) -->
    <div class="prowitem">行 1</div>
    <div class="prowitem">行 2</div>
    <div class="prowitem">行 3...</div>

    <!-- 5. 页脚 (默认只在最后一页，可配置重复) -->
    <div class="pfooter">...</div>
    
</div>

<!-- 引入脚本 -->
<script src="./dist/printform.js"></script>
```

### 2. 关键 Class 说明

| Class | 说明 | 默认行为 |
| :--- | :--- | :--- |
| `.printform` | **根容器** | 脚本只处理这个容器内的内容。 |
| `.pheader` | **页眉** | 默认**每页重复**。 |
| `.pdocinfo` | **文档信息** | 通常用于发票抬头信息，默认**每页重复** (可关)。 |
| `.prowheader` | **表头** | 表格的列标题，默认**每页重复**。 |
| `.prowitem` | **数据行** | 这是**最小拆分单位**。脚本不会拆分一个 `.prowitem` 内部的内容，而是按行进行分页判断。 |
| `.pfooter` | **页脚** | 默认**只在最后一页** (可通过配置改为每页重复)。 |
| `.ptac` | **条款/长文本** | 用于不需要对齐的法律条款或长文本，会自动按段落拆分。 |
| `.paddt` | **审计/附加段落** | PADDT 段落，分页在所有主内容之后。 |

---

## 配置参数 (Configuration)

你可以直接在 `.printform` 元素上使用 `data-*` 属性来控制行为。

### 常用配置

| 属性 (Data Attribute) | 值示例 | 说明 |
| :--- | :--- | :--- |
| `data-papersize-width` | `750` | 纸张宽度 (px)。 |
| `data-papersize-height` | `1050` | 纸张高度 (px)。 |
| `data-paper-size` | `A4` | 预设纸张大小（A4/A5/LETTER/LEGAL）。 |
| `data-dpi` | `96` | 用于纸张预设换算像素的 DPI。 |
| `data-orientation` | `portrait` / `landscape` | 纸张方向：纵向 / 横向。 |
| `data-repeat-header` | `y` / `n` | 是否每页重复页眉 (默认 `y`)。 |
| `data-repeat-footer` | `y` / `n` | 是否每页重复页脚 (默认 `n`)。 |
| `data-show-logical-page-number`| `y` / `n` | 是否显示页码 (如 "Page 1 of 3")。 |
| `data-show-physical-page-number`| `y` / `n` | 是否显示物理页码 (N-up 时)。 |
| `data-n-up` | `1` / `2` | **N-Up 打印**：一张纸打印几页逻辑页 (例如设为 2 可实现双联单)。 |

### 行与页脚控制

| 属性 (Data Attribute) | 值示例 | 说明 |
| :--- | :--- | :--- |
| `data-height-of-dummy-row-item` | `26` | 空白行 item 的高度，用于填充剩余空间。 |
| `data-repeat-docinfo` | `y` / `n` | 是否重复 `.pdocinfo`。 |
| `data-repeat-docinfo002` | `y` / `n` | 是否重复 `.pdocinfo002`。 |
| `data-repeat-docinfo003` | `y` / `n` | 是否重复 `.pdocinfo003`。 |
| `data-repeat-docinfo004` | `y` / `n` | 是否重复 `.pdocinfo004`。 |
| `data-repeat-docinfo005` | `y` / `n` | 是否重复 `.pdocinfo005`。 |
| `data-repeat-rowheader` | `y` / `n` | 是否重复 `.prowheader`。 |
| `data-repeat-ptac-rowheader` | `y` / `n` | PTAC 页面是否重复 `.prowheader`。 |
| `data-repeat-footer` | `y` / `n` | 是否每页重复 `.pfooter`（最终页会包含所有页脚）。 |
| `data-repeat-footer002` | `y` / `n` | 是否每页重复 `.pfooter002`。 |
| `data-repeat-footer003` | `y` / `n` | 是否每页重复 `.pfooter003`。 |
| `data-repeat-footer004` | `y` / `n` | 是否每页重复 `.pfooter004`。 |
| `data-repeat-footer005` | `y` / `n` | 是否每页重复 `.pfooter005`。 |
| `data-repeat-footer-logo` | `y` / `n` | 是否每页重复 `.pfooter_logo`。 |
| `data-repeat-footer-pagenum` | `y` / `n` | 是否每页重复 `.pfooter_pagenum`。 |
| `data-insert-dummy-row-item-while-format-table` | `y` / `n` | 是否插入空白行 item 来填充高度。 |
| `data-insert-ptac-dummy-row-items` | `y` / `n` | PTAC 页面是否插入空白行 item。 |
| `data-insert-dummy-row-while-format-table` | `y` / `n` | 是否插入单个空白行块来填充剩余空间。 |
| `data-insert-footer-spacer-while-format-table` | `y` / `n` | 是否插入页脚 spacer 将页脚顶到底部。 |
| `data-insert-footer-spacer-with-dummy-row-item-while-format-table` | `y` / `n` | 是否用空白行 item 作为 footer spacer。 |
| `data-custom-dummy-row-item-content` | HTML | 自定义空白行的 HTML（或使用 `<template class="custom-dummy-row-item-content">`）。 |
| `data-div-page-break-before-class-append` | `pagebreak_bf_processed` | 给生成的 `div_page_break_before` 追加 class。 |

### PADDT 控制

| 属性 (Data Attribute) | 值示例 | 说明 |
| :--- | :--- | :--- |
| `data-repeat-paddt` | `y` / `n` | PADDT 复用开关（当前保留未使用）。 |
| `data-repeat-paddt-rowheader` | `y` / `n` | PADDT 页面是否重复 `.prowheader`。 |
| `data-insert-paddt-dummy-row-items` | `y` / `n` | PADDT 页面是否插入空白行 item。 |
| `data-paddt-max-words-per-segment` | `180` | PADDT 段落拆分的单段最大词数。 |
| `data-paddt-debug` | `y` / `n` | 是否开启 PADDT 调试日志。 |
| `data-repeat-paddt-docinfo` | `y` / `n` | PADDT 页面是否重复 `.pdocinfo`。 |
| `data-repeat-paddt-docinfo002` | `y` / `n` | PADDT 页面是否重复 `.pdocinfo002`。 |
| `data-repeat-paddt-docinfo003` | `y` / `n` | PADDT 页面是否重复 `.pdocinfo003`。 |
| `data-repeat-paddt-docinfo004` | `y` / `n` | PADDT 页面是否重复 `.pdocinfo004`。 |
| `data-repeat-paddt-docinfo005` | `y` / `n` | PADDT 页面是否重复 `.pdocinfo005`。 |

### 示例
```html
<div class="printform"
     data-papersize-width="800"
     data-papersize-height="1100"
     data-repeat-footer="y"
     data-show-logical-page-number="y">
     ...
</div>
```

---

## 高级功能

### 1. 空白行填充 (Dummy Rows)
如果一页的内容没填满，PrintForm 会自动插入空白行来撑开高度，使页脚始终位于页面底部。
- 你可以自定义空白行的样式：
```html
<template class="custom-dummy-row-item-content">
  <tr style="height:20px;"><td style="border:0;">...</td></tr>
</template>
```

### 2. 强制分页与行头控制

- 强制分页：在行上添加 `tb_page_break_before`。
- 隐藏某页 `.prowheader`：在起始行添加 `without_prowheader` 或 `tb_without_rowheader`。

### 3. JS API 调用
脚本加载后会自动执行。如果你是动态生成的内容（如 AJAX 加载后），需要手动触发格式化：

```javascript
// 格式化页面上所有 .printform
await PrintForm.formatAll({ force: true });

// 或者只格式化特定节点
const myForm = document.querySelector('#invoice-1');
PrintForm.format(myForm);
```

注意：
- `formatAll` 默认只执行一次，重复执行请传 `force: true`。
- 格式化会移除原始 `.printform`，插入处理后的容器。

### 4. 构建生产版本
如果你修改了源码 (`js/` 目录)，需要重新打包：

```bash
npm run build
```
产物位于 `dist/printform.js`。

---

## 常见问题 (FAQ)

**Q: 为什么页面内容被截断了？**
A: 检查 `.prowitem` 的高度是否超过了 `data-papersize-height` 减去页眉页脚后的可用空间。如果单行内容太高，它无法被放入任何一页。

**Q: 如何隐藏第一页的页眉？**
A: 目前逻辑倾向于保持一致性。如果需要特殊处理，建议用外层选择器做 CSS 控制，或在数据准备阶段拆分 DOM。

**Q: 打印时边距不对？**
A: 打印机的物理边距受浏览器和打印驱动控制。建议在打印对话框中勾选 "背景图形" (Background graphics) 并将边距设为 "无" 或 "最小"。

---

## 目录结构

- `js/printform.js` - 入口文件
- `js/printform/formatter/` - **核心逻辑** (分页计算都在这里)
- `js/printform/config.js` - 配置项定义
- `js/printform/dom.js` - DOM 操作辅助函数
- `index.html` - 完整测试用例
