# 自动更新的文件说明

## 📝 当运行 `npm run docs` 时,会自动更新这些文件:

### ✅ 自动生成/更新的文件 (3个)

#### 1. `docs/CONFIGURATION.md`
**格式:** Markdown  
**用途:** GitHub、文档网站、开发者阅读  
**内容示例:**
```markdown
## 纸张尺寸

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-papersize-width` | Number | 750 | 页面宽度(像素) |
| `data-papersize-height` | Number | 1050 | 页面高度(像素) |
```

---

#### 2. `docs/configuration.html`
**格式:** HTML  
**用途:** 在浏览器中查看,带样式的可视化文档  
**特点:**
- 美观的表格样式
- 按类别分组
- 可搜索(浏览器内置搜索)
- 可打印

**打开方式:**
```bash
# macOS
open docs/configuration.html

# Windows
start docs/configuration.html

# Linux
xdg-open docs/configuration.html
```

---

#### 3. `docs/config-reference.json`
**格式:** JSON  
**用途:** 供其他工具、脚本、API 使用  
**内容示例:**
```json
{
  "generatedAt": "2026-01-16T14:35:53.000Z",
  "version": "1.0",
  "mainConfig": [
    {
      "key": "papersizeWidth",
      "htmlAttr": "data-papersize-width",
      "type": "Number",
      "defaultValue": 750,
      "category": "纸张尺寸",
      "description": "页面宽度(像素)"
    }
  ]
}
```

**可以用来:**
- 生成配置表单
- 验证用户输入
- 创建 API 文档
- 集成到其他工具

---

## 🔄 更新流程演示

### 场景:添加新配置

#### 步骤 1: 修改源代码
在 `js/printform/config.js` 添加新配置:
```javascript
// 在 CONFIG_DESCRIPTORS 数组中添加
{
  key: "maxPages",
  datasetKey: "maxPages",
  htmlAttr: "data-max-pages",
  type: "Number",
  defaultValue: 100,
  category: "限制",
  description: "最大页数限制"
}
```

#### 步骤 2: 运行脚本
```bash
npm run docs
```

#### 步骤 3: 自动更新
脚本会自动更新这 3 个文件:

**`docs/CONFIGURATION.md` 会新增:**
```markdown
### 限制

| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-max-pages` | Number | 100 | 最大页数限制 |
```

**`docs/configuration.html` 会新增:**
```html
<h3>限制</h3>
<table>
  <tr>
    <td><code>data-max-pages</code></td>
    <td>Number</td>
    <td>100</td>
    <td>最大页数限制</td>
  </tr>
</table>
```

**`docs/config-reference.json` 会新增:**
```json
{
  "key": "maxPages",
  "htmlAttr": "data-max-pages",
  "type": "Number",
  "defaultValue": 100,
  "category": "限制",
  "description": "最大页数限制"
}
```

---

## ❌ 不会自动更新的文件

这些文件是手动创建的说明文档,不会被脚本覆盖:

1. **`docs/AUTO_DOC_GENERATION_GUIDE.md`**  
   - 说明什么是自动化文档生成
   - 手动维护

2. **`docs/AUTO_DOC_DEMO_SUMMARY.md`**  
   - 演示总结
   - 手动维护

3. **`DATA_ATTRIBUTES_REVIEW.md`**  
   - 完整的属性审查报告
   - 手动维护

---

## 📊 文件关系图

```
源代码 (手动维护)
    ↓
js/printform/config.js
    ↓
    ↓ [npm run docs]
    ↓
自动生成的文档 (自动更新)
    ↓
    ├── docs/CONFIGURATION.md      ← 自动更新
    ├── docs/configuration.html    ← 自动更新
    └── docs/config-reference.json ← 自动更新

说明文档 (手动维护)
    ├── docs/AUTO_DOC_GENERATION_GUIDE.md  ← 不会自动更新
    ├── docs/AUTO_DOC_DEMO_SUMMARY.md      ← 不会自动更新
    └── DATA_ATTRIBUTES_REVIEW.md          ← 不会自动更新
```

---

## 🎯 实际使用场景

### 场景 1: 修改配置默认值

**修改前:**
```javascript
// config.js
{ key: "papersizeWidth", defaultValue: 750 }
```

**修改后:**
```javascript
// config.js
{ key: "papersizeWidth", defaultValue: 800 }
```

**运行:**
```bash
npm run docs
```

**结果:**
- ✅ `CONFIGURATION.md` 中的默认值从 750 → 800
- ✅ `configuration.html` 中的默认值从 750 → 800
- ✅ `config-reference.json` 中的默认值从 750 → 800

---

### 场景 2: 修改配置说明

**修改前:**
```javascript
description: "页面宽度(像素)"
```

**修改后:**
```javascript
description: "页面宽度(像素),建议不超过 800px"
```

**运行:**
```bash
npm run docs
```

**结果:**
- ✅ 所有 3 个文档中的说明都会更新

---

### 场景 3: 添加新类别

**添加:**
```javascript
{
  key: "enableCache",
  category: "性能优化",  // 新类别
  description: "启用缓存"
}
```

**运行:**
```bash
npm run docs
```

**结果:**
- ✅ 文档中会自动创建新的"性能优化"分类
- ✅ 新配置会出现在该分类下

---

## 💡 关键点总结

### ✅ 会自动更新 (3个文件)
1. `docs/CONFIGURATION.md`
2. `docs/configuration.html`
3. `docs/config-reference.json`

### ❌ 不会自动更新 (手动维护)
- 所有其他 `.md` 文件
- README.md
- DEVELOPER_BOOK.md
- 等等...

### 🔑 核心原则
**单一数据源 → 自动生成 → 多种输出**

只需维护 `config.js`,其他文档自动同步! 🎉

---

## 📝 查看更新

运行 `npm run docs` 后,你可以:

```bash
# 查看 Markdown
cat docs/CONFIGURATION.md

# 在浏览器中查看 HTML
open docs/configuration.html

# 查看 JSON
cat docs/config-reference.json

# 或在 VS Code 中打开
code docs/CONFIGURATION.md
code docs/configuration.html
code docs/config-reference.json
```

---

**总结:** 只有这 3 个文件会自动更新,它们都是从 `config.js` 生成的配置文档! 🚀
