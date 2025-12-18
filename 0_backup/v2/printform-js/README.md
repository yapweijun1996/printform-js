# PrintForm.js

零依赖（Vanilla JS）的浏览器端分页排版脚本：把一个 `.printform` 容器拆成多页输出，支持重复页眉/表头/页脚、PTAC 段落拆分、PADDT 独立分页，以及页码占位更新。

## 快速开始

1) 启动本地静态服务器（推荐，避免浏览器对本地文件的限制）：

```bash
python3 -m http.server 8000
```

或使用 Vite dev server：

```bash
npm run dev
```

2) 打开示例页：
- `http://localhost:8000/index.html`
- `http://localhost:8000/example.html`

## 使用方式

在页面中准备一个 `.printform` 容器，并按约定放入区块（如 `.pheader`、`.pdocinfo*`、`.prowheader`、`.prowitem`、`.ptac`、`.pfooter*` 等）。

生成并使用单文件产物：

```bash
npm run build
```

需要预览生产构建时可用：

```bash
npm run preview
```

在页面末尾引入：

```html
<script src="./dist/printform.js"></script>
```

默认会在 `DOMContentLoaded` 后自动执行一次分页处理。

## API

对外接口挂在 `window.PrintForm`：

- `PrintForm.formatAll(overrides?)`：格式化页面内所有 `.printform`。
- `PrintForm.format(formEl, overrides?)`：只格式化一个指定节点。

## 配置（data-*）

通过 `.printform` 节点上的 `data-*` 覆盖默认值；默认值定义在 `js/printform/config.js`，同时暴露为 `window.PrintForm.DEFAULT_CONFIG` 与 `window.PrintForm.DEFAULT_PADDT_CONFIG` 便于查阅。

纸张尺寸（混合策略，向后兼容）：
- 最高优先级：手动像素 `data-papersize-width` / `data-papersize-height`（或 legacy 全局变量 `papersize_width` / `papersize_height`）
- 次优先级：预设 `data-paper-size="A4|A5|Letter|Legal"`（可配合 `data-orientation="portrait|landscape"`、`data-dpi="96"`）
- 回退：默认值 `papersizeWidth=750`、`papersizeHeight=1050`

常用新增参数：
- `data-n-up="2"`：开启 N-up（一个物理页内排多个“逻辑页”，默认 `1`）。
- `data-show-logical-page-number="y|n"`：是否填充逻辑页码（`data-page-number` / `data-page-total`）。
- `data-show-physical-page-number="y|n"`：是否填充物理页码（`data-physical-page-number` / `data-physical-page-total`）。

各参数说明可以直接参考示例页 `index.html` 顶部的注释块（包含 PTAC / PADDT 相关开关）。

## 开发说明

更多维护细节见 `DEVELOPER_BOOK.md`。
