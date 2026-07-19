# PrintForm.js 项目概览

> 零依赖的浏览器端 HTML 自动分页脚本

---

## 📌 一句话介绍

**PrintForm.js** 是一个轻量级的纯 JavaScript 库,可以自动将长 HTML 内容分割成适合打印的多个页面,并自动处理页眉、页脚、表格行头重复和页码更新。

---

## 🎯 核心功能

- ✅ **自动分页** - 根据纸张大小自动分割内容
- ✅ **零依赖** - 纯 Vanilla JavaScript,无需任何外部库
- ✅ **智能重复** - 自动重复页眉、页脚、表格行头
- ✅ **页码管理** - 自动更新页码和总页数
- ✅ **虚拟行填充** - 自动填充空白区域,保持页面整齐
- ✅ **N-Up 打印** - 支持多个逻辑页面打印在一个物理页面上
- ✅ **灵活配置** - 通过 `data-*` 属性轻松配置

---

## 🏗️ 项目架构

完整文件结构与各模块职责见 [CODE_STRUCTURE.md](CODE_STRUCTURE.md)(索引)与 [docs/code-structure/FILE_MAP.md](docs/code-structure/FILE_MAP.md)(详细文件树),此处不重复列出,避免两处目录树漂移不一致。

---

## 🔄 工作流程

### 从 HTML 到分页输出

```mermaid
flowchart TD
    subgraph Input [1. HTML 输入]
        HTML[".printform 容器 (包含所有内容)"]
    end

    subgraph Process [2. PrintForm.js 处理流程]
        direction TB
        Config[a. 读取配置 (config.js)]
        Collect[b. 收集区块 (sections.js)]
        Measure[c. 测量高度 (dom.js)]
        Render[d. 分页渲染 (pagination-render.js)]
        Finalize[e. 填充和完成 (pagination-finalize.js)]
        
        Config --> Collect --> Measure --> Render --> Finalize
    end

    subgraph Output [3. 分页输出结果]
        Page1[页面 1]
        Page2[页面 2]
        Page3[页面 3...]
    end

    HTML --> Config
    Finalize --> Output
```

---

## 💡 核心概念

### 1. **容器 (Container)**
- 使用 `.printform` 类标记需要分页的内容
- 通过 `data-*` 属性配置分页行为

### 2. **区块 (Sections)**
PrintForm.js 识别以下区块类型:

| 区块 | CSS 类 | 说明 | 默认重复 |
|------|--------|------|---------|
| 头部 | `.pheader` | 页面顶部内容 | ✅ 每页 |
| 文档信息 | `.pdocinfo` | 文档元数据 | ✅ 每页 |
| 行头 | `.prowheader` | 表格列标题 | ✅ 每页 |
| 数据行 | `.prowitem` | 实际内容行 | ❌ 不重复 |
| PTAC | `.ptac` | 条款段落 | ❌ 不重复 |
| PADDT | `.paddt` | 审计段落 | ❌ 不重复 |
| 页脚 | `.pfooter` | 页面底部内容 | ❌ 仅最后页 |
| 页脚 Logo | `.pfooter_logo` | Logo 区域 | ⚙️ 可配置 |
| 页码 | `.pfooter_pagenum` | 页码区域 | ⚙️ 可配置 |

### 3. **逻辑页 vs 物理页**
- **逻辑页**: 一个完整的分页单元(包含头部、内容、页脚)
- **物理页**: 实际打印的纸张
- **N-Up 打印**: 多个逻辑页可以打印在一个物理页上

### 4. **虚拟行填充 (Dummy Rows)**
- 自动填充页面剩余空间
- 保持页脚位置一致
- 可自定义虚拟行样式

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **JavaScript** | ES6+ | 核心逻辑 |
| **Vite** | 5.4.0 | 构建工具 |
| **无外部依赖** | - | 纯 Vanilla JS |

---

## 🚀 快速开始

快速上手请参阅 [QUICK_START.md](QUICK_START.md)。

---

## 📚 文档导航

| 我想... | 查看文档 |
|---------|---------|
| **快速开始使用** | [QUICK_START.md](QUICK_START.md) |
| **完整使用指南** | [docs/USAGE_GUIDE.zh-CN.md](docs/USAGE_GUIDE.zh-CN.md) |
| **了解代码结构** | [CODE_STRUCTURE.md](CODE_STRUCTURE.md) |
| **查看所有配置** | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| **开发和扩展** | [DEVELOPER_BOOK.md](DEVELOPER_BOOK.md) |
| **了解自动化文档** | [docs/AUTO_DOC_GENERATION_GUIDE.md](docs/AUTO_DOC_GENERATION_GUIDE.md) |
| **可视化调参 / 不写代码试模板** | [studio/index.html](studio/index.html)(设计文档见 [docs/STUDIO_DESIGN.zh-CN.md](docs/STUDIO_DESIGN.zh-CN.md)) |
| **接 ERP / 后端数据绑定** | [docs/ERP_INTEGRATION.zh-CN.md](docs/ERP_INTEGRATION.zh-CN.md) |

---

## 🎯 使用场景

PrintForm.js 适用于:

- ✅ **发票和收据** - 自动分页的发票模板
- ✅ **报表和清单** - 长列表自动分页
- ✅ **合同和协议** - 包含条款的多页文档
- ✅ **打印预览** - 网页内容的打印优化
- ✅ **PDF 生成** - 配合 headless 浏览器生成 PDF

---

## 🔧 核心特性

### 1. 自动分页
```javascript
// 自动根据纸张大小分页
data-papersize-width="750"
data-papersize-height="1050"
```

### 2. 智能重复
```javascript
// 每页自动重复头部和行头
data-repeat-header="y"
data-repeat-rowheader="y"
```

### 3. 页码管理
```html
<!-- 自动显示页码 -->
<span data-page-number></span> of <span data-page-total></span>
```

### 4. N-Up 打印
```javascript
// 2个逻辑页打印在1个物理页上
data-n-up="2"
```

---

## 🤝 参与贡献

欢迎贡献代码、报告问题或提出建议!

- 🐛 [提交 Issue](https://github.com/yapweijun1996/printform-js/issues)
- 💡 [提交 Pull Request](https://github.com/yapweijun1996/printform-js/pulls)

---

## 📄 许可证

[查看 LICENSE 文件]

---

## 🙏 致谢

感谢所有贡献者和使用者!

---

**最后更新:** 2026-01-16  
**版本:** 0.0.0
