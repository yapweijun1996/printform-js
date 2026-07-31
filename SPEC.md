# SPEC.md — PrintForm.js 行为规格

> 全部条目为 **Current**（代码已实现并有测试或人工验证）。Target 行为不写入本文，见[工程路线图](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)。
>
> 最后核对：2026-07-31（对齐待提交的 CI/E2E 扩展批次）。配置全表以 `npm run docs` 生成的 [docs/CONFIGURATION.md](docs/CONFIGURATION.md) 为准。

---

## 1. 核心引擎规格

### 1.1 输入契约

- 分页目标：`.printform` 容器（同页可有多个，依次处理，其间自动插分页符）。
- 区块 class：`pheader`、`pdocinfo`~`pdocinfo005`、`prowheader`、`prowitem`（含 `prowitem_subtotal`/`prowitem_footer`）、`ptac`、`paddt`、`pfooter`~`pfooter005`、`pfooter_logo`、`pfooter_pagenum`。
- 配置来源优先级：JS overrides > `data-*` 属性 > 旧全局变量（`papersize_width` 等）> 默认值。
- 页码占位：`[data-page-number]`/`[data-page-total]`（逻辑页）、`[data-physical-page-number]`/`[data-physical-page-total]`（物理页）；无占位时自动附加 "Page N of M" 兜底。

### 1.2 行为规则

| 规则 | 说明 |
|---|---|
| 自动执行 | 脚本加载时若文档已就绪立即排版，否则等 `load` + 延迟（移动端 150ms / 桌面 50ms） |
| 防重入 | 二次调用 `formatAll()` 无操作，除非 `{ force: true }` |
| 行级换页 | `tb_page_break_before` 强制该行前换页；PTAC/PADDT 长文切分出的克隆段**不继承**该 class |
| 小计+页脚组合 | `prowitem_subtotal` 后紧跟 `prowitem_footer` 时按组合高度整体测试，放不下整组下移 |
| 行头跳过 | `without_prowheader`/`tb_without_rowheader` 行级豁免；PTAC/PADDT 有独立 `repeat_*_rowheader` 开关 |
| PADDT 后置 | PADDT 行在全部常规页脚之后另起物理页渲染，仅带 logo 与页码页脚，docinfo 按 `repeat_paddt_docinfo*` 过滤 |
| 纸张预设 | `data-paper-size`（A4/A5/LETTER/LEGAL）+ `data-orientation` + `data-dpi` 可代替手工宽高；手工值优先 |
| 长文切分 | PTAC/PADDT 段落按 `*_max_words_per_segment`（默认 200 词）切成多段 |

### 1.3 交付物

- `dist/printform.js` — 单文件 IIFE，零依赖，挂 `window.PrintForm`。
- 兼容旧 ERP DOM：区块 class、`data-*`、处理后 `*_processed` class 均不变（P2 重构的硬约束）。

---

## 2. Studio v1 规格（冻结）

- 模板源 [studio/templates.json](studio/templates.json)；支持导入外部 HTML。
- 数据绑定：mustache-lite 子集 `{{field}}`、`{{{raw}}}`、`{{#section}}`、`{{^inverted}}`、点路径；**不支持** partials/lambdas/注释/自定义分隔符。
- 转义集：`& < > " ' ` `` 6 字符；不配对/错配 section 抛错并显示在渲染错误区。
- 结构模式：加载**原始模板**（占位符可见），区块索引与编辑目标一一对应；行数滑块在 `blocks-ready` 前禁用。
- 导出三种：配置化 HTML（内联 printform.js）、数据绑定包（`PrintFormTemplate.render(data)`）、打印预览（无 bridge）。
- 消息安全：只接受 `event.origin === location.origin` 的 bridge 消息。

---

## 3. Studio v2 规格（Production Pilot）

### 3.1 协议 2.0.0 单 HTML 结构

一个自包含 HTML，按固定 id 携带全部区块（详见[协议文档](docs/PRINTFORM_V2_PROTOCOL.zh-CN.md)）：
`pf-manifest`（JSON）、`pf-schema`（JSON Schema 受限子集）、`pf-i18n`、`pf-theme`（style）、`pf-template`（template 元素，JSON Pointer 声明式绑定）、`pf-sample-data`、`pf-attestation`、`pf-document-runtime`、`pf-printform-runtime`。宿主 API：`PrintFormDocument.validate(data)` / `.render(data, options)`。

### 3.2 信任规则

- Trusted 条件：可执行 script 仅限两段白名单 runtime，且 attestation 的 runtime/content hash 全部匹配。
- 任何自定义 script、模板 `<script`、主题 `</style`/`<script` → 降级 `Untrusted`；untrusted 时 Agent 写命令被网关拒绝（`UNTRUSTED_READ_ONLY`）、打印预览拒绝、生产导出被 `UNTRUSTED_SCRIPT` 阻断。
- 「重置信任」= 剥离可执行内容 + 重置 flag；validateProject 独立重扫内容（`EXECUTABLE_MARKUP_PRESENT`）。
- CSP：trusted 导出用双 runtime sha256 hash；untrusted / 预览用 `unsafe-inline` 变体；`manifest.assets.allowExternalHttps` 在所有变体中同步打开 `img-src/font-src https:`。

### 3.3 命令契约（Agent Contract 1.1.0）

- 15 个工具见 [studio-v2/core/tool-contracts.js](studio-v2/core/tool-contracts.js)；全部经 `CommandBus.execute` 返回统一 `{ok, result|error{code,…}}`（含网关层 JSON 解析失败 `INVALID_INPUT_JSON`）。
- 写命令必须带 `expectedRevision`；revision 单调递增、undo 不复用；过期写入返回 `REVISION_CONFLICT`。
- 无实际变化的写命令（locale / asset / **sample scenario** 重复选择）不产生新 revision，不清空已通过的布局审查。
- `set_manifest_value` 的 JSON 路径拒绝原型成员段（`INVALID_OPERATION_PATH`）。
- 布局审查：`begin_layout_review`（每 revision 最多 3 次，需先有 ready 渲染报告）→ `complete_layout_review`（提交 findings/evidence，major/critical open 阻断）；任何 mutation 使审查与渲染报告失效。
- 生产导出 readiness = 静态验证 + 当前 revision 渲染报告 ready + 布局审查通过；最终下载永远需要工程师点击。

### 3.4 渲染报告与错误路径

- 报告：`{ status: ready|blocked|superseded, validation, binding, metrics, issues[] }`。
- `issues[]` 元素：`{ code: HORIZONTAL_OVERFLOW|VERTICAL_OVERFLOW|CONTRAST_FAILURE, pageIndex, selector, rect{x,y,width,height}, text? }`，每类 ≤20 条。
- 错误 `path` 段前缀约定：`/manifest`、`/schema`、`/i18n`、`/theme`、`/template`、`/sampleData`、`/trust`、`/review`；UI 据前缀路由到编辑器（可点击跳转），布局类错误路径为 `/`。
- 预览消息仅当 `event.source === 预览 iframe.contentWindow` 时受理。
- 预览面板提供「Highlight issues」开关（默认开）：iframe 内 bridge 收到 `printform:rendered` 后用 `issues[].selector` 在当前文档实时定位并画红框；父页通过 `{ source: "printform-studio-v2-command", type: "toggle-overlay" }` 指令切换，指令同样只信任 `event.source === window.parent`，切换不触发重渲染。

### 3.5 PWA

- 部署版缓存优先（cache name 含 build id，构建时盖章，占位符缺失即构建失败）；本地开发网络优先。
- 导航请求忽略查询串匹配缓存，离线兜底 `index.html`；页面加载时已有 waiting worker 也会显示升级横幅。
- UI 五语言（en-MY 默认，静态打包；其余动态加载，失败回退英文，不阻断启动）。

---

## 4. 质量门（CI / 本地）

| 检查 | 命令 | 当前状态 |
|---|---|---|
| 单元测试（136 个，36 文件） | `npm test -- --run` | 必须全绿 |
| 语法检查产物 | `npm run check` | 构建后 |
| E2E（Playwright，18 条：首页 1、核心库直渲染 3、v1 结构模式 2、v2 深度场景 12） | `npm run test:e2e` | 本地/CI，三引擎（Chromium/Firefox/WebKit） |
| v2 导出校验 | `npm run validate:v2 -- <file>` | 未签名报 `ATTESTATION_MISSING`，签名后 hash 全验 |
| 站点构建 | `npm run build:site` | 含两个已签名试点导出 |
