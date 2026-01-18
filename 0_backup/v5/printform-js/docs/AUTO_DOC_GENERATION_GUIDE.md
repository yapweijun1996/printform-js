# 自动化文档生成脚本说明

## 什么是"自动化文档生成脚本"?

**简单来说:**
自动化文档生成脚本是一个程序,它可以从源代码(如 `config.js`)中读取配置信息,然后自动生成各种格式的文档(Markdown、HTML、JSON 等)。

## 为什么需要它?

### 当前问题 ❌

1. **文档分散**
   - 配置说明分散在多个 HTML 文件中
   - 每个文件都有重复的配置注释
   - 例如:`index.html`, `index001.html`, `index002.html` 等都有相同的配置说明

2. **难以维护**
   - 当添加新配置时,需要手动更新所有文件
   - 容易遗漏某些文件
   - 不同文件中的说明可能不一致

3. **容易出错**
   - 手动复制粘贴容易出错
   - 配置说明可能与实际代码不同步

### 解决方案 ✅

**单一数据源 → 自动生成文档**

```
config.js (源代码)
    ↓
generate-config-docs.js (脚本)
    ↓
├── docs/CONFIGURATION.md (Markdown)
├── docs/configuration.html (HTML)
└── docs/config-reference.json (JSON)
```

## 工作原理

### 1. 读取配置定义

脚本从 `config.js` 读取所有配置项:

```javascript
const CONFIG_DESCRIPTORS = [
  { 
    key: "papersizeWidth", 
    htmlAttr: "data-papersize-width",
    type: "Number",
    defaultValue: 750, 
    description: "页面宽度(像素)"
  },
  // ... 更多配置
];
```

### 2. 生成多种格式

**Markdown 格式** (用于 GitHub、文档网站)
```markdown
| HTML 属性 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| `data-papersize-width` | Number | 750 | 页面宽度(像素) |
```

**HTML 格式** (用于浏览器查看)
```html
<table>
  <tr>
    <td><code>data-papersize-width</code></td>
    <td>Number</td>
    <td>750</td>
    <td>页面宽度(像素)</td>
  </tr>
</table>
```

**JSON 格式** (用于其他工具、API)
```json
{
  "htmlAttr": "data-papersize-width",
  "type": "Number",
  "defaultValue": 750,
  "description": "页面宽度(像素)"
}
```

## 如何使用

### 步骤 1: 运行脚本

```bash
# 在项目根目录执行
node scripts/generate-config-docs.js
```

### 步骤 2: 查看生成的文档

脚本会自动创建以下文件:

```
docs/
├── CONFIGURATION.md          # Markdown 格式,可在 GitHub 查看
├── configuration.html        # HTML 格式,可在浏览器打开
└── config-reference.json     # JSON 格式,供其他工具使用
```

### 步骤 3: 在 HTML 中引用

不再需要在每个 HTML 文件中重复配置说明,只需添加链接:

```html
<!-- 旧方式 ❌ -->
<!--
    data-papersize-width="750"   : Page width in pixels
    data-papersize-height="1050" : Page height in pixels
    ... (100+ 行重复的注释)
-->

<!-- 新方式 ✅ -->
<!-- 配置说明请参考: docs/CONFIGURATION.md -->
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">
```

## 实际应用场景

### 场景 1: 添加新配置

**旧方式 (手动):**
1. 在 `config.js` 添加新配置 ✏️
2. 在 `index.html` 添加说明 ✏️
3. 在 `index001.html` 添加说明 ✏️
4. 在 `index002.html` 添加说明 ✏️
5. ... (重复 10+ 次)

**新方式 (自动):**
1. 在 `config.js` 添加新配置 ✏️
2. 运行 `node scripts/generate-config-docs.js` 🚀
3. 完成! ✅

### 场景 2: 更新配置说明

**旧方式:**
- 需要找到所有包含该配置的文件
- 逐个修改
- 容易遗漏

**新方式:**
- 只在 `config.js` 修改一次
- 运行脚本
- 所有文档自动更新

### 场景 3: 生成 API 文档

JSON 格式可以被其他工具使用:

```javascript
// 在配置生成器工具中使用
const configRef = require('./docs/config-reference.json');

// 自动生成配置表单
configRef.mainConfig.forEach(config => {
  createFormField(config.htmlAttr, config.type, config.defaultValue);
});
```

## 集成到构建流程

### 在 package.json 中添加脚本

```json
{
  "scripts": {
    "docs": "node scripts/generate-config-docs.js",
    "docs:watch": "nodemon --watch js/printform/config.js --exec npm run docs",
    "prebuild": "npm run docs"
  }
}
```

### 使用方法

```bash
# 手动生成文档
npm run docs

# 监听配置文件变化,自动生成
npm run docs:watch

# 构建前自动生成文档
npm run build
```

## 优势总结

| 方面 | 手动维护 | 自动生成 |
|------|---------|---------|
| **维护成本** | 高 (需要更新多个文件) | 低 (只需更新源代码) |
| **一致性** | 难以保证 | 始终一致 |
| **出错率** | 高 | 低 |
| **多格式支持** | 需要手动创建 | 自动生成 |
| **可扩展性** | 困难 | 容易 |

## 扩展可能

这个脚本可以进一步扩展:

1. **生成 TypeScript 类型定义**
   ```typescript
   interface PrintFormConfig {
     papersizeWidth: number;
     papersizeHeight: number;
     // ...
   }
   ```

2. **生成配置验证器**
   ```javascript
   function validateConfig(config) {
     // 自动生成的验证逻辑
   }
   ```

3. **生成交互式配置生成器**
   - 网页表单
   - 实时预览
   - 导出配置代码

4. **生成多语言文档**
   - 英文版
   - 中文版
   - 其他语言

## 总结

**自动化文档生成脚本 = 提高效率 + 减少错误 + 保持一致性**

它让你:
- ✅ 只需维护一份源代码
- ✅ 自动生成多种格式的文档
- ✅ 确保文档始终与代码同步
- ✅ 节省大量时间和精力

这就是"创建自动化文档生成脚本"的含义! 🎉
