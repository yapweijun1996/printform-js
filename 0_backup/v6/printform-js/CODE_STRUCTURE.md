# 📁 PrintForm.js 代码结构说明

> 理解项目的文件组织和代码架构

---

## 🗂️ 目录结构总览

```
printform-js/
│
├── 📂 js/                      # 源代码目录
│   ├── 📄 printform.js         # 入口文件 (123 行)
│   ├── 📄 vite-entry.js        # Vite 入口 (3 行)
│   └── 📂 printform/           # 核心模块目录
│       ├── 📄 config.js        # 配置系统 (262 行)
│       ├── 📄 dom.js           # DOM 操作 (227 行)
│       ├── 📄 helpers.js       # 辅助函数 (167 行)
│       ├── 📄 text.js          # 文本处理 (48 行)
│       ├── 📄 formatter.js     # 格式化器导出 (2 行)
│       └── 📂 formatter/       # 格式化核心目录
│           ├── 📄 PrintFormFormatter.js    # 主类 (149 行)
│           ├── 📄 pages.js                 # 页面管理 (63 行)
│           ├── 📄 sections.js              # 区块收集 (89 行)
│           ├── 📄 row-types.js             # 行类型 (72 行)
│           ├── 📄 rendering.js             # 渲染逻辑 (121 行)
│           ├── 📄 pagination-render.js     # 分页渲染 (222 行)
│           ├── 📄 pagination-finalize.js   # 分页完成 (151 行)
│           ├── 📄 segments-ptac.js         # PTAC 处理 (93 行)
│           └── 📄 segments-paddt.js        # PADDT 处理 (95 行)
│
├── 📂 scripts/                 # 构建和工具脚本
│   ├── 📄 generate-config-docs.js      # 文档生成脚本
│   ├── 📄 run-vite.js                  # Vite 运行脚本
│   └── 📄 postbuild-generate-preview.js # 构建后处理
│
├── 📂 docs/                    # 文档目录
│   ├── 📄 CONFIGURATION.md             # 配置参考 (自动生成)
│   ├── 📄 configuration.html           # 配置参考 HTML
│   ├── 📄 config-reference.json        # 配置参考 JSON
│   ├── 📄 AUTO_DOC_GENERATION_GUIDE.md # 文档生成说明
│   └── 📄 MAINTAINING_DOCS.md          # 文档维护指南
│
├── 📂 dist/                    # 构建输出目录
│   ├── 📄 printform.js         # 打包后的库文件
│   ├── 📄 index.html           # 预览页面
│   └── 📂 img/                 # 图片资源
│
├── 📂 img/                     # 源图片资源
│
├── 📄 index.html               # 主演示文件 (997 行)
├── 📄 index001.html - index016.html  # 测试文件
├── 📄 example.html             # 基础示例
├── 📄 multiple_page_preview.html     # 多页预览
│
├── 📄 package.json             # 项目配置
├── 📄 vite.config.js           # Vite 配置
│
├── 📄 README.md                # 项目说明
├── 📄 README.zh-CN.md          # 中文说明
├── 📄 DEVELOPER_BOOK.md        # 开发者手册
├── 📄 PROJECT_OVERVIEW.md      # 项目概览
├── 📄 QUICK_START.md           # 快速上手
├── 📄 CODE_STRUCTURE.md        # 本文件
├── 📄 DATA_ATTRIBUTES_REVIEW.md # 属性审查
├── 📄 AGENTS.md                # AI 助手指南
└── 📄 DOCUMENTATION_IMPROVEMENT_PLAN.md  # 文档改进计划
```

---

## 🎯 核心文件详解

### 1. **入口文件** (`js/printform.js`)

**职责:** 公共 API 和自动初始化

**关键函数:**
```javascript
// 格式化所有 .printform 元素
formatAllPrintForms(overrides)

// 格式化单个元素
formatSinglePrintForm(formEl, overrides)
```

**导出:**
```javascript
export default {
  formatAll: formatAllPrintForms,
  format: formatSinglePrintForm,
  DEFAULT_CONFIG,
  DEFAULT_PADDT_CONFIG
}
```

**自动执行:**
```javascript
// DOMContentLoaded 时自动格式化所有 .printform
document.addEventListener("DOMContentLoaded", () => {
  formatAllPrintForms();
});
```

---

### 2. **配置系统** (`js/printform/config.js`)

**职责:** 配置定义、读取和合并

**核心数据结构:**
```javascript
// 主配置描述符 (27 个配置项)
export const CONFIG_DESCRIPTORS = [
  {
    key: "papersizeWidth",           // 内部键名
    datasetKey: "papersizeWidth",    // dataset 键名
    legacyKey: "papersize_width",    // 旧版全局变量名
    htmlAttr: "data-papersize-width", // HTML 属性名
    defaultValue: 750,                // 默认值
    parser: parseNumber               // 解析函数
  },
  // ...
];

// PADDT 配置描述符 (10 个配置项)
export const PADDT_CONFIG_DESCRIPTORS = [
  // ...
];
```

**关键函数:**
```javascript
// 获取主配置
getPrintformConfig(formEl, overrides)

// 获取 PADDT 配置
getPaddtConfig(formEl, overrides)
```

**配置优先级:**
```
默认值 < Legacy 全局变量 < Dataset 属性 < 函数参数
```

---

### 3. **DOM 操作** (`js/printform/dom.js`)

**职责:** DOM 创建、测量和操作

**关键函数:**
```javascript
// 创建虚拟行
createDummyRowTable(config, height)
createDummyRowItemTable(config)

// 添加虚拟行
appendDummyRowItems(config, target, diffHeight)

// 测量高度
measureHeight(element)

// 创建分页符
createPageBreakDivider(extraClassNames)

// 添加克隆
appendClone(target, element, logFn, label)
```

---

### 4. **辅助函数** (`js/printform/helpers.js`)

**职责:** 通用工具函数

**关键函数:**
```javascript
// 解析布尔值
parseBooleanFlag(value, fallback)

// 解析数字
parseNumber(value, fallback)

// 解析字符串
parseString(value, fallback)

// 解析纸张尺寸
resolvePaperDimensions(options)

// 标准化高度
normalizeHeight(value)

// 更新页码
updatePageNumberContent(element, pageNumber, totalPages)
updatePhysicalPageNumberContent(element, pageNumber, totalPages)
```

---

### 5. **主格式化类** (`js/printform/formatter/PrintFormFormatter.js`)

**职责:** 协调整个分页流程

**类结构:**
```javascript
class PrintFormFormatter {
  constructor(formEl, config) {
    this.formEl = formEl;
    this.config = config;
    this.debug = Boolean(config.debug);
    this.nUp = Math.max(1, Math.floor(Number(config.nUp || 1)));
    // ...
  }

  format() {
    // 1. 初始化输出容器
    const container = this.initializeOutputContainer();
    
    // 2. 收集区块
    const sections = this.collectSections();
    
    // 3. 测量高度
    const heights = this.measureSections(sections);
    
    // 4. 计算页脚状态和可用高度
    const footerState = this.computeFooterState(sections, heights);
    const heightPerPage = this.computeHeightPerPage(sections, heights);
    
    // 5. 渲染行
    const renderState = this.renderRows(...);
    
    // 6. 完成文档
    this.finalizeDocument(...);
    
    // 7. 处理 PADDT (如果有)
    if (this.paddtRows && this.paddtRows.length) {
      // ...
    }
    
    // 8. 更新页码
    this.updatePageNumberTotals();
    
    return container;
  }
}
```

**方法来源:**
- `attachPageMethods()` - 页面管理方法
- `attachSectionMethods()` - 区块收集方法
- `attachRowTypeMethods()` - 行类型方法
- `attachRenderingMethods()` - 渲染方法
- `attachPaginationRenderMethods()` - 分页渲染方法
- `attachPaginationFinalizeMethods()` - 分页完成方法
- `attachPaddtSegmentMethods()` - PADDT 方法
- `attachPtacSegmentMethods()` - PTAC 方法

---

## 🔄 数据流图

### 完整处理流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 输入: HTML                                                │
│    <div class="printform" data-papersize-width="750">       │
│      <div class="pheader">...</div>                         │
│      <div class="prowitem">...</div>                        │
│    </div>                                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. printform.js (入口)                                       │
│    formatAllPrintForms()                                     │
│    └─> formatSinglePrintForm(formEl, overrides)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. config.js (配置)                                          │
│    getPrintformConfig(formEl, overrides)                     │
│    └─> 合并: 默认值 + Legacy + Dataset + Overrides          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PrintFormFormatter (主类)                                 │
│    new PrintFormFormatter(formEl, config)                    │
│    formatter.format()                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. sections.js (收集区块)                                    │
│    collectSections()                                         │
│    └─> 返回: { header, docInfos, rowHeader, rows, ... }     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. dom.js (测量高度)                                         │
│    measureSections(sections)                                 │
│    └─> 返回: { header: 100, rowHeader: 50, ... }            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. rendering.js (计算布局)                                   │
│    computeFooterState(sections, heights)                     │
│    computeHeightPerPage(sections, heights)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. pagination-render.js (渲染分页)                           │
│    renderRows(container, sections, heights, ...)             │
│    └─> 逐行添加,检查高度,创建新页                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. pagination-finalize.js (完成)                             │
│    finalizeDocument(container, sections, ...)                │
│    └─> 填充虚拟行,添加页脚,更新页码                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. 输出: 分页后的 HTML                                      │
│     <div class="printform_formatter">                        │
│       <div class="printform_page_1">...</div>                │
│       <div class="printform_page_2">...</div>                │
│     </div>                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 模块依赖关系

```
printform.js (入口)
    │
    ├─> config.js (配置系统)
    │   └─> helpers.js (解析函数)
    │
    ├─> dom.js (DOM 操作)
    │   └─> helpers.js (normalizeHeight)
    │
    └─> PrintFormFormatter (主类)
        │
        ├─> pages.js (页面管理)
        │   └─> dom.js
        │
        ├─> sections.js (区块收集)
        │   └─> config.js (DOCINFO_VARIANTS, FOOTER_VARIANTS)
        │
        ├─> row-types.js (行类型)
        │
        ├─> rendering.js (渲染逻辑)
        │   ├─> dom.js
        │   └─> helpers.js
        │
        ├─> pagination-render.js (分页渲染)
        │   └─> dom.js
        │
        ├─> pagination-finalize.js (分页完成)
        │   └─> dom.js
        │
        ├─> segments-ptac.js (PTAC 处理)
        │   └─> text.js
        │
        └─> segments-paddt.js (PADDT 处理)
            └─> text.js
```

---

## 🎨 设计模式

### 1. **模块化设计**
- 每个文件职责单一
- 通过 ES6 模块导入导出
- 符合 300 行代码规则

### 2. **Mixin 模式**
```javascript
// PrintFormFormatter 使用 mixin 扩展方法
attachPageMethods(PrintFormFormatter);
attachSectionMethods(PrintFormFormatter);
// ...
```

### 3. **配置驱动**
- 所有行为通过配置控制
- 配置可以来自多个来源
- 优先级清晰

### 4. **函数式编程**
- 纯函数优先
- 避免副作用
- 便于测试

---

## 🔧 扩展点

### 1. 添加新配置

**步骤:**
1. 在 `config.js` 的 `CONFIG_DESCRIPTORS` 添加配置项
2. 在相应的格式化模块中使用配置
3. 运行 `npm run docs` 更新文档

**示例:**
```javascript
// config.js
{
  key: "maxPages",
  datasetKey: "maxPages",
  htmlAttr: "data-max-pages",
  type: "Number",
  defaultValue: 100,
  parser: parseNumber
}

// PrintFormFormatter.js
if (this.config.maxPages && this.currentPage > this.config.maxPages) {
  // 停止分页
}
```

### 2. 添加新区块类型

**步骤:**
1. 在 `sections.js` 的 `collectSections()` 中添加收集逻辑
2. 在 `rendering.js` 中添加渲染逻辑
3. 更新文档

### 3. 自定义分页逻辑

**步骤:**
1. 在 `pagination-render.js` 修改 `renderRows()`
2. 或创建新的渲染模块
3. 在 `PrintFormFormatter.js` 中使用

---

## 📝 代码规范

### 1. 文件大小
- ✅ 每个文件不超过 300 行
- ✅ 超过时拆分成多个文件

### 2. 命名规范
- 文件名: `kebab-case.js`
- 类名: `PascalCase`
- 函数名: `camelCase`
- 常量: `UPPER_SNAKE_CASE`

### 3. 注释规范
```javascript
/**
 * 函数说明
 * @param {Type} paramName - 参数说明
 * @returns {Type} 返回值说明
 */
function myFunction(paramName) {
  // 实现
}
```

### 4. ESLint
```bash
npx eslint js/printform.js js/printform/**/*.js
```

---

## 🧪 测试文件

### HTML 测试文件组织

| 文件 | 用途 | 行数 |
|------|------|------|
| `example.html` | 基础示例 | 简单 |
| `index.html` | 完整演示 | 997 |
| `index001.html` - `index016.html` | 特定功能测试 | 各异 |
| `multiple_page_preview.html` | 多页预览 | 4,970 |

---

## 🚀 构建流程

### 开发模式
```bash
npm run dev
# 启动 Vite 开发服务器
# 支持热更新
```

### 生产构建
```bash
npm run build
# 1. 运行 Vite 构建
# 2. 生成 dist/printform.js
# 3. 运行 postbuild-generate-preview.js
# 4. 生成预览页面
```

### 文档生成
```bash
npm run docs
# 运行 generate-config-docs.js
# 生成配置文档
```

---

## 📚 相关文档

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - 项目概览
- [QUICK_START.md](QUICK_START.md) - 快速上手
- [DEVELOPER_BOOK.md](DEVELOPER_BOOK.md) - 开发者手册
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) - 配置参考

---

**最后更新:** 2026-01-16
