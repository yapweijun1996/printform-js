# 📚 文档维护指南

> 如何保持 PrintForm.js 文档的更新和同步

---

## 📋 文档清单

### 核心文档 (7个)

| 文档 | 用途 | 更新方式 | 更新频率 |
|------|------|---------|---------|
| **README.md** | 项目首页 + 导航 | 手动 | 低 (重大变更) |
| **README.zh-CN.md** | 中文版首页 | 手动 | 低 (跟随英文版) |
| **PROJECT_OVERVIEW.md** | 项目概览 | 手动 | 低 (架构变更) |
| **QUICK_START.md** | 快速上手指南 | 手动 | 低 (使用方式变更) |
| **CODE_STRUCTURE.md** | 代码结构说明 | 手动 | 中 (文件结构变更) |
| **DEVELOPER_BOOK.md** | 开发者手册 | 手动 | 中 (开发流程变更) |
| **docs/CONFIGURATION.md** | 配置参考 | **自动** | - (运行脚本) |

### 可选文档 (2个)

| 文档 | 用途 | 更新方式 |
|------|------|---------|
| **AGENTS.md** | AI 助手指南 | 手动 (内部使用) |
| **docs/AUTO_DOC_GENERATION_GUIDE.md** | 自动化文档说明 | 手动 (按需) |

---

## 🔄 自动更新的文档

### 运行命令

```bash
npm run docs
```

### 会自动更新

- ✅ `docs/CONFIGURATION.md` - Markdown 格式
- ✅ `docs/configuration.html` - HTML 格式
- ✅ `docs/config-reference.json` - JSON 格式

### 更新时机

**必须运行 `npm run docs` 的情况:**
- 在 `config.js` 中添加新配置
- 修改配置的默认值
- 修改配置的说明
- 修改配置的类型

### 自动化选项

如果想在构建时自动更新文档,在 `package.json` 添加:

```json
{
  "scripts": {
    "prebuild": "npm run docs",
    "build": "..."
  }
}
```

这样每次运行 `npm run build` 时会自动先运行 `npm run docs`。

---

## ✏️ 手动维护的文档

### 更新检查清单

#### 添加新配置时

- [ ] 在 `config.js` 的 `CONFIG_DESCRIPTORS` 添加配置项
- [ ] 运行 `npm run docs` 更新配置文档
- [ ] 检查 `docs/CONFIGURATION.md` 是否正确生成

#### 添加新功能时

- [ ] 更新 `README.md` 的功能列表
- [ ] 更新 `PROJECT_OVERVIEW.md` 的核心功能
- [ ] 如果影响使用方式,更新 `QUICK_START.md`

#### 修改文件结构时

- [ ] 更新 `CODE_STRUCTURE.md` 的目录结构图
- [ ] 更新文件说明
- [ ] 更新数据流图(如果需要)

#### 修改开发流程时

- [ ] 更新 `DEVELOPER_BOOK.md`
- [ ] 更新相关的工作流程说明

#### 架构变更时

- [ ] 更新 `PROJECT_OVERVIEW.md` 的架构图
- [ ] 更新 `CODE_STRUCTURE.md` 的模块依赖关系
- [ ] 更新 `DEVELOPER_BOOK.md` 的相关部分

---

## 📝 文档编写规范

### 1. 文件命名

- 使用 `UPPER_SNAKE_CASE.md` (例如: `QUICK_START.md`)
- 描述性名称,清楚表达内容

### 2. 文档结构

每个文档应包含:

```markdown
# 标题

> 简短描述

---

## 主要内容

...

---

**最后更新:** YYYY-MM-DD
```

### 3. 内部链接

使用相对路径:

```markdown
[Project Overview](PROJECT_OVERVIEW.md)
[Configuration](docs/CONFIGURATION.md)
```

### 4. 代码示例

使用代码块并指定语言:

````markdown
```javascript
// JavaScript 代码
```

```bash
# Shell 命令
```

```html
<!-- HTML 代码 -->
```
````

### 5. 更新日期

在文档末尾标注最后更新日期:

```markdown
**最后更新:** 2026-01-16
```

---

## 🔍 文档审查

### 定期检查 (每次重大更新)

- [ ] 所有链接是否有效
- [ ] 代码示例是否仍然正确
- [ ] 配置说明是否与代码同步
- [ ] 截图/图表是否需要更新

### 删除过时内容

- 删除不再使用的功能说明
- 删除过时的示例
- 更新版本号和日期

---

## 🚀 快速参考

### 常见任务

| 任务 | 命令/操作 |
|------|----------|
| 更新配置文档 | `npm run docs` |
| 添加新文档 | 创建 `.md` 文件,添加到 README 导航 |
| 检查文档 | 手动审查,检查链接 |
| 构建项目 | `npm run build` |

### 文档位置

```
printform-js/
├── README.md                    # 项目首页
├── PROJECT_OVERVIEW.md          # 项目概览
├── QUICK_START.md               # 快速上手
├── CODE_STRUCTURE.md            # 代码结构
├── DEVELOPER_BOOK.md            # 开发者手册
└── docs/
    ├── CONFIGURATION.md         # 配置参考 (自动生成)
    ├── configuration.html       # 配置参考 HTML
    ├── config-reference.json    # 配置参考 JSON
    └── AUTO_DOC_GENERATION_GUIDE.md  # 自动化说明
```

---

## ❓ 常见问题

### Q: 为什么 `npm run build` 不更新文档?

**A:** 默认情况下,`build` 只构建代码。如果想自动更新文档,需要添加 `prebuild` 脚本。

### Q: 如何知道哪些文档需要更新?

**A:** 参考上面的"更新检查清单"。一般来说:
- 代码变更 → 检查相关文档
- 添加功能 → 更新 README 和 OVERVIEW
- 修改配置 → 运行 `npm run docs`

### Q: 文档太多了怎么办?

**A:** 当前文档数量是合理的(9个)。如果觉得太多:
- 核心文档不要删除(7个)
- 可选文档可以移到 `docs/` 目录
- 临时文档应该及时删除

### Q: 如何确保文档同步?

**A:** 
1. 修改代码时立即更新相关文档
2. 提交代码前检查文档
3. 定期审查所有文档

---

## 📚 相关资源

- [AUTO_DOC_GENERATION_GUIDE.md](AUTO_DOC_GENERATION_GUIDE.md) - 自动化文档生成说明
- [scripts/generate-config-docs.js](../scripts/generate-config-docs.js) - 文档生成脚本

---

**最后更新:** 2026-01-16
