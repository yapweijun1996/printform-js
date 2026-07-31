# PrintForm Studio v2 工程路线图

> 本文全部属于 Target 或 Backlog；当前可用行为以[协议文档](PRINTFORM_V2_PROTOCOL.zh-CN.md)和 `get_capabilities` 为准。

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
4. ✅ 已实现（2026-07-31）：`preview_changes` 用 `sha256(stableStringify(candidate))` 算 `candidateHash`，按 hash 缓存真实 render report（内存级短 TTL，非正确性依赖——revision 单调不复用已经防住"底稿已变还想用旧预览"）；返回真实 issues/metrics 而非仅 schema 校验。`candidateHash` 已在响应中返回；`previewId`（独立于 hash 的显式回执标识）与 `expiresAt` 字段**不计划加入 Agent Contract 1.x 线**——当前靠 revision 单调性 + hash 内容寻址已覆盖"防止用旧预览提交"的核心诉求，这两个字段只有在做真正破坏性的 Agent Contract 2.0（两阶段提交强制、见下方说明）时才有必要引入，不阻塞当前功能正确性。
5. ✅ 已实现（2026-07-31）：`apply_changes` 命中 candidateHash 缓存时直接复用已渲染的 report 提交（跳过重复渲染）；未命中（Agent 跳过 preview 直接 apply）时退化为内联做一次同样的真实渲染 round-trip 再提交，不接受"绕过真实渲染"的直接提交。
6. 任一验证、分页、完整性或容量错误使整组提交回滚。
7. ✅ 已实现（2026-07-31，TASK.md #14）：`AGENT_CONTRACT_VERSION` 从 1.1.0 升到 **1.2.0**——就"是否照原计划做破坏性两阶段提交切换"这一分歧征询用户后，确认范围改为向后兼容的次版本声明：`get_capabilities` 新增 `capabilities`，`apply_changes` 仍接受直接传 `operations[]`（第 5 项的两条路径都保留）。**本节设想的那种破坏性 2.0（`apply_changes` 只认 previewId/hash、拒绝直接 operations）至今未做，也未排期**——事务闭环目标已用非破坏性手段达成。
   > 注意版本号语义：契约后来确实升到了 **2.0.0**，但那是 P0-B 第 3 项（`complete_layout_review` 改用 `evidenceIds`）带来的破坏性变更，与本节设想的两阶段提交无关。`apply_changes` 至今仍接受 `operations[]`。

退出条件：

- stale revision（✅ `REVISION_CONFLICT`）、未知 operation（✅ `UNSUPPORTED_OPERATION`/`INVALID_OPERATION_SHAPE`）都有稳定错误码；「过期 preview」「hash mismatch」目前表现为下一次 `ensureRevision` 检查失败（同一错误码复用），没有独立于 revision 冲突之外的专属错误码——**评估后判定当前不需要拆分**（revision 冲突错误码已覆盖全部实际场景），只有真正做破坏性 Agent Contract 2.0 时才会重新评估是否需要专属错误码。
- default 与 long-text candidate 报告绑定同一 candidate hash：机制已具备（同内容必同 hash，hash 只由 candidate 内容决定，与场景标签无关），default 场景已有人工/e2e 验证；long-text 场景未做针对性验证，**留作已知空白**（不是任何已排期任务的一部分）。
- undo 后的旧写命令永远不能命中新状态（✅，revision 单调 + candidateReports 按内容 hash 寻址，undo 不会让旧 hash 复活）。
- UI、WebMCP、CDP 对相同输入返回一致结果（✅，三者共享同一 `CommandBus.execute`，没有分叉实现）。

## P0-B：信任闭环

目标：生产导出依赖真实、可追溯、不可自我声明的浏览器证据。

1. ✅ 已实现（2026-07-31）：Preview channel 加入目标 frame（`event.source` 校验）、nonce、revision 与 candidate hash 验证。原「一次性 nonce」需求（TASK.md 原 #15）由 P0-A 候选渲染的请求令牌排序机制满足（跨 iframe reload 的单调 token，只采纳最新一次请求的回执，过期回执直接丢弃，见 `ui/app.js` 的 `previewToken`/`pendingCandidateRenders`）——**#15 已并入 P0-A 第 3 项交付**；candidate hash 见 P0-A 第 4 项。
2. ✅ 已实现（2026-07-31，TASK.md #18）：`capture_layout_evidence` 把场景渲染成未提交候选并签发 Evidence Receipt。**证据形态经用户确认改为几何指纹（`layoutFingerprint`）而非像素截图**——沙箱 iframe 的不透明 origin 让父页读不到 DOM，像素只能走 foreignObject→canvas（canvas 污染风险 + 保真缺陷 + 体积 + 真实数据隐私冲突），而防伪造目标由"给 Studio 自己的测量结果签名"即可完整达成。详见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)《验收证据》。
3. ✅ 已实现（2026-07-31）：`complete_layout_review` 只接受 `evidenceIds`，旧式自述标签一律拒绝（Agent Contract 2.0.0 唯一的破坏性变更）。
4. ✅ 已实现（2026-07-31）：`binding.js` 给每个 `data-pf-each` 展开行打 `data-pf-row-index`（源数组下标，穿过整个分页流程不丢失）；`inspectRenderedDocument` 用它做 `ROW_COUNT_MISMATCH`（数量）、`ROW_DUPLICATE_INDEX`（重复）、`ROW_MISSING_INDEX`（遗漏）、`ROW_ORDER_MISMATCH`（顺序）四项检查，无标记的旧版导出文档自动跳过不误报。数量/顺序/重复/遗漏四项均已覆盖。
5. 🔶 部分实现（2026-07-31）：`data-repeat-header`/`data-repeat-docinfo` 为"y"时每页必须携带对应 `_processed` 区块（`HEADER_MISSING`/`DOCINFO_MISSING`）；页面直接子元素间的纵向矩形重叠检测（`SECTION_OVERLAP`）。越界已由既有 `HORIZONTAL_OVERFLOW`/`VERTICAL_OVERFLOW` 覆盖。尚未覆盖：footer（重复语义与 header/docinfo 不同，"仅最后页出现一次"需要另外建模，未做）。
6. ✅ 已实现（2026-07-31，TASK.md #19）：attestation 新增 `printformRuntimeHash`（此前只覆盖 document runtime，换掉分页引擎不会被发现）与 `cspScriptHashes`；`browsers` 改为从 #18 的 evidence receipt 推导（此前硬编码 `["Chromium","Firefox","WebKit"]` 写进每一份导出，无论实际在哪运行）。`verifyImportedProject` 与 `validate:v2` 同步校验第二段 runtime，用独立错误码 `PRINTFORM_RUNTIME_HASH_MISMATCH` 与 document runtime 区分。**fail-closed 后果**：本次之前导出的文件不含新字段，重新导入会降级 Untrusted。
7. `request_export` 汇总所有 blocker，最终点击仍只允许工程师执行。

退出条件：

- ✅ Agent 伪造 evidence 标签（`EVIDENCE_RECEIPT_REQUIRED`/`EVIDENCE_UNKNOWN`）、其他 frame 伪造消息（`event.source` + 请求 token）或修改任一 runtime（双 runtime hash）都会阻断。
- ✅ 已执行（2026-07-31）：Sales Invoice 与 Purchase Order 在 Chromium/Chrome/Firefox/WebKit 通过空值、1、45、100、500 行、长文本和五语言场景，**88/88 全过**。完整结论、覆盖范围与"四浏览器实为三引擎"的诚实说明见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)；可用 `node scripts/browser-matrix.mjs` 复现。**附带发现的跨引擎分页差异已解决**：Purchase Order 的页数曾随引擎变化（500 行时 Chromium 34 页 / Firefox 36 页）。根因是非行区块合计高度随 引擎×语言 波动 24.62px（约 0.59 行），使可用空间 14.59–15.18 行恰好跨在整数边界上。给非行区加 16px（`.pf-page-footer` padding-bottom 12→28px）把整段移到边界同一侧，全部 15 个 引擎×语言 组合收敛到每页 14 行，复跑矩阵 22 个可比格子零分歧。
- ✅ 共同硬标准为无丢失、重复、乱序、重叠和越界，页码与重复区正确（`ROW_*` 四项 + `HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` + `HORIZONTAL_OVERFLOW`/`VERTICAL_OVERFLOW`）。
- 六项 P0 的**代码硬门**已于 2026-07-31 全部完成，浏览器矩阵验收执行且全过，跨引擎分页差异也已收敛。文档状态**仍暂记为 Production Pilot**：Production Ready 是对外承诺，应由维护者显式宣布，不由一次跑批的绿灯自动推导；宣布前建议先在 Linux/Windows 重跑一次矩阵（本次仅 macOS 单机执行，而同引擎跨操作系统已知存在度量差异）。**推进中**：新增 `.github/workflows/browser-matrix.yml`（`workflow_dispatch`），可在 Ubuntu Actions runner 上按需一键复现，本地 `--quick` 预跑 72/72 全过确认自动化步骤本身无误，但尚未在真实 CI 上执行过（需 push + 手动触发，本次未做）；Windows 仍无对应通道。

## P1：工程师工作流

- 默认提供 Branding、Page、Repeated areas、Table columns、Locale 和 Data contract 面板。
- Raw HTML/CSS/JSON 移入 Advanced 模式，仍可手改并稳定 round-trip。
- ✅ 已实现（2026-07-31）：`ui/diff-view.js` 并排 diff 面板取代 `window.confirm` 一次性文本对话框（逐行 LCS 高亮）。仍是模态而非常驻侧栏，"persistent drawer" 的呈现形式留待与其余 P1 面板一起重新设计。
- ✅ 已实现（2026-07-31，`90a6c70`）：Table columns 面板——`core/column-inspection.js` 的 `inspectColumnGroups()` 从模板发现 `.prowheader`/`.prowitem` 列组并解析真实 i18n 标签；另加一个本列表之外的 Print font scale 面板（`typography.js` 的 `currentFontBasePt()` 读回当前基础字号）。两者都遵循 `set_locale`/`set_asset_source` 的直接应用模式，经通用 `apply_changes` 工具传入单个 `set_column_widths`/`set_font_scale` operation（这两个操作类型本身没有专属 CommandBus 工具）。Locale 面板（打印语言选择器）在本项之前已存在。
- ✅ 已实现（2026-07-31，`8f0718b`）：Page settings + Repeated areas 面板——`core/page-inspection.js` 的 `inspectPageSettings()`/`inspectRepeatFlags()` 从 `.printform` 根元素的 data-* 属性读回页面尺寸与七个 repeat-* 标记，只覆盖两个标准模板实际用到的字段（不是 `src/printform/config.js` 里更大的引擎级配置面）。这两类字段连操作类型都没有，直接复用完全通用的 `set_attribute`（每属性一条，打包进同一 `apply_changes`）。仍缺 Branding（配色）、Data contract（表单编辑器），这两项范围明显更大，留待单独讨论。
- 图片支持文件选择、尺寸/比例/大小/alt 检查，并以单一事务修改多个 asset slot。
- 草稿按源文件 fingerprint 保存、限时保留；未知导入默认关闭缓存。
- 生成 JSON Schema 示例、边界数据及 `validate`/`render` ERP 接入片段。
- 连接状态区分 WebMCP registered、CDP discovered、Agent connected 与 last command。

退出条件：工程师无需编辑大段原始 JSON/CSS，即可完成两个标准模板的常见品牌、页面、表格与 locale 修改。

## P2：分页引擎演进

- 引入每个表单独立的 `PaginationSession`、`PageContext`、`LayoutPlan` 与 `RenderResult`。
- `formatAll()` 始终返回 Promise 和结构化结果，不吞掉 formatter 错误。
- 保持现有 class、`data-*` 与 v1 ERP DOM 行为；每一步用旧样本做回归。
- 预先测量并缓存行高度，减少 clone/append/measure/remove 造成的 layout thrashing。
- 以结构化 trace event 取代 Studio 对 console 的依赖。
- 为同一 major 建立显式 minor migration registry 和 golden fixtures。

退出条件：100 行首次可见不超过 2 秒，500 行完整分页不超过 5 秒，且 v1 关键路径无回归。

## P3：发布治理

- Protocol、PrintForm runtime 与 Studio 分别使用独立 SemVer。
- 发布兼容矩阵、CHANGELOG、runtime checksums 与迁移说明。（✅ LICENSE 已于 2026-07-31 采用 MIT）
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

- 若未来确实需要做破坏性的 Agent Contract 2.0（`apply_changes` 只认 previewId/hash，不再接受直接 operations），届时不应保留 1.x 写路径，旧客户端只能读取升级提示——但这仍是未排期的假设性方向，不是当前承诺；当前 Agent Contract 线（1.2.0，见 P0-A 第 7 项）是向后兼容的次版本演进，没有计划走到破坏性切换。
- Protocol 同一 major 的迁移必须生成 diff 并另存为新 HTML；跨 major 只读。
- v1 Studio 不消费 v2 项目，也不自动迁移。
- 移动端只做查看与数据渲染回归；桌面四浏览器承担打印功能保证。
