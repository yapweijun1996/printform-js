# 📁 PrintForm.js 代码结构说明（索引）

> 本文件提供代码结构的总览与导航，细节拆分到 `docs/code-structure/`。

---

## 🗂️ 顶层结构一览

```
printform-js/
├── js/                     # 源代码
├── docs/                   # 文档
├── scripts/                # 构建与工具脚本
├── dist/                   # 构建输出
├── index*.html             # 演示与测试页面
├── README.md               # 英文说明
├── README.zh-CN.md          # 中文说明
├── QUICK_START.md           # 快速上手（精简版）
└── PROJECT_OVERVIEW.md      # 项目概览
```

---

## 🎯 关键入口

- `js/printform.js` - 公共 API 与自动初始化
- `js/printform/config.js` - 配置项定义与合并逻辑
- `js/printform/formatter/` - 分页格式化核心
- `scripts/` - 构建与文档生成脚本

---

## 🔍 深入阅读

- 文件角色与职责: `docs/code-structure/FILE_MAP.md`
- 分页数据流与流程: `docs/code-structure/PIPELINE.md`

