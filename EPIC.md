# EPIC.md — 史诗级工作项与状态

> 状态：✅ 完成 · 🔶 部分完成 · ⬜ 未开始。逐条任务见 [TASK.md](TASK.md)，时间线见 [ROADMAP.md](ROADMAP.md)。
>
> 最后核对：2026-08-17（E13 Durable Transaction / Concurrency / Recovery；E1–E13 当前工作树已核对）。

## E12：Studio v2 Production Foundation（2026-08-17）

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
- ✅ `tests/studio-v2/server-transaction.test.js` 8/8；全量 70 files / 378 tests；build、doctor、audit、validate:v2、Chromium 56/56 均通过。

### E13-SERVER 部署边界与下一阶段

当前认证模型是一个 writer service 进程管理一个 SQLite WAL 文件，多个独立 HTTP sessions/devices/agents 竞争同一个 server CAS。尚未认证 active-active writer、leader/fencing、外部 HA 数据库、跨设备浏览器 UI 的 remote-store wiring、长期 abandoned cleanup 和独立 artifact blob registry；这些不能通过复制当前进程解决。

本 Epic 不增加 AI 设计能力，不让 Agent 修改 rendered DOM，不把分页职责移入交易服务；下一 Epic 应先解决 server HA/数据库迁移/故障演练，再扩大多用户发布承诺。

| # | Epic | 状态 | 说明 / 证据 |
|---|---|---|---|
| E1 | 核心引擎稳定化 | ✅ | 分页引擎模块化拆分完成；2026-07-31 修复动态注入不执行、PADDT 克隆强制换页（`00e3b7f`）；100 个单测全绿 |
| E2 | Studio v1 加固并冻结 | ✅ | 结构模式索引对齐、XSS 加固、mustache-lite 严格化（`ebd5d20`）；此后**只修 bug 不加功能** |
| E3 | 构建/脚本健壮化 | ✅ | serve-site 防崩、SW 占位符断言、v2 校验器区分未签名与被篡改（`ebd5d20`） |
| E4 | Studio v2 安全闭环（第一批） | ✅ | 预览消息防伪造、opener 切断、原型污染防护、单调 revision、信任物理剥离（`1bc63d7`）；对应路线图 P0-A #2 与 P0-B #1 的 iframe 身份部分 |
| E5 | Agent / 开发者可观测性 | ✅ | WebMCP 标准注册、元素级 issues、质量门可点击、开发模式 SW 网络优先（`53d4a52`）、预览问题元素红框 overlay（`1dc2856`）、Apply 前并排 diff 面板（`ebf3931`，取代 window.confirm 文本） |
| E6 | P0-A 事务闭环 | ✅ | 单调 revision（`1bc63d7`）、operations 判别联合 schema 校验（`77d9722`）、候选项目在复用的可见预览 iframe 中真实渲染 + candidateHash 缓存（TASK.md #12+#13，含原 P0-B #15 nonce 需求，`f4ca539`）、Agent Contract 版本声明 1.1.0→1.2.0（TASK.md #14，`bda0379`，向后兼容的次版本升级，非路线图原设想的破坏性 2.0 两阶段提交切换——就此分歧征询用户后确认范围）。P0-A 六项全部完成 |
| E7 | P0-B 信任闭环（证据体系） | ✅ | `event.source` 目标 iframe 校验、元素级越界/对比度定位、渲染内容数量+顺序+identity 完整性校验（`ROW_*` 四项）、重复区缺失+重叠检测（`535c58c`）、Studio 签发布局证据 receipt + Agent Contract 2.0.0（#18，`1e6cb3e`，证据形态经确认为几何指纹而非像素截图）、attestation 覆盖两段 runtime hash + CSP script hash + 真实浏览器凭证（#19，`63513b2`）。原 nonce 需求（原 #15）已并入 E6/#12。**代码硬门全完成；当时仍是 Production Pilot**——更广浏览器/打印链发布流程须另行认证，当前 E12 已在受控 Chromium 范围进入 Production Candidate |
| E8 | P1 工程师结构化工作流 | 🔶 | 已完成：高层语义工具第一批 `set_column_widths`/`set_font_scale`（`46254d6`）、semantic diff drawer 取代 confirm 对话框（`ebf3931`，供 Apply 前变更审查用）、Table columns + Print font scale 可视化面板（`90a6c70`）、Page settings + Repeated areas 可视化面板（`8f0718b`，复用通用 `set_attribute` 操作，因为这两类字段没有专属操作类型）、Branding 品牌色面板（`d2fe47a`，新增 `set_brand_color` 操作，范围收敛到 `.pf-brand` 标题色一处，而非全套用色 token 化）、Data contract 面板（`3699991`，中档范围：schema 树只读展示 + 编辑样本值/既有约束，复用 `replace_schema`/`replace_sample_data`，不做增删字段/数组逐行编辑）。**六个结构化面板全部完成**，达成 ROADMAP P1"无需编辑原始 JSON/CSS 即可完成常见修改"这一核心退出条件。待办（ROADMAP P1 其余项，规模均较小）：Raw 编辑器移入 Advanced 模式、图片资源校验、生成 ERP 接入片段、细化连接状态展示 |
| E9 | P2 分页引擎演进 | ✅ | 核心退出条件（100 行首屏 ≤2s、500 行完整分页 ≤5s、v1 无回归）已达成：行高预测量缓存（`4c50a35`，先用 spike 画像定位真因——72% 耗时在 `getBoundingClientRect`——再动手，不猜架构；金标准分页断言三引擎逐页行分布字节不差，新增"500 行+放大字号"回归护栏）。`PaginationSession`/`PageContext`/`LayoutPlan`/`RenderResult` 类重构与结构化 trace 事件经评估（无代码改动）判定暂不值得做——退出条件不要求这批类存在，现有轻量 `pageContext` 纯对象已过充分测试，且无具体消费方需求驱动，改动只会再次触碰刚验证过的热路径；非放弃，是主动的"无驱动力不为假设需求设计"决定，详见 TASK.md。硬约束（v1 ERP DOM 行为不变）全程未破 |
| E10 | P3 发布治理 | 🔶 | 已完成：LICENSE（MIT）、SW precache manifest 构建期自动生成（`eebcae1`）、[CHANGELOG.md](CHANGELOG.md)（Keep a Changelog 格式，`5d06702`）、**独立 SemVer + 兼容矩阵**（`5cea34f`：引擎 1.0.0 / Studio 0.9.0 / 协议 2.0.0 / Agent Contract 2.0.0 四条线各自 SSOT，派生副本全部机器校验，见 [docs/COMPATIBILITY_MATRIX.zh-CN.md](docs/COMPATIBILITY_MATRIX.zh-CN.md)）。待办：GitHub Release 附试点导出（发布材料已备妥，最终 push/tag/release 由维护者执行）、版本化模板目录 |
| E11 | 维护成本优化 | 🔶 | 已完成：v2 安全回归测试固化 + v1 mustache-lite 测试 + 修复 vitest 环境 localStorage 遮蔽问题（`4806408`，136 测试）、`examples/README.md` 演示页目录（`d78bd51`）、CI 增加 validate:v2 两试点 + 核心库/v1 冒烟 5 条（`4a0c5e0`）、PR 模板（`c081a91`）、3 页分页黄金样本（`c081a91`，Playwright 共 21 测试）、`studio-v1.spec.js` 满载并行 flake 修复（`94f2c7e`）、`npm run doctor` 一键体检脚本（`07b3947`）。待办：文档 SSOT 持续治理（见 [ROADMAP.md](ROADMAP.md) 第 2 节） |
