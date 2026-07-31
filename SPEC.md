# SPEC.md — PrintForm.js 行为规格

> 全部条目为 **Current**（代码已实现并有测试或人工验证）。Target 行为不写入本文，见[工程路线图](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)。
>
> 最后核对：2026-07-31（对齐 `5d06702`）。配置全表以 `npm run docs` 生成的 [docs/CONFIGURATION.md](docs/CONFIGURATION.md) 为准。

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

- Trusted 条件：可执行 script 仅限两段白名单 runtime，且 attestation 的 hash 全部匹配——`runtimeHash`（document runtime）、`printformRuntimeHash`（分页引擎）、`contentHash`。两段 runtime 用不同错误码区分（`RUNTIME_HASH_MISMATCH` / `PRINTFORM_RUNTIME_HASH_MISMATCH`），因为"换掉分页引擎"和"换掉文档运行时"是两种不同的篡改。
- attestation 另存 `cspScriptHashes`（导出 CSP 中 `script-src` 允许的两个 sha256）与 `browsers`——后者只列出本会话真正签发过布局证据的浏览器，未经审查的导出为空数组。**不是**固定写入三个引擎名（那是信任模型明令禁止的自我声明）。
- **向后不兼容**：2026-07-31 之前导出的文件不含 `printformRuntimeHash`，重新导入会降级 `Untrusted`（fail-closed，非缺陷）。
- 任何自定义 script、模板 `<script`、主题 `</style`/`<script` → 降级 `Untrusted`；untrusted 时 Agent 写命令被网关拒绝（`UNTRUSTED_READ_ONLY`）、打印预览拒绝、生产导出被 `UNTRUSTED_SCRIPT` 阻断。
- 「重置信任」= 剥离可执行内容 + 重置 flag；validateProject 独立重扫内容（`EXECUTABLE_MARKUP_PRESENT`）。
- CSP：trusted 导出用双 runtime sha256 hash；untrusted / 预览用 `unsafe-inline` 变体；`manifest.assets.allowExternalHttps` 在所有变体中同步打开 `img-src/font-src https:`。

### 3.3 命令契约（Agent Contract 2.0.0）

- 16 个工具见 [studio-v2/core/tool-contracts.js](studio-v2/core/tool-contracts.js)；全部经 `CommandBus.execute` 返回统一 `{ok, result|error{code,…}}`（含网关层 JSON 解析失败 `INVALID_INPUT_JSON`）。
- `get_capabilities` 返回 `capabilities: { candidateHash: true, candidateRealRender, layoutEvidenceReceipts }`：`candidateHash` 是契约形状（`preview_changes`/`apply_changes` 响应恒定携带该字段，值可能为 `null`）；后两者反映当前会话是否真的注入了浏览器渲染器（有 DOM 的 Studio UI 为 `true`，CLI 校验器/单测等无 DOM 环境为 `false`——此时无法签发布局证据，审查永远无法通过，是刻意的 fail-closed）。
- **2.0.0 唯一的破坏性变更**是 `complete_layout_review` 改用 `evidenceIds`（见 §3.5）。其余写路径保持向后兼容：`apply_changes` 仍接受直接传 `operations[]`，不强制先 `preview_changes`。
- 写命令必须带 `expectedRevision`；revision 单调递增、undo 不复用；过期写入返回 `REVISION_CONFLICT`。
- 无实际变化的写命令（locale / asset / **sample scenario** 重复选择）不产生新 revision，不清空已通过的布局审查。
- `set_manifest_value` 的 JSON 路径拒绝原型成员段（`INVALID_OPERATION_PATH`）。
- `operations[]` 中每个元素按 `type` 做判别联合校验（[studio-v2/core/operation-schemas.js](studio-v2/core/operation-schemas.js)，复用 core/schema.js 的受限 JSON Schema 引擎）：已知类型缺字段/多字段/字段类型错误一律 `INVALID_OPERATION_SHAPE`（附首个错误的 path+message）；未知 `type` 仍是 `UNSUPPORTED_OPERATION`。校验先于任何变更执行，失败时草稿不落盘、revision 不推进。
- 支持的 `operations[].type`：`set_manifest_value`、`replace_manifest/schema/i18n/sample_data/theme/template`、`set_asset_slot`、`set_text`、`set_attribute`，以及两个高层语义工具：
  - `set_column_widths({ tableSelector, widths })`：`tableSelector` 可以是逗号分隔的复合选择器（如 `.prowheader, .prowitem`），匹配到的每个 `<table>` 各行各列按位置套用 `widths`；数组长度必须等于该表列数；每个宽度值为 `"N%"`/`"Npx"`/`"Nmm"`/`"Npt"`，或 `""`/`"auto"` 表示该列不设固定宽度（用于 `table-layout:fixed` 下吸收剩余空间的描述类列）。PrintForm 模板常把表头行与重复数据行拆成两个独立 `<table>`（`.prowheader`/`.prowitem`），一次调用即可让两者列宽保持同步。
  - `set_font_scale({ basePt })`：整体平移 `core/typography.js` 的 7 级字号刻度（`--pf-font-minus-3`…`--pf-font-plus-3`，1pt 步进），`basePt` 范围 6–14pt；替换 themeCss 中已注入的旧刻度块，不会重复注入。
- 布局审查：`capture_layout_evidence`（按场景签发证据，见 §3.5）→ `begin_layout_review`（每 revision 最多 3 次，需先有 ready 渲染报告）→ `complete_layout_review`（提交 `evidenceIds`/findings/summary，major/critical open 阻断）；任何 mutation 使审查、渲染报告与已签发证据同时失效。
- 生产导出 readiness = 静态验证 + 当前 revision 渲染报告 ready + 布局审查通过；最终下载永远需要工程师点击。
- `preview_changes`/`apply_changes` 在浏览器环境下对候选项目做**真实分页渲染**（复用 UI 的可见预览 iframe，不止 schema/业务规则校验）：返回的 `validation` 携带真实 `issues[]`/`metrics`（含 `logicalPages` 等只有真实渲染才有的字段），并附带 `candidateHash`（`sha256(stableStringify(candidate))`）。`apply_changes` 若命中与刚才 `preview_changes` 相同的 `candidateHash`（即同一组 operations 作用在同一 revision 上）直接复用已渲染的报告提交，不重新渲染；未命中（跳过 preview 直接 apply）则内联渲染一次再提交——不存在"绕过真实渲染直接提交"的路径。渲染失败/超时归为 `RENDER_FAILED` 校验错误，不会让调用挂起。无浏览器上下文（单测、CLI 校验器）时二者退化为原有的纯 schema/业务规则校验，`candidateHash` 为 `null`。

### 3.4 渲染报告与错误路径

- 报告：`{ status: ready|blocked|superseded, validation, binding, metrics, issues[] }`。
- `issues[]` 元素：`{ code: HORIZONTAL_OVERFLOW|VERTICAL_OVERFLOW|CONTRAST_FAILURE, pageIndex, selector, rect{x,y,width,height}, text? }`，每类 ≤20 条。
- `metrics.renderedRows`/`metrics.expectedRows`：实际渲染的 `.prowitem_processed` 数与 `bindTemplate` 绑定数；不一致时 `errors[]` 含 `ROW_COUNT_MISMATCH`（分页引擎丢行/重行的数量级证明，P0-B 部分实现，见 DESIGN.md §4.5）。`expectedRows` 仅在有真实浏览器渲染上下文时出现（CLI 校验器不产出该字段）。
- 每个 `.prowitem_processed` 行携带 `data-pf-row-index`（源数组下标，`binding.js` 打标，穿过整个分页流程不丢失）：`ROW_DUPLICATE_INDEX`（下标重复）、`ROW_MISSING_INDEX`（下标缺失，需 `expectedRowCount`）、`ROW_ORDER_MISMATCH`（下标非严格递增，即两行被换序）。无该标记的旧版导出文档自动跳过这三项，不误报。
- `data-repeat-header`/`data-repeat-docinfo` 为 `"y"` 时，每个逻辑页必须都有 `.pheader_processed`/`.pdocinfo_processed`，否则报 `HEADER_MISSING`/`DOCINFO_MISSING`。每页的直接子元素（页头/文档信息/行头/数据行/页脚区块）应自上而下正常堆叠，相邻元素纵向矩形重叠报 `SECTION_OVERLAP`。
- 错误 `path` 段前缀约定：`/manifest`、`/schema`、`/i18n`、`/theme`、`/template`、`/sampleData`、`/trust`、`/review`；UI 据前缀路由到编辑器（可点击跳转），布局类错误路径为 `/`。
- 预览消息仅当 `event.source === 预览 iframe.contentWindow` 时受理。
- 预览面板提供「Highlight issues」开关（默认开）：iframe 内 bridge 收到 `printform:rendered` 后用 `issues[].selector` 在当前文档实时定位并画红框；父页通过 `{ source: "printform-studio-v2-command", type: "toggle-overlay" }` 指令切换，指令同样只信任 `event.source === window.parent`，切换不触发重渲染。
- 「Preview and apply」的应用前确认是并排 diff 面板（`ui/diff-view.js`），不是 `window.confirm`：按 `preview_changes` 返回的 `changedSections` 逐个渲染，JSON 段两侧都先 `stableStringify` 再逐行 LCS 对比（新增行绿、删除行红），CSS/HTML 段按原始字符串逐行对比；`trust` 变化单独一行说明（如 `trusted → untrusted`）。取消/关闭不调用 `apply_changes`；无实际变更时跳过面板直接提示。单侧 >1500 行的 section 跳过逐行高亮，只显示全文。

### 3.5 布局验收证据（Agent Contract 2.0.0）

- `capture_layout_evidence({ expectedRevision, scenario })`：Studio 把该场景渲染成**未提交候选**（复用可见预览 iframe，revision 不推进），渲染干净时签发 `{ evidenceId, revision, scenario, browser:{name,version}, layoutFingerprint, renderReportHash, metrics, createdAt }`。
- `layoutFingerprint` = `sha256(stableStringify(pageGeometry))`，`pageGeometry` 是每页直接子元素的 class 加**页内相对**整数矩形（相对坐标是必须的：`getBoundingClientRect` 随滚动变化，绝对坐标会让同一布局哈希出不同值）。不含任何业务文本，因此真实数据模式下也可安全保留与嵌入导出。
- 渲染不干净的场景返回 `evidence: null` + 该场景的 validation（Agent 唯一能看到未提交场景真实错误的途径），不签发证据。无渲染器的会话返回 `EVIDENCE_UNAVAILABLE`，绝不伪造。
- `complete_layout_review` 必须提供覆盖 `default` 与 `long-text` 的 `evidenceIds`；旧式 `evidence`/`browser`/`scenarios` 自述字段 → `EVIDENCE_RECEIPT_REQUIRED`（即使同时附了有效 receipt 也拒绝）；未签发的 id → `EVIDENCE_UNKNOWN`；跨 revision → `EVIDENCE_STALE`。审查回执的 `browsers` 由 receipt 推导，不接受 Agent 自述。
- 任何 mutation 或 undo 清空整个 receipt store，旧证据无法为新内容背书。

### 3.6 PWA

- 部署版缓存优先（cache name 含 build id，构建时盖章，占位符缺失即构建失败）；本地开发网络优先。
- 导航请求忽略查询串匹配缓存，离线兜底 `index.html`；页面加载时已有 waiting worker 也会显示升级横幅。
- UI 五语言（en-MY 默认，静态打包；其余动态加载，失败回退英文，不阻断启动）。

---

## 4. 质量门（CI / 本地）

| 检查 | 命令 | 当前状态 |
|---|---|---|
| 单元测试（201 个，38 文件） | `npm test -- --run` | 必须全绿 |
| 语法检查产物 | `npm run check` | 构建后 |
| E2E（Playwright，25 条：首页 1、核心库直渲染 3、v1 结构模式 2、分页黄金样本 3、v2 深度场景 16） | `npm run test:e2e` | 本地/CI，三引擎（Chromium/Firefox/WebKit）；本地跑前确认 4174 端口无手动服务器占用（见 ROADMAP.md §2.1）；**改动 `studio-v2`/`studio`/`docs`/`img` 后必须先 `npm run build:site` 再跑，Playwright 默认 `webServer` 服务的是 `site-dist/` 构建快照而非实时源码**（见 ROADMAP.md §2.1） |
| v2 导出校验 | `npm run validate:v2 -- <file>` | 未签名报 `ATTESTATION_MISSING`，签名后 hash 全验 |
| 站点构建 | `npm run build:site` | 含两个已签名试点导出 |
