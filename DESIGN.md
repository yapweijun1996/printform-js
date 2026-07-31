# DESIGN.md — PrintForm.js 架构设计

> 状态词沿用 [docs/STUDIO_V2_INDEX.zh-CN.md](docs/STUDIO_V2_INDEX.zh-CN.md)：**Current** = 代码已实现；**Target** = 已决定未实现；**Backlog** = 方向性。
>
> 本文以代码为唯一事实来源，最后核对：2026-07-31（对齐待提交的渲染行数完整性校验批次）。

---

## 1. 系统全景

仓库包含三个独立子系统，共享同一个分页引擎产物 `dist/printform.js`：

```
┌─────────────────────────────────────────────────────────┐
│  核心分页引擎  src/printform/**  →  dist/printform.js     │
│  （零依赖 Vanilla JS，浏览器端 HTML 自动分页）              │
└──────────┬───────────────────┬──────────────────────────┘
           │                   │
┌──────────▼─────────┐  ┌──────▼──────────────────────────┐
│  Studio v1（冻结）   │  │  Studio v2（Production Pilot）   │
│  studio/           │  │  studio-v2/                      │
│  可视化调参 + 模板    │  │  单 HTML 协议 2.0.0 + Agent 命令  │
│  Mustache 数据绑定   │  │  总线 + WebMCP/CDP + PWA         │
└────────────────────┘  └─────────────────────────────────┘
```

| 子系统 | 维护策略 | 入口 |
|---|---|---|
| 核心引擎 | 活跃维护，兼容式渐进重构（见路线图 P2） | `src/printform.js` |
| Studio v1 | **冻结**：只修 bug 和安全问题，不加功能 | `studio/index.html` |
| Studio v2 | 活跃开发，按 P0→P3 路线推进 | `studio-v2/index.html` |

---

## 2. 核心分页引擎（Current）

### 2.1 模块划分

- [src/printform.js](src/printform.js) — 公共 API（`PrintForm.formatAll/format`）、自动初始化（检查 `document.readyState`，支持动态注入后执行）、防重入（`__printFormProcessing`/`__printFormProcessed`）。
- [src/printform/config.js](src/printform/config.js) — 全部配置的单一定义表 `CONFIG_DESCRIPTORS`（默认值 + `data-*` + 旧全局变量三来源合并）；PADDT 独立配置表。
- [src/printform/dom.js](src/printform/dom.js) — 高度测量（`getBoundingClientRect` 亚像素 + margin）、dummy row/spacer 生成、分页符 divider。
- [src/printform/text.js](src/printform/text.js) — 按词数切分段落（TreeWalker + Range），PTAC/PADDT 共用。
- [src/printform/formatter/](src/printform/formatter/) — `PrintFormFormatter` 类，方法按职责拆分为 12 个 attach 模块（pages / sections / row-types / segments-ptac / segments-paddt / rendering / pagination-context / -dummy / -render / -spacing / -finalize）。
- [src/printform/debug.js](src/printform/debug.js) — `data-debug=y` 时的控制台捕获 + 页内调试面板。

### 2.2 分页流程（一次 `format()`）

1. `collectSections()` — 先展开 PTAC/PADDT 长文分段（克隆时**必须移除** `tb_page_break_before`，两者已对齐），再收集 header/docinfo×5/rowheader/footer×5/logo/pagenum/rows；PADDT 行分离出主流程，在全部常规页脚之后另起分页。
2. `measureSections()` — 逐区块测量高度（含 margin，向上取整防移动端小数像素累积溢出）。
3. `renderRows()` — 逐行 append→measure→超限则撤销并 `prepareNextPage()`；小计/页脚组合行有预测试 + dummy 行推底逻辑。
4. `finalizeDocument()` — 追加最终页脚，必要时另起一页。
5. `finalizePageHeight()` — 每页按配置高度补 spacer（插在页脚前）。

### 2.3 关键设计决策

| 决策 | 理由 |
|---|---|
| 测量用 `measureHeightRaw`（不临时改样式） | `measureHeight` 的隐藏元素兜底会在移动端紧凑循环里引发 0 高度读数与重复 append |
| 分页符用 `setAttribute("style", "page-break-before: always…")` | 部分 HTML→PDF 引擎只认旧属性名；`div.style.*` 会被浏览器规范化成 `break-before` |
| 自动初始化先查 `readyState` 再挂事件 | 脚本在 DOMContentLoaded 之后注入时事件不会再触发（2026-07-31 修复，`00e3b7f`） |
| 高度归一 `Math.ceil(num - 1e-6)` | iOS/WebKit 小数像素向下取整会累积成意外换页 |

---

## 3. Studio v1（冻结，Current）

- 单文件应用 [studio/studio.js](studio/studio.js)（约 1.5k 行；属冻结豁免，见 ROADMAP 维护策略）+ [studio/bridge.js](studio/bridge.js)（注入预览 iframe）+ [studio/mustache-lite.js](studio/mustache-lite.js)（最小 Mustache 子集）。
- 预览 = blob iframe + bridge postMessage 回报（console/metrics/blocks）。**消息必须校验 `event.origin === location.origin`，日志 level 走白名单**（2026-07-31，`ebd5d20`）。
- **结构模式必须加载原始模板**（不做 `renderWithData`）：bridge 的区块索引与 `withWorkingDoc` 的原始子节点索引才能对齐，`{{ }}` 绑定才不会被编辑毁掉（同上）。
- mustache-lite：转义含 `'` 与 `` ` ``；不配对 section 抛错（`renderWithData` 已接错误 UI）。

## 4. Studio v2（Production Pilot，Current）

### 4.1 分层

- `core/` — 纯逻辑（协议 parse/serialize、operations、revision 历史、验收、资产内联、布局审查、i18n、导出）。**UI 不得绕过 core 直接改项目。**
- `ui/` — DOM 绑定（app.js 组装、preview、status-view、draft-cache、file-io、ui-i18n）。
- `adapters/` — 命令面适配（gateway = `window.PrintFormStudioAgent`；webmcp = `navigator.modelContext` 标准位置优先，支持 `registerTool` 与 `provideContext` 两种 API）。
- `samples/` — 两个标准样本（Sales Invoice / Purchase Order）。
- `sw.js` — PWA 缓存；**本地开发（BUILD_ID 未盖章）网络优先，部署（盖章）缓存优先**；导航请求忽略 query 并有离线壳兜底。

### 4.2 安全设计（2026-07-31 落地，`1bc63d7` + `53d4a52`）

| 防线 | 实现 |
|---|---|
| 预览报告防伪造 | `listenForPreview` 校验 `event.source === iframe.contentWindow`（沙箱 iframe origin 为 `"null"`，payload 字符串可伪造，**只能**用 source 身份） |
| 打印预览防逃逸 | blob: URL 继承 Studio origin，弹窗前 `target.opener = null`，untrusted 项目直接拒绝 |
| 原型污染防护 | `setJsonPath` 拒绝 `__proto__`/`constructor`/`prototype` 路径段 |
| 乐观锁可靠性 | revision 用 `nextRevision` 单调计数器，undo 后不复用编号 |
| 信任不可只翻 flag | 「重置信任」物理剥离 script/事件属性/javascript: URL；`validateProject` 从内容重推导可执行标记；themeCss `</style>` 逃逸会降级信任并在序列化时转义 |
| operations 判别联合校验 | `core/operation-schemas.js` 按 `operation.type` 分派 schema，复用 `core/schema.js` 校验引擎；已知类型的缺字段/多字段/类型错误在任何变更执行前统一拦截（`INVALID_OPERATION_SHAPE`），未知类型仍走既有 `UNSUPPORTED_OPERATION` |
| 高层语义工具优先复合选择器而非单表 | `set_column_widths` 的 `tableSelector` 接受逗号分隔选择器，因为真实模板把表头（`.prowheader`）与重复数据行（`.prowitem`）拆成两个独立 `<table>`；只支持单一 `<table>` 会让工具在实际模板上不可用 |

### 4.3 Agent 可观测性（Current）

- 渲染报告带元素级 `issues[]`：`{ code, pageIndex, selector(页内 CSS 路径), rect, text }`，每类上限 20 条；经 `validate_project` 与 `begin_layout_review` 暴露。
- 校验错误路径统一段前缀（`/schema/...`、`/sampleData/...`），UI 据此做可点击跳转，Agent 据此路由修复。
- 预览面板复用同一份 `issues[]`：bridge 在渲染 iframe 内用 `selector` 实时重新测量并画红框（非 postMessage 传坐标，避免滚动/缩放导致的坐标漂移），父页通过 `postMessage` 指令切换开关，不触发重渲染。
- 「Preview and apply」不再用 `window.confirm` 单行文本确认，改为 `ui/diff-view.js` 的并排 diff 面板：LCS 逐行对比每个变更 section（JSON 段先经 `stableStringify` 再对比，避免键序不同被误判为变更），新增行绿色高亮、删除行红色高亮；`trust` 这类非文本伪 section 单独渲染一行说明。取消不调用 `apply_changes`，草稿不落盘；未变更时直接跳过面板显示提示。单侧行数超过 1500 行时跳过逐行高亮（避免 O(m·n) 在超大样本数据上卡顿），仅展示全文。
- 注意：`core/acceptance.js` 会打进 `dist/printform-document.js`，改动后必须 `npm run build:assets` 才对预览生效。

### 4.4 尚未实现（Target，勿当作已有）

候选项目真实分页 dry-run、preview receipt 原子提交、Studio 签发截图证据、preview 消息 nonce + candidate hash、双 runtime 完整 attestation、内容顺序/遗漏/重叠证明。**内容"数量"证明已部分实现**（见 4.5），顺序/identity/重叠仍是 Target。权威定义见[信任与代理模型](docs/STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)与[工程路线图](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)；实施顺序拆分见 [TASK.md](TASK.md) #12–19。

### 4.5 渲染内容完整性——数量校验（Current，P0-B 部分实现）

`inspectRenderedDocument(doc, manifest, { expectedRowCount })`：`.prowitem` 行由分页引擎克隆后放置、从不像 PTAC/PADDT 那样被词数切分，因此最终 DOM 里 `.prowitem_processed` 的数量必须精确等于 `bindTemplate` 通过 `data-pf-each` 绑定的行数。不一致（分页引擎丢行或重复行的 bug）报 `ROW_COUNT_MISMATCH`。`runtime.js` 的 `render()` 把 `bound.report.rows` 作为 `expectedRowCount` 传入；CLI 校验器（`validate-printform-v2.mjs`）没有真实浏览器渲染上下文，不传该参数，检查自动跳过（不误报）。这只证明"数量"，不证明顺序或具体是哪一行——顺序/identity 校验仍是 Target（TASK.md #16）。

---

## 5. 构建与部署

- `npm run build` = 测试 → Vite 打包 `dist/printform.js` → 构建 `dist/printform-document.js`（v2 文档 runtime）→ 生成预览页。
- `npm run build:site` = 上述 + 拷贝白名单目录到 `site-dist/` + 生成两个已签名试点导出 + 给 `sw.js` 盖 build id（占位符缺失会**构建失败**，防止缓存永不更新的静默部署）。
- `dist/` 不进 git（`.gitignore`），由 CI（`.github/workflows/ci.yml`）构建。
- 本地开发服务器：`node scripts/serve-site.mjs .`（`.claude/launch.json` 已配置，端口 4174）。
