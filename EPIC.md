# EPIC.md — 史诗级工作项与状态

> 状态：✅ 完成 · 🔶 部分完成 · ⬜ 未开始。逐条任务见 [TASK.md](TASK.md)，时间线见 [ROADMAP.md](ROADMAP.md)。
>
> 最后核对：2026-09-04（E13-SERVER 已完成；AI Designer UX redesign 已决策、尚未实现）。

## E12：Studio v2 Production Foundation（2026-08-17，已完成）

状态：✅ **Production Candidate（受控 Chromium 范围）**；不是面向所有浏览器、打印机和多用户服务的 Production Ready。

范围：在既有 Protocol、CommandBus 和 PrintForm runtime 上增加 FormSpec/component registry、Active Table Context、结构化 pagination diagnostics、强制 transaction gate、trusted export allowlist 和 persistent Evidence Pack。证据入口：`tests/active-table-context.test.js`、`tests/studio-v2/form-spec.test.js`、`render-diagnostics.test.js`、`content-security.test.js`、`production-foundation.test.js`、`exporter.test.js`。

不在 E12：重写 formatter、AI 自行分页、pixel-based canvas、模板 marketplace、跨浏览器 pixel-identical 承诺。

### 独立运维任务（本阶段已完成）

- ✅ **OPS-NANOID**：lockfile `nanoid` → `3.3.18`；`npm audit --audit-level=high` 无 high，完整 build/test/validate:v2 通过；失败时只回滚 lockfile/dependency patch。
- ✅ **OPS-PLAYWRIGHT**：保留 CI 的 `playwright install --with-deps chromium firefox webkit`，新增 `test:e2e:chromium` 可复现安装 Chromium 后构建并运行；Chromium revision `1234` 的 56/56 E2E 通过；失败时回滚安装步骤或版本 pin。
- ✅ **OPS-WINDOWS-DOCTOR**：改用 `process.execPath` + npm CLI，Windows `npm run doctor` 5/5 PASS；失败时回滚脚本适配，不影响应用代码。

E12 退出证据：68 files / 361 unit tests、`build:site`、`check:agrun`、三份 pilot `validate:v2`、Chromium 56/56、audit 0 high、Windows doctor 5/5、`git diff --check` 全部 PASS。证据截图与 JSON 是 Playwright `test-results` 附件；应用 Evidence Pack 同时写入当前 Studio journal。

## E13：Durable Transaction / Concurrency / Recovery

状态：✅ **E13-SERVER 受控部署验收通过；Production Candidate 94/100**。

范围：在不替换 PrintForm.js、Protocol 或 FormSpec 的前提下，把 transaction、revision、lease、audit 和 Evidence Pack 从 local/offline contract 延伸到真实 SQLite writer service。localStorage 仍保留为 offline/single-session fallback；跨设备发布必须走 server adapter。

代码入口：`studio-v2/core/durable-transaction-store.js`、`studio-v2/server/sqlite-durable-backend.mjs`、`studio-v2/server/transaction-http-server.mjs`、`scripts/transaction-server.mjs`。语义入口：`get_transaction`、`list_active_transactions`、`renew_lease`、`takeover_transaction`、`recover_transaction`、`resolve_conflict`、`get_revision`、`get_audit_events`。

退出条件与当前结果：

- ✅ restart 后按 durable head 判定 `COMMITTED` / `ROLLED_BACK` / `CONFLICTED`；process crash 覆盖 CAS 前、CAS 后和响应丢失路径。
- ✅ 同一 base revision 使用真实 SQLite SQL CAS；stale agent 得到 `REVISION_CONFLICT { expectedRevision, actualRevision }`，不得静默覆盖。
- ✅ lease 使用 server database time；过期 lease 不复用旧 transaction，takeover 生成新 id，旧记录保留审计。
- ✅ `transaction_id` commit retry 幂等；Evidence Pack 在同一 committed revision 上按 hash 幂等锚定，不重复 Evidence anchor。
- ✅ Evidence chain 绑定 `artifact_hash`、Evidence Pack hash、committed revision、transaction id、FormSpec/preview/runtime hash，并写入 durable registry projection。
- ✅ `tests/studio-v2/server-transaction.test.js` 8/8；全量 70 files / 378 tests；build、doctor、validate:v2、Chromium 56/56 均通过；audit 0 high 为已记录的历史证据，本次文档更新未重新完成网络审计。

### E13-SERVER 部署边界与下一阶段

当前认证模型是一个 writer service 进程管理一个 SQLite WAL 文件，多个独立 HTTP sessions/devices/agents 竞争同一个 server CAS。尚未认证 active-active writer、leader/fencing、外部 HA 数据库、跨设备浏览器 UI 的 remote-store wiring、长期 abandoned cleanup 和独立 artifact blob registry；这些不能通过复制当前进程解决。

本 Epic 不增加 AI 设计能力，不让 Agent 修改 rendered DOM，不把分页职责移入交易服务；E14 先处理已确认的 AI Designer IA/UX，E15 再解决 server HA/数据库迁移/故障演练和多用户发布边界。

## E14：AI Designer Information Architecture & Interaction Foundation（P0 已完成，P1/P2 Target）

状态：🔶 **P0 已完成**。已实现已决策的 AI Designer 目标结构与核心状态流，P1/P2 待后续迭代。

目标：把现有 AI Designer 从“承载聊天、配置、session、审计和历史的拥挤 sidebar”整理为 document-aware AI design conversation。Preview 仍是 Studio 的事实来源；AI panel 内 conversation 是主要 AI 交互区域。

固定层级：`Panel navigation → Current document context → Conversation → Composer`。

P0 范围（✅ 全部完成并经 E2E/单元测试验证）：

- ✅ 重排 AI panel IA 为 4 层架构，减少 permanent navigation 和 management controls。
- ✅ 增加 real Current Document Context，动态展示 document、selection、scope、revision、render status 与 candidate/committed 状态。
- ✅ 将 proposal 呈现升级为结构化 Proposal、Change 与 Validation cards；显示 target、可测量的 before/after、safety 与 validation 指标。
- ✅ 可见且可预测的 Apply mode（`Auto-apply safe changes` 与 `Preview before applying`）；保持所有现有 preview、validation、approval 和 transaction 门禁。
- ✅ 将 Undo 与已提交的 transaction batch 关联，在卡片上直接提供上下文撤销/重做；global Undo/Redo 作为 secondary control 保留。
- ✅ 精简 header，移除永久性 Gateway、Audit、Delete 堆叠，将 session 管理收纳至抽屉式区域。

P1 范围（Target）：History drawer、Changes view、Settings 集中化、动态 quick prompts、streaming/error states、mobile full-screen chat、focus restoration、tab semantics 和 keyboard accessibility。

P2 范围（Target）：before/after preview、change card 与 preview element 双向 highlight、可 resize rail、视觉层级 polish 和完整 AI UX E2E。

明确不在 E14：不重写分页器、不让 AI 修改 rendered DOM、不改变单 HTML 协议、不引入任意表达式、不取消人工 Production export、不默认允许 partial commit。

## E15：Durable Service Hardening（Target）

状态：⬜ **未开始**。E15 承接原先规划的 E14 Durable Service Hardening，编号后移是为了让当前已确认的 AI Designer P0 工作拥有独立 Epic。

范围：外部数据库迁移、active-active writer、leader/fencing、failover、abandoned transaction cleanup、跨设备 Studio remote-store wiring、故障演练和独立 artifact blob/attestation registry。E13-SERVER 在 E15 完成前仍只承诺单 writer SQLite service 的受控部署边界。

| # | Epic | 状态 | 说明 / 证据 |
|---|---|---|---|
| E1 | 核心引擎稳定化 | ✅ | 分页引擎模块化拆分完成；2026-07-31 修复动态注入不执行、PADDT 克隆强制换页（`00e3b7f`）；100 个单测全绿 |
| E2 | Studio v1 加固并冻结 | ✅ | 结构模式索引对齐、XSS 加固、mustache-lite 严格化（`ebd5d20`）；此后**只修 bug 不加功能** |
| E3 | 构建/脚本健壮化 | ✅ | serve-site 防崩、SW 占位符断言、v2 校验器区分未签名与被篡改（`ebd5d20`） |
| E4 | Studio v2 安全闭环（第一批） | ✅ | 预览消息防伪造、opener 切断、原型污染防护、单调 revision、信任物理剥离（`1bc63d7`）；对应路线图 P0-A #2 与 P0-B #1 的 iframe 身份部分 |
| E5 | Agent / 开发者可观测性 | ✅ | WebMCP 标准注册、元素级 issues、质量门可点击、开发模式 SW 网络优先（`53d4a52`）、预览问题元素红框 overlay（`1dc2856`）、Apply 前并排 diff 面板（`ebf3931`，取代 window.confirm 文本） |
| E6 | P0-A 事务闭环 | ✅ | 单调 revision（`1bc63d7`）、operations 判别联合 schema 校验（`77d9722`）、候选项目在复用的可见预览 iframe 中真实渲染 + candidateHash 缓存（TASK.md #12+#13，含原 P0-B #15 nonce 需求，`f4ca539`）、Agent Contract 版本声明 1.1.0→1.2.0（TASK.md #14，`bda0379`，向后兼容的次版本升级，非路线图原设想的破坏性 2.0 两阶段提交切换——就此分歧征询用户后确认范围）。P0-A 六项全部完成 |
| E7 | P0-B 信任闭环（证据体系） | ✅ | `event.source` 目标 iframe 校验、元素级越界/对比度定位、渲染内容数量+顺序+identity 完整性校验（`ROW_*` 四项）、重复区缺失+重叠检测（`535c58c`）、Studio 签发布局证据 receipt + Agent Contract 2.0.0（#18，`1e6cb3e`，证据形态经确认为几何指纹而非像素截图）、attestation 覆盖两段 runtime hash + CSP script hash + 真实浏览器凭证（#19，`63513b2`）。原 nonce 需求（原 #15）已并入 E6/#12。**代码硬门全完成；当时仍是 Production Pilot**——更广浏览器/打印链发布流程须另行认证，当前 E12 已在受控 Chromium 范围进入 Production Candidate |
| E8 | P1 工程师结构化工作流 | 🔶 | 六个结构化面板已完成：Table columns、Print font scale、Page settings、Repeated areas、Brand color、Data contract；剩余 Raw editor Advanced 化、图片资源校验、ERP 接入片段和连接状态细化。AI Designer IA redesign 另归 E14 |
| E9 | P2 分页引擎演进 | ✅ | 核心退出条件（100 行首屏 ≤2s、500 行完整分页 ≤5s、v1 无回归）已达成：行高预测量缓存（`4c50a35`，先用 spike 画像定位真因——72% 耗时在 `getBoundingClientRect`——再动手，不猜架构；金标准分页断言三引擎逐页行分布字节不差，新增"500 行+放大字号"回归护栏）。`PaginationSession`/`PageContext`/`LayoutPlan`/`RenderResult` 类重构与结构化 trace 事件经评估（无代码改动）判定暂不值得做——退出条件不要求这批类存在，现有轻量 `pageContext` 纯对象已过充分测试，且无具体消费方需求驱动，改动只会再次触碰刚验证过的热路径；非放弃，是主动的"无驱动力不为假设需求设计"决定，详见 TASK.md。硬约束（v1 ERP DOM 行为不变）全程未破 |
| E10 | P3 发布治理 | 🔶 | LICENSE、SW precache manifest、CHANGELOG、独立 SemVer 和兼容矩阵已完成；当前版本线为 runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 3.0.0。待办：GitHub Release 附试点导出、版本化模板目录 |
| E11 | 维护成本优化 | 🔶 | 已完成：v2 安全回归测试固化 + v1 mustache-lite 测试 + 修复 vitest 环境 localStorage 遮蔽问题（`4806408`，136 测试）、`examples/README.md` 演示页目录（`d78bd51`）、CI 增加 validate:v2 两试点 + 核心库/v1 冒烟 5 条（`4a0c5e0`）、PR 模板（`c081a91`）、3 页分页黄金样本（`c081a91`，Playwright 共 21 测试）、`studio-v1.spec.js` 满载并行 flake 修复（`94f2c7e`）、`npm run doctor` 一键体检脚本（`07b3947`）。待办：文档 SSOT 持续治理（见 [ROADMAP.md](ROADMAP.md) 第 2 节） |
| E14 | AI Designer IA & Interaction Foundation | 🔶 | P0 已全部完成：4 层 IA、Current Document Context、结构化 Proposal/Change/Validation Cards、可见且可预测的 Apply Mode、Card-level Batch Undo、精简 Header。P1/P2 待后续推进。 |
| E15 | Durable Service Hardening | ⬜ | 原 E14 后续项：HA/fencing、外部数据库、remote UI store、recovery operations 和 artifact registry。 |
