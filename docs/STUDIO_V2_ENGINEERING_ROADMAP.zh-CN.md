# PrintForm Studio v2 工程路线图

> 本文全部属于 Target 或 Backlog；当前可用行为以[协议文档](PRINTFORM_V2_PROTOCOL.zh-CN.md)和 `get_capabilities` 为准。

> **2026-08-17 当前覆盖**：Production Foundation 已在既有路线之上落地。FormSpec/component registry、Active Table Context、结构化 pagination diagnostics、显式 transaction gate、strict trusted export 与持久化 Evidence Pack 以 `DESIGN.md`、`SPEC.md` 和 `TASK.md` 为当前 SSOT；本页 2026-07-31 条目中的“直接 `operations[]` apply”、2.1.0 版本和“footer 未覆盖”均为历史状态。

## 原则

- 先让已有承诺成为可证明的闭环，再扩展模板与自由度。
- 单 HTML 保持唯一事实来源；内存模型只负责稳定 parse/serialize。
- v1 Studio 冻结并独立维护，分页引擎采用兼容式渐进重构。
- 所有错误 fail-closed；人工可以导出 Untrusted，但不能豁免生产硬门。
- UI、WebMCP 与 CDP 共享命令契约和测试，不复制业务逻辑。

## P0-A：事务闭环

目标：Agent 看到、批准和提交的是同一份真实分页候选项目。

1. ✅ 已实现（2026-07-31）：`operations[]` 按 `type` 判别联合校验（`core/operation-schemas.js`，复用 `core/schema.js` 引擎），已知类型的缺字段/多字段/类型错误统一 `INVALID_OPERATION_SHAPE`；命令执行层的共享 JSON Schema 校验（`preview_changes`/`apply_changes` 之外的其他工具入参）仍未覆盖。
2. ✅ 已实现（2026-07-31，commit `1bc63d7`）：永不复用的 revision counter；undo 后提交产生新 revision identity。
3. ✅ 已实现（2026-07-31）：复用现有可见预览 iframe 渲染 candidate（用户拍板否决"新开隐藏 iframe"方案），不复用当前草稿的 RenderReport。`CommandBus` 通过依赖注入获得可选的 `renderCandidate` 异步渲染器；无 DOM 环境下保持现有静态校验行为，零回归。完整设计与实现细节见 [DESIGN.md §4.4](../DESIGN.md)。
4. ✅ 已升级（2026-08-17）：`preview_changes` 生成 candidate hash 并绑定 transaction；`approve_transaction` 固定 approved preview，`apply_changes` 必须携带 transaction ID、当前 revision 和同一 candidate hash，且候选内容被外部改变时 fail closed。
5. ✅ 已实现：命中 candidateHash 时复用已渲染 report；公共 Agent 若跳过 preview 或缺审批则直接拒绝，不再退化成直接 apply。Studio 内部编辑路径不属于 Agent contract。
6. 任一验证、分页、完整性或容量错误使整组提交回滚。
7. ✅ 已升级（2026-08-17）：Agent Contract 3.0.0 在保留读取兼容的前提下收紧公共 Agent 写路径，并加入 FormSpec、transaction journal、revision/evidence 查询与 strict export checks。**本节早期的直接 `operations[]` 写入仅保留为历史记录。**

退出条件：

- stale revision（✅ `REVISION_CONFLICT`）、候选 hash mismatch（✅ `CANDIDATE_HASH_MISMATCH`）、invalid candidate（✅ `CANDIDATE_INVALID`）、未知 operation（✅ `UNSUPPORTED_OPERATION`/`INVALID_OPERATION_SHAPE`）都有稳定错误码，且所有失败路径在 commit 前返回，revision 不变。
- default 与 long-text candidate 报告分别绑定自己的 `candidateHash`，并共同绑定当前 revision 与 `baseProjectHash`；嵌入式 layout-review、单测和 Playwright 已覆盖两种场景，避免把不同 sample scenario 错当成同一候选。
- undo 后的旧写命令永远不能命中新状态（✅，revision 单调 + candidateReports 按内容 hash 寻址，undo 不会让旧 hash 复活）。
- UI、WebMCP、CDP 对相同输入返回一致结果（✅，三者共享同一 `CommandBus.execute`，没有分叉实现）。

## P0-B：信任闭环

目标：生产导出依赖真实、可追溯、不可自我声明的浏览器证据。

1. ✅ 已实现（2026-07-31 / 2026-08-04）：Preview channel 校验目标 frame、revision 与单调请求 token；过期回执直接丢弃，逻辑位于 `ui/render-controller.js`。candidate hash 与 committed render provenance 由同一渲染链路写入并在 layout/export readiness 前复核。
2. ✅ 已实现（2026-07-31 / 2026-08-05，TASK.md #18）：`capture_layout_evidence` 把场景渲染成未提交候选并签发 Evidence Receipt。证据包含几何指纹与可选 geometry-only redacted SVG；synthetic mode 还可请求 bounded DOM-to-canvas pixel raster，并绑定 revision、candidate hash 与 `baseProjectHash`。real-data mode 在 gateway 硬拒绝像素证据，pixel raster 不携带 source URL，图片位置使用 placeholder；嵌入式 runtime 将可用 image part 送给 provider。详见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)《验收证据》。
3. ✅ 已实现（2026-07-31）：`complete_layout_review` 只接受 `evidenceIds`，旧式自述标签一律拒绝（Agent Contract 2.0.0 唯一的破坏性变更）。
4. ✅ 已实现（2026-07-31）：`binding.js` 给每个 `data-pf-each` 展开行打 `data-pf-row-index`（源数组下标，穿过整个分页流程不丢失）；`inspectRenderedDocument` 用它做 `ROW_COUNT_MISMATCH`（数量）、`ROW_DUPLICATE_INDEX`（重复）、`ROW_MISSING_INDEX`（遗漏）、`ROW_ORDER_MISMATCH`（顺序）四项检查，无标记的旧版导出文档自动跳过不误报。数量/顺序/重复/遗漏四项均已覆盖。
5. ✅ 已升级（2026-08-17）：在既有 header/docinfo/overflow/overlap 检查上增加 Active Table header、footer、page number、blank page、ROW_TOO_TALL、keep-together、orphan-total 等结构化诊断；每项带 component/page/measured/available/reason/action。
6. ✅ 已实现（2026-07-31，TASK.md #19）：attestation 新增 `printformRuntimeHash`（此前只覆盖 document runtime，换掉分页引擎不会被发现）与 `cspScriptHashes`；`browsers` 改为从 #18 的 evidence receipt 推导（此前硬编码 `["Chromium","Firefox","WebKit"]` 写进每一份导出，无论实际在哪运行）。`verifyImportedProject` 与 `validate:v2` 同步校验第二段 runtime，用独立错误码 `PRINTFORM_RUNTIME_HASH_MISMATCH` 与 document runtime 区分。**fail-closed 后果**：本次之前导出的文件不含新字段，重新导入会降级 Untrusted。
7. `request_export` 汇总所有 blocker，最终点击仍只允许工程师执行。

退出条件：

- ✅ Agent 伪造 evidence 标签（`EVIDENCE_RECEIPT_REQUIRED`/`EVIDENCE_UNKNOWN`）、其他 frame 伪造消息（`event.source` + 请求 token）或修改任一 runtime（双 runtime hash）都会阻断。
- ✅ 已执行（2026-07-31）：Sales Invoice 与 Purchase Order 在 Chromium/Chrome/Firefox/WebKit 通过空值、1、45、100、500 行、长文本和五语言场景，**88/88 全过**。完整结论、覆盖范围与"四浏览器实为三引擎"的诚实说明见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)；可用 `node scripts/browser-matrix.mjs` 复现。**附带发现的跨引擎分页差异已解决**：Purchase Order 的页数曾随引擎变化（500 行时 Chromium 34 页 / Firefox 36 页）。根因是非行区块合计高度随 引擎×语言 波动 24.62px（约 0.59 行），使可用空间 14.59–15.18 行恰好跨在整数边界上。给非行区加 16px（`.pf-page-footer` padding-bottom 12→28px）把整段移到边界同一侧，全部 15 个 引擎×语言 组合收敛到每页 14 行，复跑矩阵 22 个可比格子零分歧。
- ✅ 共同硬标准为无丢失、重复、乱序、重叠和越界，页码与重复区正确（`ROW_*` 四项 + `HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` + `HORIZONTAL_OVERFLOW`/`VERTICAL_OVERFLOW`）。
- 六项 P0 的**代码硬门**已于 2026-07-31 全部完成，浏览器矩阵验收执行且全过，跨引擎分页差异也已收敛。文档状态**仍暂记为 Production Pilot**：Production Ready 是对外承诺，应由维护者显式宣布，不由一次跑批的绿灯自动推导。浏览器矩阵已在 macOS 与 Linux（GitHub Actions Ubuntu runner，`.github/workflows/browser-matrix.yml`，[Actions run 30632832821](https://github.com/yapweijun1996/printform-js/actions/runs/30632832821)）两个系统上分别跑满 88/88 全过、零分歧，K=16px 收敛修法在两个系统上表现一致（详见 [docs/BROWSER_MATRIX.zh-CN.md](BROWSER_MATRIX.zh-CN.md)「Linux 复现」）。**仅剩 Windows 未验证**，GitHub Actions 无现成的 Windows+四浏览器方案，非阻塞待办。

## P1：工程师工作流

- 默认提供 Branding、Page、Repeated areas、Table columns、Locale 和 Data contract 面板。
- Raw HTML/CSS/JSON 移入 Advanced 模式，仍可手改并稳定 round-trip。
- ✅ 已实现（2026-07-31）：`ui/diff-view.js` 并排 diff 面板取代 `window.confirm` 一次性文本对话框（逐行 LCS 高亮）。仍是模态而非常驻侧栏，"persistent drawer" 的呈现形式留待与其余 P1 面板一起重新设计。
- ✅ 已实现（2026-07-31，`90a6c70`）：Table columns 面板——`core/column-inspection.js` 的 `inspectColumnGroups()` 从模板发现 `.prowheader`/`.prowitem` 列组并解析真实 i18n 标签；另加一个本列表之外的 Print font scale 面板（`typography.js` 的 `currentFontBasePt()` 读回当前基础字号）。两者都遵循 `set_locale`/`set_asset_source` 的直接应用模式，经通用 `apply_changes` 工具传入单个 `set_column_widths`/`set_font_scale` operation（这两个操作类型本身没有专属 CommandBus 工具）。Locale 面板（打印语言选择器）在本项之前已存在。
- ✅ 已实现（2026-07-31，`8f0718b`）：Page settings + Repeated areas 面板——`core/page-inspection.js` 的 `inspectPageSettings()`/`inspectRepeatFlags()` 从 `.printform` 根元素的 data-* 属性读回页面尺寸与七个 repeat-* 标记，只覆盖两个标准模板实际用到的字段（不是 `src/printform/config.js` 里更大的引擎级配置面）。这两类字段连操作类型都没有，直接复用完全通用的 `set_attribute`（每属性一条，打包进同一 `apply_changes`）。
- ✅ 已实现（2026-07-31，`d2fe47a`）：Branding 品牌色面板——两个模板的品牌色散落十几处硬编码 hex，全部 token 化是更大的独立设计任务；范围收敛到 `.pf-brand` 标题色一处，新增 `core/branding.js` + `set_brand_color` 操作。
- ✅ 已实现（2026-07-31，`3699991`）：Data contract 面板——中档范围，schema 树只读展示 + 表单编辑样本值与既有约束（required/min·maxLength/minimum·maximum/enum），复用既有 `replace_schema`/`replace_sample_data` 整段替换操作而非新增操作类型。**不做**增删字段（牵动模板绑定与 i18n 同步，需单独设计）与数组逐行编辑（表单对 45 行数据没有可用性，`items` 类字段仍走原始 JSON）。
- 图片支持文件选择、尺寸/比例/大小/alt 检查，并以单一事务修改多个 asset slot。
- 草稿按源文件 fingerprint 保存、限时保留；未知导入默认关闭缓存。
- 生成 JSON Schema 示例、边界数据及 `validate`/`render` ERP 接入片段。
- 连接状态区分 WebMCP registered、CDP discovered、Agent connected 与 last command。

退出条件：✅ 工程师无需编辑大段原始 JSON/CSS，即可完成两个标准模板的常见品牌、页面、表格与 locale 修改——六个结构化面板（Table columns/Print font scale/Page settings/Repeated areas/Brand color/Data contract）已覆盖。上方图片校验、草稿 fingerprint、ERP 接入片段生成、连接状态细化仍是独立的 P1 增量项，非本退出条件的必要部分。

## P2：分页引擎演进

- ✅ 已实现（2026-07-31，`4c50a35`）：预先测量并缓存行高度，减少 clone/append/measure/remove 造成的 layout thrashing。`spike/` 画像先行定位真因（72% 耗时在 `getBoundingClientRect`，根因是逐行读写交替 + 每次迭代重新测量行高），改动两处：循环前一次性批量预测量全部行高（消灭读写交替），非边界普通行用已知行高做算术预测（留 50px 安全余量）跳过容器回流测量；越过边界仍走原有精确路径不变。金标准分页断言三引擎逐页行分布字节不差；新增 e2e 把"500 行+放大字号"这个曾经的真实痛点组合钉成永久回归护栏。详见 TASK.md 对应行。
- ✅ 已评估（2026-07-31，无代码改动，见 TASK.md 对应行）：引入每个表单独立的 `PaginationSession`/`PageContext`/`LayoutPlan`/`RenderResult` 类，以及配套的结构化 trace event。**判定暂不做**——下方退出条件在缓存那一步已经达成，这批类不是达成退出条件的必要条件；现有 `pagination-context.js` 的轻量 `pageContext` 纯对象已过充分测试，无具体消费方需求驱动这次重构，动手只会再次触碰刚验证过的分页热路径。非放弃，是主动的"无驱动力不为假设需求设计"决定；出现具体驱动力（多消费方需要中间态、或真实 bug 追根到当前传递方式）时再评估。
- 保持现有 class、`data-*` 与 v1 ERP DOM 行为；每一步用旧样本做回归。（这条硬约束在缓存改动中全程遵守，是本项唯一已落地的动作）
- 为同一 major 建立显式 minor migration registry 和 golden fixtures。（同上，随类重构一起延后，非本轮范围）

退出条件：✅ 已达成——100 行首次可见不超过 2 秒，500 行完整分页不超过 5 秒，且 v1 关键路径无回归。（预算本身已长期满足；本次新增的是"500 行+放大字号"这个此前唯一未覆盖的真实慢场景的专属回归护栏）

## P3：发布治理

- ✅ 已升级（2026-08-17）：四条线继续独立 SemVer（引擎 1.0.0 / Studio 0.11.0 / 协议 2.0.0 / 契约 3.0.0）；FormSpec、transaction 与 Evidence Pack 属于 Studio/Agent additive envelope，单 HTML Protocol 保持 2.0.0 兼容。
- 发布兼容矩阵、runtime checksums 与迁移说明。（✅ LICENSE 已于 2026-07-31 采用 MIT；✅ [CHANGELOG.md](../CHANGELOG.md) 已于同日新增，Keep a Changelog 格式，`[Unreleased]` 一段——独立 SemVer 决策尚未做，暂无版本号可归档）
- GitHub Release 附两个经过验证的自包含单 HTML 试点文件。
- ✅ 已实现（2026-07-31）：构建过程生成 Service Worker precache manifest（`scripts/app-shell.mjs` 走产物目录），避免手工列表漂移。此前手写清单已漂移两次（新增模块忘记登记 → 离线时该模块 404），并且对比发现旧清单还漏了 `core/runtime.js`。
- 每个浏览器维护独立截图/打印基线和容差，不比较跨引擎像素一致性。
- 建立版本化模板目录；新模板必须继承完整边界数据与浏览器矩阵。

## 发布顺序

| 里程碑 | 内容 | 对外状态 |
|---|---|---|
| 2.1 Trust A | P0-A 事务闭环（✅ 已完成，Agent Contract 1.2.0，非破坏性版本） | Production Pilot |
| 2.2 Trust B | P0-B 信任闭环、两个模板全矩阵 | Production Ready 候选 |
| 2.3 Workflow | P1 工程师结构化体验 | Production Ready |
| 2.4 Engine | P2 分页 session 与性能 | Production Ready |
| 3.0 Governance | P3 独立版本与模板目录 | Template Scale |

具体版本号在实施时分别属于 Studio、runtime 与 protocol；表中编号表示路线里程碑，不替代三者的 SemVer。

## 兼容策略

- Agent Contract 3.0.0 保留 2.1.0 的 operation catalog、design inspection 与 layout review/evidence 能力，并加入 FormSpec、显式 transaction、持久化 journal、strict export allowlist 与 Evidence Pack。真实 ERP 像素仍被 gateway 拒绝，自动生产导出仍不在范围内，不改变 Protocol 2.0.0 或生产导出的人工确认边界。
- Protocol 同一 major 的迁移必须生成 diff 并另存为新 HTML；跨 major 只读。
- v1 Studio 不消费 v2 项目，也不自动迁移。
- 移动端只做查看与数据渲染回归；桌面四浏览器承担打印功能保证。
