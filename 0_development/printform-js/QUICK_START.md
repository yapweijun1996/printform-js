# 🚀 PrintForm.js 快速上手指南

> 5 分钟内让你的第一个分页文档跑起来!

---

## 📋 前置要求

- ✅ 任何现代浏览器 (Chrome, Firefox, Safari, Edge)
- ✅ 基础的 HTML 知识
- ✅ (可选) Node.js 和 npm

---

## ⚡ 方法一:最快速开始 (无需安装)

### 步骤 1: 下载文件

下载 `dist/printform.js` 文件到你的项目目录

### 步骤 2: 创建 HTML 文件

创建 `my-first-page.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>我的第一个分页文档</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    .paper_width { width: 750px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <!-- 分页容器 -->
  <div class="printform paper_width" 
       data-papersize-width="750" 
       data-papersize-height="1050"
       data-repeat-header="y"
       data-repeat-rowheader="y"
       data-repeat-footer-pagenum="y">
    
    <!-- 头部 -->
    <div class="pheader">
      <h1>销售报表</h1>
      <p>日期: 2026-01-16</p>
    </div>
    
    <!-- 表格行头 -->
    <div class="prowheader">
      <table>
        <tr>
          <th>产品名称</th>
          <th>数量</th>
          <th>单价</th>
          <th>金额</th>
        </tr>
      </table>
    </div>
    
    <!-- 数据行 (复制这个区块来添加更多行) -->
    <div class="prowitem">
      <table>
        <tr>
          <td>产品 A</td>
          <td>10</td>
          <td>¥100.00</td>
          <td>¥1,000.00</td>
        </tr>
      </table>
    </div>
    
    <div class="prowitem">
      <table>
        <tr>
          <td>产品 B</td>
          <td>5</td>
          <td>¥200.00</td>
          <td>¥1,000.00</td>
        </tr>
      </table>
    </div>
    
    <!-- 添加更多 prowitem 来测试分页... -->
    
    <!-- 页脚页码 -->
    <div class="pfooter_pagenum">
      <table>
        <tr>
          <td style="text-align: center;">
            第 <span data-page-number></span> 页，共 <span data-page-total></span> 页
          </td>
        </tr>
      </table>
    </div>
  </div>
  
  <!-- 引入 PrintForm.js -->
  <script src="./dist/printform.js"></script>
</body>
</html>
```

### 步骤 3: 启动本地服务器

```bash
# 使用 Python (推荐)
python3 -m http.server 8000

# 或使用 Python 2
python -m SimpleHTTPServer 8000
```

### 步骤 4: 在浏览器中查看

打开浏览器访问: `http://localhost:8000/my-first-page.html`

### 步骤 5: 查看打印预览

按 `Ctrl+P` (Windows/Linux) 或 `Cmd+P` (Mac) 查看分页效果!

---

## 🛠️ 方法二:使用项目源码 (完整开发环境)

### 步骤 1: 克隆项目

```bash
git clone https://github.com/your-username/printform-js.git
cd printform-js/0_development/printform-js
```

### 步骤 2: 安装依赖

```bash
npm install
```

### 步骤 3: 启动开发服务器

```bash
npm run dev
```

### 步骤 4: 查看示例

浏览器会自动打开,或手动访问:
- `http://localhost:8000/index.html` - 完整演示
- `http://localhost:8000/example.html` - 基础示例

### 步骤 5: 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/printform.js`

---

## 📝 基础示例详解

### 最小配置

```html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">
  
  <div class="pheader">头部内容</div>
  <div class="prowitem">数据行 1</div>
  <div class="prowitem">数据行 2</div>
  <div class="pfooter">页脚内容</div>
  
</div>
<script src="./dist/printform.js"></script>
```

### 关键元素说明

| 元素 | CSS 类 | 说明 |
|------|--------|------|
| 容器 | `.printform` | 必需,标记需要分页的内容 |
| 头部 | `.pheader` | 可选,每页顶部重复的内容 |
| 行头 | `.prowheader` | 可选,表格列标题,每页重复 |
| 数据行 | `.prowitem` | 必需,实际内容,自动分页 |
| 页脚 | `.pfooter` | 可选,默认只在最后一页显示 |
| 页码 | `.pfooter_pagenum` | 可选,显示页码 |

---

## ⚙️ 常用配置

### 1. 纸张大小

```html
<!-- A4 纸张 (默认) -->
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">

<!-- 或使用预设 -->
<div class="printform" 
     data-paper-size="A4" 
     data-orientation="portrait">
```

### 2. 重复元素

```html
<!-- 每页重复头部和行头 -->
<div class="printform" 
     data-repeat-header="y" 
     data-repeat-rowheader="y">
```

### 3. 页码显示

```html
<!-- 在页脚中添加 -->
<div class="pfooter_pagenum">
  第 <span data-page-number></span> 页，共 <span data-page-total></span> 页
</div>

<!-- 配置每页显示页码 -->
<div class="printform" 
     data-repeat-footer-pagenum="y">
```

### 4. 调试模式

```html
<!-- 启用详细日志 -->
<div class="printform" data-debug="y">
```

---

## 🎨 自定义样式

### 添加样式

```html
<style>
  /* 容器宽度 */
  .paper_width {
    width: 750px;
    margin: 0 auto;
  }
  
  /* 表格样式 */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
  }
  
  /* 头部样式 */
  .pheader {
    background-color: #f8f9fa;
    padding: 20px;
  }
  
  /* 页脚样式 */
  .pfooter {
    text-align: center;
    padding: 10px;
    color: #666;
  }
</style>
```

---

## 🧪 测试分页

### 添加多行数据

复制 `.prowitem` 区块来测试分页:

```html
<!-- 复制这个区块 20-30 次来测试分页 -->
<div class="prowitem">
  <table>
    <tr>
      <td>产品名称</td>
      <td>数量</td>
      <td>单价</td>
    </tr>
  </table>
</div>
```

### 查看分页效果

1. 在浏览器中打开页面
2. 按 `Ctrl+P` 或 `Cmd+P`
3. 在打印预览中查看分页效果
4. 检查:
   - ✅ 头部是否在每页重复
   - ✅ 行头是否在每页重复
   - ✅ 页码是否正确
   - ✅ 内容是否正确分页

---

## 💡 常见问题

### Q1: 为什么需要本地服务器?

**A:** 浏览器的安全限制不允许直接打开本地 HTML 文件加载 JavaScript。使用本地服务器可以避免这个问题。

### Q2: 内容被截断了怎么办?

**A:** 检查单个 `.prowitem` 的高度是否超过了页面高度。PrintForm.js 不会分割单个 `.prowitem`。

### Q3: 如何隐藏第一页的头部?

**A:** 使用 CSS:
```css
.printform_page_1 .pheader {
  display: none;
}
```

### Q4: 打印时边距不对?

**A:** 在打印对话框中:
1. 启用"背景图形"
2. 设置边距为"无"或"最小"

---

## 📚 下一步学习

### 基础使用
- ✅ 你已经完成了! 🎉
- 📖 查看 [README.md](README.md) 了解更多功能

### 进阶配置
- 📖 查看 [docs/CONFIGURATION.md](docs/CONFIGURATION.md) 了解所有配置选项
- 📖 查看 [DATA_ATTRIBUTES_REVIEW.md](DATA_ATTRIBUTES_REVIEW.md) 了解所有属性

### 开发和扩展
- 📖 查看 [DEVELOPER_BOOK.md](DEVELOPER_BOOK.md) 了解开发指南
- 📖 查看 [CODE_STRUCTURE.md](CODE_STRUCTURE.md) 了解代码结构

---

## 🎯 完整示例

### 发票模板示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>发票</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    .paper_width { width: 750px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .pheader { text-align: center; padding: 20px; }
    .pfooter { text-align: center; padding: 10px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="printform paper_width" 
       data-papersize-width="750" 
       data-papersize-height="1050"
       data-repeat-header="y"
       data-repeat-rowheader="y"
       data-repeat-footer-pagenum="y"
       data-height-of-dummy-row-item="26">
    
    <!-- 头部 -->
    <div class="pheader">
      <h1>销售发票</h1>
      <p>发票号: INV-2026-001 | 日期: 2026-01-16</p>
    </div>
    
    <!-- 客户信息 -->
    <div class="pdocinfo">
      <table>
        <tr>
          <td><strong>客户:</strong> ABC 公司</td>
          <td><strong>地址:</strong> 北京市朝阳区</td>
        </tr>
      </table>
    </div>
    
    <!-- 表格行头 -->
    <div class="prowheader">
      <table>
        <tr>
          <th style="width: 50%;">产品描述</th>
          <th style="width: 15%;">数量</th>
          <th style="width: 15%;">单价</th>
          <th style="width: 20%;">金额</th>
        </tr>
      </table>
    </div>
    
    <!-- 数据行 -->
    <div class="prowitem">
      <table>
        <tr>
          <td>高级咖啡豆 - 哥伦比亚产</td>
          <td style="text-align: right;">10 kg</td>
          <td style="text-align: right;">¥200.00</td>
          <td style="text-align: right;">¥2,000.00</td>
        </tr>
      </table>
    </div>
    
    <div class="prowitem">
      <table>
        <tr>
          <td>咖啡机 - 专业型</td>
          <td style="text-align: right;">2 台</td>
          <td style="text-align: right;">¥5,000.00</td>
          <td style="text-align: right;">¥10,000.00</td>
        </tr>
      </table>
    </div>
    
    <!-- 添加更多行来测试分页... -->
    
    <!-- 页脚 -->
    <div class="pfooter">
      <p>感谢您的购买! | 联系电话: 123-456-7890</p>
    </div>
    
    <!-- 页码 -->
    <div class="pfooter_pagenum">
      <table>
        <tr>
          <td style="text-align: center;">
            第 <span data-page-number></span> 页，共 <span data-page-total></span> 页
          </td>
        </tr>
      </table>
    </div>
    
    <!-- 自定义虚拟行模板 -->
    <template class="custom-dummy-row-item-content">
      <tr style="height: 26px;">
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
      </tr>
    </template>
  </div>
  
  <script src="./dist/printform.js"></script>
</body>
</html>
```

---

## ✅ 检查清单

完成快速上手后,你应该能够:

- [ ] 创建基本的分页 HTML 文档
- [ ] 配置纸张大小
- [ ] 添加头部、行头和页脚
- [ ] 查看打印预览
- [ ] 理解 `.printform`、`.pheader`、`.prowitem` 等类的作用
- [ ] 使用 `data-*` 属性配置行为

---

## 🎉 恭喜!

你已经掌握了 PrintForm.js 的基础使用!

**下一步:**
- 📖 探索更多配置选项
- 🎨 自定义样式
- 🚀 构建你的第一个项目

有问题? 查看 [FAQ.md](FAQ.md) 或提交 Issue!

---

**最后更新:** 2026-01-16
