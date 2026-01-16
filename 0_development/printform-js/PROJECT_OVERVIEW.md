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

### 文件结构

```
printform-js/
│
├── js/                          # 源代码目录
│   ├── printform.js             # 📍 入口文件,公共 API
│   └── printform/               # 核心模块
│       ├── config.js            # 📍 配置定义和读取
│       ├── dom.js               # DOM 操作辅助函数
│       ├── helpers.js           # 通用辅助函数
│       ├── text.js              # 文本处理
│       └── formatter/           # 分页格式化核心
│           ├── PrintFormFormatter.js  # 📍 主格式化类
│           ├── pages.js         # 页面管理
│           ├── sections.js      # 区块收集
│           ├── row-types.js     # 行类型处理
│           ├── rendering.js     # 渲染逻辑
│           ├── pagination-render.js    # 分页渲染
│           ├── pagination-finalize.js  # 分页完成
│           ├── segments-ptac.js # PTAC 段落处理
│           └── segments-paddt.js # PADDT 段落处理
│
├── scripts/                     # 构建和工具脚本
│   ├── generate-config-docs.js  # 📍 自动生成配置文档
│   ├── run-vite.js              # Vite 运行脚本
│   └── postbuild-generate-preview.js  # 构建后处理
│
├── docs/                        # 文档目录
│   ├── CONFIGURATION.md         # 配置参考(自动生成)
│   ├── configuration.html       # 配置参考 HTML 版
│   └── config-reference.json    # 配置参考 JSON 版
│
├── dist/                        # 构建输出目录
│   └── printform.js             # 📍 打包后的单文件库
│
├── index*.html                  # 测试和演示文件
├── example.html                 # 基础示例
│
├── README.md                    # 项目说明
├── DEVELOPER_BOOK.md            # 开发者手册
├── QUICK_START.md               # 快速上手指南
└── CODE_STRUCTURE.md            # 代码结构说明
```

---

## 🔄 工作流程

### 从 HTML 到分页输出

```
┌─────────────────────────────────────────────────────────────┐
│  1. HTML 输入                                                │
│  <div class="printform" data-papersize-width="750">         │
│    <div class="pheader">头部</div>                          │
│    <div class="prowitem">行1</div>                          │
│    <div class="prowitem">行2</div>                          │
│    ...                                                       │
│  </div>                                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  2. PrintForm.js 处理                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ a. 读取配置 (config.js)                              │   │
│  │    - 纸张大小: 750x1050                              │   │
│  │    - 重复设置: 头部、页脚等                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ b. 收集区块 (sections.js)                            │   │
│  │    - 头部 (.pheader)                                 │   │
│  │    - 文档信息 (.pdocinfo)                            │   │
│  │    - 行头 (.prowheader)                              │   │
│  │    - 数据行 (.prowitem)                              │   │
│  │    - 页脚 (.pfooter)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ c. 测量高度 (dom.js)                                 │   │
│  │    - 计算每个区块的高度                              │   │
│  │    - 计算可用页面高度                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ d. 分页渲染 (pagination-render.js)                   │   │
│  │    - 逐行添加内容                                    │   │
│  │    - 检查是否超出页面                                │   │
│  │    - 创建新页面                                      │   │
│  │    - 重复头部和行头                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ e. 填充和完成 (pagination-finalize.js)               │   │
│  │    - 插入虚拟行填充空白                              │   │
│  │    - 添加页脚                                        │   │
│  │    - 更新页码                                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  3. 分页输出                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │ 页面 1          │  │ 页面 2          │  │ 页面 3       ││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌──────────┐││
│  │ │ 头部        │ │  │ │ 头部        │ │  │ │ 头部     │││
│  │ │ 文档信息    │ │  │ │ 文档信息    │ │  │ │ 文档信息 │││
│  │ │ 行头        │ │  │ │ 行头        │ │  │ │ 行头     │││
│  │ │ 行1         │ │  │ │ 行5         │ │  │ │ 行9      │││
│  │ │ 行2         │ │  │ │ 行6         │ │  │ │ 行10     │││
│  │ │ 行3         │ │  │ │ 行7         │ │  │ │ [虚拟行] │││
│  │ │ 行4         │ │  │ │ 行8         │ │  │ │ [虚拟行] │││
│  │ │ 页脚        │ │  │ │ 页脚        │ │  │ │ 页脚     │││
│  │ │ 页码: 1/3   │ │  │ │ 页码: 2/3   │ │  │ │ 页码: 3/3│││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └──────────┘││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
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
| **ESLint** | - | 代码检查 |
| **无外部依赖** | - | 纯 Vanilla JS |

---

## 🚀 5分钟快速开始

### 步骤 1: 创建 HTML 文件

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PrintForm 示例</title>
</head>
<body>
  <!-- 分页容器 -->
  <div class="printform" 
       data-papersize-width="750" 
       data-papersize-height="1050">
    
    <!-- 头部 -->
    <div class="pheader">
      <h1>我的文档</h1>
    </div>
    
    <!-- 行头 -->
    <div class="prowheader">
      <table>
        <tr>
          <th>项目</th>
          <th>数量</th>
        </tr>
      </table>
    </div>
    
    <!-- 数据行 -->
    <div class="prowitem">
      <table>
        <tr>
          <td>商品 A</td>
          <td>10</td>
        </tr>
      </table>
    </div>
    
    <!-- 更多数据行... -->
    
    <!-- 页脚 -->
    <div class="pfooter">
      <p>感谢您的购买</p>
    </div>
  </div>
  
  <!-- 引入 PrintForm.js -->
  <script src="./dist/printform.js"></script>
</body>
</html>
```

### 步骤 2: 打开浏览器查看

```bash
# 启动本地服务器
python3 -m http.server 8000

# 或使用 npm
npm run dev
```

### 步骤 3: 打印预览

按 `Ctrl+P` (或 `Cmd+P`) 查看分页效果!

---

## 📚 文档导航

| 我想... | 查看文档 |
|---------|---------|
| **快速开始使用** | [QUICK_START.md](QUICK_START.md) |
| **了解代码结构** | [CODE_STRUCTURE.md](CODE_STRUCTURE.md) |
| **查看所有配置** | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| **开发和扩展** | [DEVELOPER_BOOK.md](DEVELOPER_BOOK.md) |
| **查看所有属性** | [DATA_ATTRIBUTES_REVIEW.md](DATA_ATTRIBUTES_REVIEW.md) |
| **了解自动化文档** | [docs/AUTO_DOC_GENERATION_GUIDE.md](docs/AUTO_DOC_GENERATION_GUIDE.md) |

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

- 📖 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与
- 🐛 [提交 Issue](https://github.com/your-repo/issues)
- 💡 [提交 Pull Request](https://github.com/your-repo/pulls)

---

## 📄 许可证

[查看 LICENSE 文件]

---

## 🙏 致谢

感谢所有贡献者和使用者!

---

**最后更新:** 2026-01-16  
**版本:** 0.0.0
