# 🚀 PrintForm.js 快速上手指南（精简版）

> 想要 5 分钟内跑通？按下面步骤即可。更完整的示例与 FAQ 请看后面的链接。

---

## ✅ 前置要求

- 任意现代浏览器（Chrome/Firefox/Safari/Edge）
- 基础 HTML 知识
- 可选：Python 或 Node.js

---

## ⚡ 最快开始（直接使用 dist/printform.js）

### 步骤 1: 准备 HTML

```html
<div class="printform"
     data-papersize-width="750"
     data-papersize-height="1050">
  <div class="pheader">标题</div>
  <div class="prowheader">表头</div>
  <div class="prowitem">内容行 1</div>
  <div class="prowitem">内容行 2</div>
  <div class="pfooter_pagenum">
    第 <span data-page-number></span> 页，共 <span data-page-total></span> 页
  </div>
</div>
<script src="./dist/printform.js"></script>
```

### 步骤 2: 启动本地服务器

```bash
python3 -m http.server 8000
# 或
npm install
npm run dev
```

### 步骤 3: 预览

打开浏览器访问：
- `http://localhost:8000/index.html`（完整演示）
- `http://localhost:8000/index001.html`（基础结构）

---

## 📚 深入阅读

- 基础步骤与环境说明: `docs/quick-start/01-basic-setup.md`
- 完整发票示例: `docs/quick-start/02-full-example.md`
- FAQ + 检查清单: `docs/quick-start/03-faq.md`
- 完整使用指南: `docs/USAGE_GUIDE.zh-CN.md`
- 全量配置参考: `docs/CONFIGURATION.md`
