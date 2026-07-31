# DESIGN.md — PrintForm.js 架构设计

> 状态词沿用 [docs/STUDIO_V2_INDEX.zh-CN.md](docs/STUDIO_V2_INDEX.zh-CN.md)：**Current** = 代码已实现；**Target** = 已决定未实现；**Backlog** = 方向性。
>
> 本文以代码为唯一事实来源，最后核对：2026-07-31（对齐 `5d06702`）。

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

### 4.4 候选项目真实渲染（Current，2026-07-31 落地，TASK.md #12–13）

**决策**：复用现有可见预览 iframe（`#preview-frame`），不新开隐藏 sandbox iframe。用户在 2026-07-31 就这一取舍拍板——放弃"新开隐藏 iframe"的方案，理由是：省掉第二个常驻 iframe/PrintForm 运行时实例的内存与心智负担，并且让人类工程师能实时看到 Agent 提议的候选改动（与已有的 source-edit diff 面板体验一致），代价是需要一套跨 iframe reload 的请求排序机制（见下）。

**架构**：

1. **`CommandBus` 通过依赖注入获得可选的候选渲染器**：`new CommandBus(initialProject, { renderCandidate })`，`renderCandidate(project, revision)` 是一个返回 `Promise<RenderReport>` 的异步函数。不传（现有单测直接 `new CommandBus(project)`、CLI 校验器等无 DOM 环境）时保持原行为——`preview_changes` 退化为纯 schema/业务规则校验，不阻塞、不报错，这是既有"CLI 不产出 `expectedRows`"式优雅降级的延伸，向后兼容零回归（`tests/studio-v2/command-bus.test.js` 有专门回归用例）。
2. **`app.js` 的 `installBus()` 提供真实实现**：`renderCandidateForPreview(project, revision)` 复用 `renderPreview()`/`listenForPreview()` 和 `#preview-frame`，不另开一套 iframe 生命周期管理。
3. **一层跨 iframe reload 存活的请求 token**（`runtime.js` 内部 `generation` 计数器在"整个 iframe 重载"这一级别的对应物）：无论请求来自人类编辑防抖（`schedulePreview`）还是 Agent 的 `preview_changes`/`apply_changes`，发起渲染前先领取一个单调递增 token，`ui/preview.js` 的 `buildPreviewBridge()` 把 token 原样写进两个 postMessage 回执（`rendered`/`error`）；父页 `listenForPreview` 回调按 token 先查 `pendingCandidateRenders`，命中就是候选请求的回执，未命中再退回既有的按 `revision` 匹配的已提交状态路径。这同时天然满足了 TASK.md 原 #15（"拒绝非本次预览的消息"）的需求——**#15 已并入本项，不再单独存在**。
4. **`preview_changes`**：`candidate = applyOperations(project, operations)` 之后，若注入了 `renderCandidate` 就等待其真实渲染回执；用 `sha256(stableStringify(candidate))`（`core/json.js` 已有）算出 `candidateHash`，按 hash 缓存真实 render report（内存级，5 分钟 TTL——纯内存管理考虑而非正确性依赖，因为 revision 单调且从不复用，`ensureRevision` 已经能拦掉任何"底稿已变还想用旧预览"的情况）；返回的 `validation` 携带真实 `issues[]`/`metrics`，不再只是静态 schema 校验；渲染器 reject 时不抛出，落成 `RENDER_FAILED` 校验错误，`candidateHash` 依旧返回（hash 在调用渲染器之前就已算好）。
5. **`apply_changes`**：同样计算 candidate 与 `candidateHash`；命中缓存（Agent 刚 `preview_changes` 过同一组 operations）直接复用已缓存的 report 提交，不重新渲染；未命中缓存（Agent 跳过 preview 直接 apply）则退化为内联做一次同样的真实渲染 round-trip 再提交；`diff.changed === false` 时两者都直接短路，不调用渲染器、不占用缓存。

**人类可见性**：候选渲染期间 `#candidate-preview-banner`（`.banner` 复用既有 `#update-banner`/`#restore-banner` 样式）显示"正在预览 AI 提议的改动（未提交）"提示；`pendingCandidateRenders` 清空时（成功/失败/超时）自动隐藏。下一次真正的 commit（人类编辑或 Agent apply）发生时，`schedulePreview()` 既有的防抖流程会自动把 iframe 刷新回真实已提交状态，不需要额外的"回滚"代码路径；`installBus()` 切换项目（导入/切样本/重置信任）时会拒绝并清空所有仍在等待的候选渲染，避免悬挂 Promise。

**踩坑记录**：
- 设计阶段曾估计"500 行样本渲染约 1 秒"，属于未经实测的乐观数字——真实测量下，500 行 + 较大字号（13pt）的候选渲染在本地沙箱浏览器里跑到 47 秒以上（`PrintForm.formatAll()` 自身的 clone/measure/place 尚未做 P2/E9 计划中的行高预测量缓存优化，见 ROADMAP.md）。候选渲染的超时不能按这个乐观估计设置——最终定为 30 秒的宽松兜底（`CANDIDATE_RENDER_TIMEOUT_MS`），只用来兜"确实卡死了"，不是性能预算；现有已提交状态的 `schedulePreview()` 路径本来就没有超时。500 行默认 9pt 场景仍稳定符合 `100/500-row render budgets` 测试的既有预算（`durationMs ≤ 5000`），说明变慢的是"大字号+大行数"这个不常见组合，不是回归。
- `preview.js` 的 `bridge()` 改名并导出为 `buildPreviewBridge()`，只是为了能脱离 `createStandaloneHtml()`（需要真实 `fetch` 加载 `dist/` runtime，jsdom 单测环境无法解析相对 URL）单独对 token 回显逻辑做单测——纯字符串模板，无 DOM/网络依赖。
- `playwright.config.js` 的 `webServer.command` 是不带参数的 `node scripts/serve-site.mjs`，其默认根目录是 `site-dist/`——一份 `npm run build:site` 生成的**构建快照**，不是 `studio-v2/` 实时源码（对比 `.claude/launch.json` 传了显式的 `"."` 参数，服务仓库根目录实时源码）。`package.json` 的 `test:e2e` 脚本有 `pretest:e2e` 钩子会自动先跑 `build:site`，所以正常用 `npm run test:e2e`（CI 也这样跑）不受影响；只有像调试时那样图快直接执行 `npx playwright test`（跳过 pretest 钩子）才会踩坑——此时只跑 `build:assets` 不够，必须重新跑完整的 `npm run build:site` 让 `site-dist/` 同步，否则 Playwright 测的是修改前的旧代码，且不会有任何明显报错、只是行为对不上（本次意外获得的教训：新功能的 candidateHash 用 `npx playwright test` 直接跑稳定复现 `undefined`，而同一段代码在直接服务仓库根目录的浏览器里工作正常，最终定位到这个快照陈旧问题）。

### 4.5 渲染内容完整性——数量校验（Current，P0-B 部分实现）

`inspectRenderedDocument(doc, manifest, { expectedRowCount })`：`.prowitem` 行由分页引擎克隆后放置、从不像 PTAC/PADDT 那样被词数切分，因此最终 DOM 里 `.prowitem_processed` 的数量必须精确等于 `bindTemplate` 通过 `data-pf-each` 绑定的行数。不一致（分页引擎丢行或重复行的 bug）报 `ROW_COUNT_MISMATCH`。`runtime.js` 的 `render()` 把 `bound.report.rows` 作为 `expectedRowCount` 传入；CLI 校验器（`validate-printform-v2.mjs`）没有真实浏览器渲染上下文，不传该参数，检查自动跳过（不误报）。

**顺序/identity 校验（2026-07-31 补齐，TASK.md #16）**：`binding.js` 的 `expandRepeat` 给每个展开行打 `data-pf-row-index`（源数组下标），克隆穿过整个分页流程（clone/measure/place）后依然保留。`inspectRenderedDocument` 用这个标记做三项检查：`ROW_DUPLICATE_INDEX`（同一下标出现多次）、`ROW_MISSING_INDEX`（某下标从未出现，需要 `expectedRowCount`）、`ROW_ORDER_MISMATCH`（下标序列非严格递增——即使数量和集合都对，两行被交换顺序也能抓到，这是纯数量校验做不到的）。没有 `data-pf-row-index` 标记的旧版导出文档（该属性上线前生成的）自动跳过这三项检查，只保留数量校验，不误报。真实端到端证据来自 `e2e/studio-v2.spec.js`（Playwright 能读取沙箱 iframe 内部 DOM，jsdom 单测做不到这一步——手写脚本重新拼装 Node 全局对象验证过会撞上 jsdom 的 `performance.now()` brand-check 无限递归，遂放弃转而用 Playwright）：真实 45 行发票渲染后 `data-pf-row-index` 恰好是 `[0,1,...,44]`，与源数组顺序完全一致。

**重复区缺失 + 重叠校验（2026-07-31 补齐，TASK.md #17）**：`data-repeat-header`/`data-repeat-docinfo` 是没有逐行例外的全局开关（不同于 rowheader，行级 `without_prowheader` 可以单独豁免）——若模板声明为 `"y"`，每个逻辑页必须真的带着 `.pheader_processed`/`.pdocinfo_processed`，缺失报 `HEADER_MISSING`/`DOCINFO_MISSING`。另外，`.printform_page` 的直接子元素（页头/文档信息/行头/数据行容器/页脚）按设计应自上而下正常块级堆叠，不使用浮动或绝对定位；若相邻两个子元素的矩形发生纵向重叠（后一个的 `top` 小于前一个的 `bottom`），报 `SECTION_OVERLAP`——这正是 KB 记忆里 Crimson 采购单那次"顶部边框与页头网格恰好同坐标、视觉融合"事故的通用化检测版本，不用等人眼发现。两项检查都在真实 Sales Invoice/Purchase Order 样本上验证过零误报，并用人为破坏（剥离 pheader class、注入负 margin）确认了阳性触发（含截图证据）。

### 4.6 布局验收证据（Current，2026-07-31 落地，TASK.md #18）

**问题**：`complete_layout_review` 过去只检查 Agent 传来的字符串集合里有没有 `"full-page-screenshot"`——Agent 完全可以凭空写上这个词，整套"AI 必须先看过再放行导出"的门禁形同虚设。

**决策：证据是 Studio 自己测量的几何指纹，不是像素截图**（2026-07-31 与用户逐项确认）。理由链：预览 iframe 是 `sandbox="allow-scripts"` 无 `allow-same-origin` 的不透明 origin，父页读不到它的 DOM，真像素只能在 iframe 内部走 `foreignObject`→`canvas`→`toDataURL`，那条路有 canvas 污染报错风险、字体/图片保真缺陷、单张几 MB，而且**真实数据模式下像素里就是业务数据**，与 §隐私策略「默认不写入任何缓存」直接冲突。但 #18 要防的从来不是"看不看得到像素",而是"Agent 谎称自己看过"——Studio 自己渲染、自己 `getBoundingClientRect` 测出来的报告本身就是事实真相,给它签名即已完整达成防伪造。Agent 想看像素仍可用自己的 CDP 截图工具,只是那不构成证据。

**机制**：`capture_layout_evidence({ expectedRevision, scenario })` 复用 #12 的 `renderCandidate` 注入,把该场景渲染成**未提交候选**。这一点是必须的——如果改用 `set_sample_scenario` 切场景来捕获,那会 commit 并推进 revision,把上一个场景刚签发的 receipt 立刻变成 stale,两个场景的证据永远凑不齐。

`layoutFingerprint = sha256(stableStringify(pageGeometry))`,`pageGeometry` 是每页直接子元素的 class 加矩形。**矩形必须用页内相对坐标**:`getBoundingClientRect()` 是视口坐标,会随滚动位置变化,同一份布局在不同滚动位置会哈希出不同值,指纹就失去意义了。

**fail-closed 三处**:渲染不干净的场景不签发证据(但返回该场景的 validation——这是 Agent 唯一能看到未提交场景真实错误的途径);无渲染器的会话(CLI 校验器、单测)返回 `EVIDENCE_UNAVAILABLE` 而不是伪造一张;任何 mutation/undo 清空整个 receipt store。

**契约破坏**:这是 Agent Contract 2.0.0 唯一的破坏性变更。旧式 `evidence`/`browser`/`scenarios` 字段**即使同时附了有效 receipt 也拒绝**——留着旧路径等于 Agent 仍可自证,#18 的安全目标会归零,不破就没有意义。这与 #14 当时选择不破并不矛盾:#14 时信任目标已由候选真实渲染以非破坏方式达成,而这里没有非破坏的达成路径。

### 4.7 双 runtime attestation（Current，2026-07-31 落地，TASK.md #19）

导出的 trusted 文件内嵌两段可执行 script:document runtime(`pf-document-runtime`)与分页引擎(`pf-printform-runtime`)。此前 `createAttestation` **只哈希前者**——把 `printform.js` 换成一个改过的构建,attestation 依然显示"pass",导入依然 Trusted,没有任何检查会发现。#19 补上 `printformRuntimeHash`,并另存 `cspScriptHashes`(导出 CSP 里 `script-src` 允许的两个 sha256,让校验方能确认策略没被放宽成 `unsafe-inline`)。

两段 runtime 用**不同错误码**(`RUNTIME_HASH_MISMATCH` / `PRINTFORM_RUNTIME_HASH_MISMATCH`)——"换掉分页引擎"和"换掉文档运行时"是两种不同的篡改故事,合并成一个码会让排查时分不清;而且本次之前的存量导出恰好会触发后者,独立错误码让"旧文件"和"被动手脚"至少在信息上可区分。

`browsers` 字段从硬编码 `["Chromium","Firefox","WebKit"]` 改为**由 #18 的 evidence receipt 推导**。旧行为是每一份导出都声称在三个引擎里验证过,不管它实际在哪导出——正是信任模型明令禁止的自我声明。未经审查的导出现在诚实地留空数组;跨引擎覆盖由 CI 的 Playwright 三引擎矩阵背书,不写进每份文件。

**这是 fail-closed 破坏**(范围内已确认):2026-07-31 之前导出的文件不含 `printformRuntimeHash`,重新导入会降级 Untrusted。站内两个试点样本每次构建都重签,不受影响。

---

## 5. 构建与部署

- `npm run build` = 测试 → Vite 打包 `dist/printform.js` → 构建 `dist/printform-document.js`（v2 文档 runtime）→ 生成预览页。
- `npm run build:site` = 上述 + 拷贝白名单目录到 `site-dist/` + 生成两个已签名试点导出 + 给 `sw.js` 盖 build id（占位符缺失会**构建失败**，防止缓存永不更新的静默部署）。
- `dist/` 不进 git（`.gitignore`），由 CI（`.github/workflows/ci.yml`）构建。
- 本地开发服务器：`node scripts/serve-site.mjs .`（`.claude/launch.json` 已配置，端口 4174）。
