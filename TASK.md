# TASK.md — 任务板

> 最后核对：2026-08-17（E13-SERVER Durable Backend Deployment & Recovery Acceptance）。E12 数字保留为历史记录；当前工作树的最新门禁与范围见下方“E13-SERVER 验证收口”。
>
> 规则：任务完成时移到「已完成」并附 commit；新任务先写验收标准再动手。Epic 归属见 [EPIC.md](EPIC.md)。

---

## 🧱 Studio v2 Production Foundation + Verification（2026-08-17）

本批是 P0 基础建设，目标是把 Studio v2 从“可打印 pilot”推进到“安全、事务化、确定性、可留证的 Agent 发布基础”。**在本批退出前不增加新的 AI 设计能力。** 每项任务都在现有 Protocol / CommandBus / PrintForm runtime 上增量实现；失败时保留 last-known-good revision。

| ID | 范围 | 验收标准 | 测试 / 依赖 / 回滚 |
|---|---|---|---|
| PF-01 | Canonical FormSpec 与 Component Registry；`pf-form-spec` 可选，旧 HTML 走 legacy adapter；Agent 只改语义组件 | `get_form_spec`、组件列举/读取、binding 与 pagination rule 可用；重复 ID/未知类型/缺失 section fail closed；旧样本仍可 preview/validate/export | `tests/studio-v2/form-spec.test.js`、acceptance 回归；依赖现有 Protocol；回滚为移除可选区块并继续使用 legacy adapter |
| PF-02 | Active Table Context；formatter 在顺序表格切换及续页时只重复 active table header | Valuation → Variation → Materials 长数据中，每页表头属于当前表；不重复已完成表格；100/500 行回归可复现 | `tests/active-table-context.test.js`、`e2e/active-table-pagination.spec.js`；依赖 row `data-pf-table-id`；回滚恢复 formatter 的 table-aware 分支 |
| PF-03 | Deterministic pagination diagnostics | 输出 component/page/measured/available/reason/action；覆盖 row-too-tall、overflow、blank、footer/page-number、orphan totals、signature/total keep-together | `tests/studio-v2/render-diagnostics.test.js`、acceptance tests；依赖现有 DOM geometry；回滚仅关闭新增诊断合并，不改变 pagination |
| PF-04 | Safe Agent transaction；preview candidate → validate → explicit approve → apply/commit；journal 持久化 | `apply_changes` 无 transaction/approved preview/hash 一律拒绝；候选内容被外部修改时 fail closed；失败不改 last-known-good；有 revision/history/rollback | `command-bus`、`agent-workflow`、`production-foundation` tests；依赖现有 revision history；回滚禁用 Agent write path，保留 Studio 内部编辑 |
| PF-05 | Trusted Export strict allowlist 与 Evidence Pack | script/iframe/object/embed、事件属性、javascript URL、未允许外部资源被拒；artifact 包含 revision/FormSpec/runtime/validation/page/preview/export/security/timestamp；mandatory gate 失败不发布 | `content-security.test.js`、`exporter.test.js`、`production-foundation.test.js`；依赖现有 exporter/attestation；回滚到 untrusted preview，禁止 trusted publish |
| PF-06 | Production evidence close-out | ✅ 已完成：记录全量 test/build/validate:v2、真实 Chromium E2E 与发布 hash；不把缺失环境标为 PASS | `npm test -- --run`、`npm run build:site`、`npm run check:agrun`、`npm run validate:v2`、Chromium Playwright 56/56；依赖 OPS 任务；回滚不发布 artifact |

### 独立运维任务（不与 P0 代码混改）

| ID | 范围 | 验收标准 | 测试 / 依赖 / 回滚 |
|---|---|---|---|
| OPS-NANOID | ✅ 处理 `nanoid@3.3.16` high severity 间接依赖 | lockfile `3.3.18`；`npm audit --audit-level=high` 无 high，lockfile、build、test、validate:v2 全通过 | npm audit + 全量门禁；依赖上游 Vite/PostCSS 兼容性；仅回滚 lockfile/dependency patch |
| OPS-PLAYWRIGHT | ✅ 固定 Chromium 版本并补可复现安装入口 | Active Table 多表长数据与 Production Verification 在真实 Chromium 执行；revision `1234`；56/56 | `npm run test:e2e -- --project=chromium`；CI 继续安装 Chromium/Firefox/WebKit；回滚安装步骤或版本 pin |
| OPS-WINDOWS-DOCTOR | ✅ 修复 Windows 下 npm 子进程调用 | `npm run doctor` 在 Windows 5/5 PASS；实现使用当前 Node + npm CLI，保留 macOS/Linux 路径 | doctor smoke + CI；依赖 Node/npm CLI；回滚仅脚本适配，不改应用代码 |

### E12 验证收口

| 证据 | 结果 |
|---|---|
| Unit / build / AGRUN / pilot validation | 68 files / 361 tests；`build:site`、`check:agrun`、3 pilot `validate:v2` PASS |
| Chromium E2E | 56/56 PASS；Progress Claim、四顺序表、100/500/1000 行、paper modes、diagnostics、Evidence Pack |
| Security / toolchain | nanoid 3.3.18；audit 0 high；Windows doctor 5/5；`git diff --check` PASS |
| 认证边界 | Chromium revision 1234 / A4 @ 96dpi portrait+landscape；Firefox/WebKit/真实 Safari/打印机链未在本阶段重新认证 |

### E13 Durable Transaction / Concurrency / Recovery（2026-08-17，第一阶段完成）

实现边界：不重写 `PrintForm.js`，不替换 Protocol/FormSpec，不增加 AI 设计能力。新的 durable store 是可替换 adapter；localStorage 继续支持离线/单会话，server backend 才是跨设备发布条件。

| ID | 范围 | 验收标准 | 测试 / 依赖 / 回滚 |
|---|---|---|---|
| E13-01 | Durable Transaction Store + state machine | 持久化 transaction、lease、patches、validation/approval、commit result、evidence ref；非法 state transition fail closed | `durable-transaction-store.js`、`transaction-state.js`、`transaction-recovery.test.js`；回滚删除新 durable key，保留旧 journal/API |
| E13-02 | Optimistic concurrency / atomic CAS | 同一 base revision 只有 CAS 获胜者提交；stale agent 得到 `REVISION_CONFLICT`，记录 expected/actual revision，不改 last-known-good | shared backend two-session test；server adapter 必须实现 backend CAS；localStorage 明确降级为单会话 |
| E13-03 | Lease / stale cleanup / takeover | heartbeat、renew、release、expiry；takeover 生成新 transaction id，旧记录 append-only | lease expiry/renew/takeover tests；回滚禁用 takeover command，不影响 committed revisions |
| E13-04 | Crash-safe commit / recovery | CAS 前失败恢复为 rollback；CAS 后失败从 durable head 恢复为 committed；无法判定进入 conflicted/recovery-required | injected crash before/after revision CAS；回滚保留 commit intent 与恢复 API |
| E13-05 | Evidence anchoring | artifact hash、Evidence Pack hash、revision、transaction、FormSpec/preview hash 与 audit event 可互相追溯 | evidence consistency test；失败时阻止 publish，保留已提交 revision |
| E13-06 | Bounded semantic recovery API | `get_transaction`、`list_active_transactions`、`renew_lease`、`takeover_transaction`、`recover_transaction`、`resolve_conflict`、`get_revision`、`get_audit_events` 无 arbitrary DB mutation | command contracts + gateway redaction；回滚仅移除新命令，不改 domain invariants |

### E13-SERVER Durable Backend Deployment & Recovery Acceptance（2026-08-17，已完成）

实现边界：新增真实 SQLite backend 与 bounded HTTP semantic adapter；不重写 PrintForm.js、FormSpec、分页器或 AI Designer，不把 localStorage fallback 改成伪分布式锁。

| ID | 范围 | 验收标准 | 测试 / 依赖 / 回滚 |
|---|---|---|---|
| E13-SERVER-01 | SQLite durable adapter | form envelope、transactions、revisions、lease projection、audit、evidence anchor 在 WAL/FULL 数据库文件中可重启读取；SQL CAS 不依赖内存 | `studio-v2/server/sqlite-durable-backend.mjs`；Node `>=22.5.0`；回滚移除 server adapter，local/offline contract 不变 |
| E13-SERVER-02 | Server CAS + server-time lease | 双 session 同 base revision 只有一方提交；stale 返回 `REVISION_CONFLICT(expectedRevision, actualRevision)`；clock skew 不影响 lease expiry/takeover | `tests/studio-v2/server-transaction.test.js` CAS/lease cases；回滚禁用 server publish route，不改已提交 head |
| E13-SERVER-03 | Idempotent commit / network failure | response lost、timeout/reconnect、duplicate request 不产生第二 revision；无法确认 durable state 时 fail closed | lost-response/reconnect tests；transaction id 是 idempotency key；回滚保留 query-before-retry，不自动重提未知 commit |
| E13-SERVER-04 | Process crash / restart recovery | CAS 前 rollback、CAS 后 committed、未知阶段不静默成功；restart 后状态可确定；Evidence retry 不重复 anchor | crash/restart tests + durable audit/evidence query；回滚保留 `RECOVERY_REQUIRED`，禁止直接 publish |
| E13-SERVER-05 | Semantic HTTP boundary / evidence registry | 只暴露 allowlisted commands；audit actor/server timestamp、Evidence Pack hash/revision/transaction/formSpec/preview/runtime 链可查询 | `transaction-http-server.mjs` + 8/8 server suite；回滚关闭 HTTP adapter，核心 CommandBus 不变 |
| E13-SERVER-06 | CI / operational gates | build、doctor、audit、validate:v2、Chromium regression 与 server suite 结果可复核；Evidence artifact 上传 CI | `.github/workflows/ci.yml`、package scripts；回滚仅移除 CI artifact/entrypoint，不降低 security gate |

### E13 验证收口

| 证据 | 结果 |
|---|---|
| E13 unit/recovery suite | `tests/studio-v2/transaction-recovery.test.js` 8/8；全量 70 files / 378 tests |
| Persistence/restart | shared durable backend reloads head project, revisions, transaction records and audit sequence |
| Concurrency | two sessions from revision 0: one commit wins, stale session gets `REVISION_CONFLICT` and `conflicted` record |
| Crash/recovery | failure injection at `during_commit` rolls back; `after_revision_write` recovers committed |
| Evidence | `evidence_anchored` links pack/artifact/formSpec/preview/revision/transaction |
| E13-SERVER acceptance | `tests/studio-v2/server-transaction.test.js` 8/8：真实 SQLite、CAS race、server clock lease、idempotent retry、process restart、network reconnect、Evidence anchor |
| Current boundary | 单 writer service + SQLite 文件已验证；active-active/HA/fencing、外部数据库迁移、跨设备浏览器 UI remote-store wiring、长期 abandoned cleanup 与 artifact blob registry 仍未完成 |

---

## ✅ 已完成（2026-07-31 全库审查批次）

| 任务 | Commit | 验证 |
|---|---|---|
| 核心：脚本晚于 DOMContentLoaded 注入时排版不执行 → 检查 `readyState` | `00e3b7f` | 单测 + 构建 |
| 核心：PADDT 分段克隆残留 `tb_page_break_before` 逐段强制换页 → 对齐 PTAC | `00e3b7f` | 新增回归测试 |
| v1：结构模式索引错位（渲染文档取索引、原始模板执行删改）→ 结构模式加载原始模板 | `ebd5d20` | 浏览器实测：区块 7→5，绑定保留 |
| v1：postMessage 无 origin 校验 + 日志 level XSS → origin 校验 + 白名单 | `ebd5d20` | 浏览器实测 |
| v1：mustache-lite 缺 `'`/`` ` `` 转义、吞不配对 section → 补齐 + 报错 | `ebd5d20` | node 冒烟 |
| v1：行数滑块跨模板残留、打印预览误注入 bridge | `ebd5d20` | 浏览器实测 |
| 脚本：serve-site 畸形 URL 崩溃、build-site SW 占位符静默失效、validate:v2 未签名误报篡改 | `ebd5d20` | curl / 构建 / CLI 实测 |
| v2：预览报告可伪造 → `event.source === iframe.contentWindow` | `1bc63d7` | 浏览器实测伪造被拒 |
| v2：打印预览 opener 逃逸 → `opener=null` + untrusted 拒绝 | `1bc63d7` | 代码审查 |
| v2：`set_manifest_value` 原型污染 → 拒绝原型路径段 | `1bc63d7` | 浏览器实测 `INVALID_OPERATION_PATH` |
| v2：undo 后 revision 复用破坏乐观锁 → 单调计数器 | `1bc63d7` | 浏览器实测 stale 写入报 `REVISION_CONFLICT` |
| v2：重置信任只翻 flag → 物理剥离 + 内容重推导 + themeCss 逃逸防护 | `1bc63d7` | node 冒烟 |
| v2：i18n 加载失败白屏、SW 离线导航失败、升级横幅不出现、恢复草稿超配额抛错、场景重复选择烧审查次数、findArray 误选数组、网关 JSON 错误契约、`allowExternalHttps` 死锁 | `1bc63d7` | 测试 + 构建 |
| v2：WebMCP 标准注册（navigator.modelContext，双 API）+ 2 个新测试 | `53d4a52` | 100 测全绿 |
| v2：元素级 issues（selector/pageIndex/rect/text）经 validate_project 暴露 | `53d4a52` | 浏览器实测拿到 `header > div > div > h1` |
| v2：质量门错误可点击跳编辑器（含 `/schema`、`/sampleData` 路径前缀统一） | `53d4a52` | 浏览器实测展开+聚焦+闪烁 |
| v2：本地开发 SW 网络优先（修"改了没生效"坑） | `53d4a52` | build:site 盖章验证 |
| 文档：新建 DESIGN/SPEC/EPIC/ROADMAP/TASK 五文档并对齐代码 | `3d6cb8a` | 人工核对 |
| v2：预览问题元素红框 overlay + 开关（bridge 端按 issues 实时重算 rect 绘制，postMessage 指令切换不重渲染） | `1dc2856` | 浏览器实测：注入低对比度主题后红框覆盖 6 处；关闭开关瞬时消失、quality gate 计数不变；切 locale 触发全量重渲染后状态仍保持；100 测全绿 |
| 安全回归测试固化：history 单调 revision、setJsonPath 原型污染、sanitizeExecutableContent、themeCss 逃逸、listenForPreview 来源校验（含伪造/无 source 场景）、mustache-lite 转义与严格 section、gateway 畸形 JSON 契约、draft-cache 超配额安全、sample-scenarios items 优先、set_sample_scenario 幂等 | `4806408` | 新增 8 个测试文件 + 1 处扩展，36 测试文件 136 个测试全绿；顺带修复 vitest 环境下 Node 25 原生 `localStorage` 桩对象遮蔽 jsdom 实现的问题（新增共享 setup polyfill，此前仅 `ui-i18n.test.js` 单文件内 workaround） |
| `examples/README.md` 演示页目录：21 个 index0XX + demo001/002 + 4 个专项测试页，按「基础重复区块 / 多 docinfo·footer 变体 / PTAC·PADDT / N-Up / 页码与真实文档 / 专项边界测试」分组，逐页一句话说明测什么特性 | `d78bd51` | 全部链接指向仓库根目录既有路径校验存在（不移动文件）；浏览器实测抽查 index007（3 表单/6 页/5 分隔符）与 index018（说明为源码注释非页面可见文字，已在描述中标注）二处易误判的页面 |
| CI 扩展：`validate:v2` 校验两个试点导出 + 新增 5 条 Playwright 冒烟（核心库直渲染路径 3 条、Studio v1 结构模式原始模板断言 2 条） | `4a0c5e0` | 重新核实后发现 `e2e/studio-v2.spec.js` 早已有 12 条深度用例（此前 ROADMAP 误判"覆盖少"，已在文档中更正）；真正空白是核心库与 v1，已补齐；本地 `npx playwright test --project=chromium` 全量 18 条通过；用篡改 `protocolVersion` 的样本实测确认 `validate:v2` 对损坏文件返回非零退出码 |
| PR 检查项：新增 `.github/PULL_REQUEST_TEMPLATE.md`，含 `build:assets` 提醒 + 文档同步提醒 + TASK.md 状态提醒三项 | `c081a91` | 模板内 `DESIGN.md` 相对链接校验存在 |
| 黄金样本分页断言：demo001（45 行+PTAC）、delivery_order_test（PTAC+PADDT 组合）、index015（2-up 物理/逻辑页拆分）三页固化页数+每页行分布 | `c081a91` | 新增 `e2e/golden-pagination.spec.js`；**过程记录**：首次手动用 MCP 浏览器抓取 demo001 数据时把 prowitem/ptac 数量看错位（误以为逐页混排），写断言后跑测试立刻炸出 diff——改用 Playwright 自身跑一遍单独探测脚本拿到真实数据（prowitem 全在 1-2 页 [23,22]，ptac 全在 3-7 页 [4,3,3,3,4]）才是准的；另发现一次误报：全量跑 21 条时 1 条 v2 自包含导出测试失败，根因是本机 Playwright 的 `reuseExistingServer` 复用了我手动开的仓库根目录服务器（4174 端口冲突），并非代码回归——清掉手动服务器后 21/21 全绿，此后不再在验证期间保留手动服务器占用该端口 |
| P0-A：operations 判别联合 schema 校验（新增 `core/operation-schemas.js`，复用 `core/schema.js` 引擎，未知 operation 仍走既有 `UNSUPPORTED_OPERATION`，已知类型的缺字段/多字段/类型错误统一 `INVALID_OPERATION_SHAPE`） | `77d9722` | 9 个新单测（8 个 operations.test.js + 1 个 command-bus.test.js 端到端）；浏览器实测：通过真实 WebMCP 网关验证多字段/缺字段两种畸形操作均被拒、revision 不推进，合法操作正常生效（0→1）。**过程记录**：新文件忘记同步 `sw.js` 的 `APP_SHELL` 清单，导致 PWA 离线用例失败（新文件 import 离线 404）——被全量 e2e 跑一遍当场抓到并修复，未提交带 bug 的版本；已把这个坑写进 ROADMAP.md §3 供下次新增文件时参考 |

| 高层语义工具第一批：`set_column_widths`（支持逗号分隔复合选择器同步多张表）、`set_font_scale`（整体平移 7 级字号刻度，替换旧注入块不重复） | `46254d6` | 10 个新单测（6 个 column-widths 含真实 `.prowheader`/`.prowitem` 分离表场景 + 2 个 font-scale + 2 个既有 typography 测试保持通过）；浏览器实测：对 Sales Invoice 真实模板一次调用同步表头+数据行列宽、字号从 9pt 平移到 12pt，截图确认视觉变化，`validate_project` 零错误、0 溢出、0 对比度问题 |

| Apply 前并排 diff 面板：新增 `ui/diff-view.js`（LCS 逐行对比，JSON 段先 stableStringify 避免键序误判，>1500 行自动跳过高亮防卡顿），替换 `window.confirm` 单行文本；新增 `#source-diff-modal` + 6 个新 i18n key×5 语言，清理已失效的 `source.none`/`confirm.applySource` | `ebf3931` | 6 个 diffLines 纯逻辑单测 + 1 个新 e2e（apply/cancel/无变更三路径）；浏览器实测：JSON 段（manifest 标题变更）红绿高亮正确、原始 HTML 段（模板追加行）正确识别为纯新增、trust 降级单独渲染"trusted → untrusted"、Cancel 后 revision 与草稿完全不变、移动端视口正确堆叠为单列、全程控制台零报错；159 单测 + 22 E2E 全绿 |
| P0-B #4（部分）：渲染行数完整性校验——`inspectRenderedDocument` 新增 `expectedRowCount` 参数，对比 `.prowitem_processed` 实际渲染数与 `bindTemplate` 绑定数，不一致报 `ROW_COUNT_MISMATCH`（新错误码，5 语言 i18n） | `af73a23` | 5 个新单测（含修正 `runtime.test.js` 原有 mock 未模拟真实 class 改名的失真问题，并新增"丢一行"回归用例）；浏览器实测：Sales Invoice 1/45/100/500/长文本 5 个场景 + Purchase Order 空/1/45/500 4 个场景，`renderedRows`/`expectedRows` 全部相等、零误报；164 单测 + 22 E2E 全绿。**仅覆盖"数量"，不含稳定 identity/顺序校验**（见下方待办拆分） |

| P0-B #16：行顺序 + 稳定 identity 校验——`binding.js` 给每个 `data-pf-each` 展开的行打 `data-pf-row-index`（源数组下标），`inspectRenderedDocument` 新增 `ROW_DUPLICATE_INDEX`/`ROW_MISSING_INDEX`/`ROW_ORDER_MISMATCH` 三个错误码，无标记的旧版导出文档自动跳过不误报 | `a81eb32` | 8 个新单测（binding.test.js 1 个验证打标、acceptance.test.js 6 个覆盖三种错误+通过+跳过、含"交换两行但数量和集合都对，只有顺序检查能抓到"的针对性用例）+ 1 个新 e2e；**验证方式的教训**：想在 Node 里手写脚本重新拼装 window/document/performance 全局对象来验证真实 dist 包渲染，撞上 jsdom 的 `Performance.now()` brand-check 死循环——放弃手工拼装，改用 Playwright 读取沙箱 iframe 内部 DOM（`page.frameLocator` 能穿透 `sandbox="allow-scripts"` 无 `allow-same-origin` 限制，因为走 CDP 而非页面自身 JS），拿到真实 45 行发票渲染后 `data-pf-row-index` 严格等于 `[0..44]` 的确凿证据；170 单测 + 23 E2E 全绿 |
| P0-B #17：重复区缺失 + 相邻区块重叠检测——`data-repeat-header`/`data-repeat-docinfo` 为"y"时每页必须有对应 `_processed` 区块（`HEADER_MISSING`/`DOCINFO_MISSING`）；`.printform_page` 直接子元素纵向矩形重叠报 `SECTION_OVERLAP` | `535c58c` | 15 个新单测（含正/负两个方向各 2 个：有/无重复标记、有/无重叠）；**双向浏览器实测**：正常渲染 Sales Invoice/Purchase Order 全部行数场景零误报，然后人为剥离模板里的 `pheader` class 确认 `HEADER_MISSING` 正确触发+撤销恢复，再人为给 `.pdocinfo_processed` 主题注入 `margin-top:-60px` 确认 `SECTION_OVERLAP` 触发（截图可见标题与地址块视觉重叠），Quality gate 正确列出该错误码；175 单测 + 23 E2E 全绿。**踩坑**：第一次注入负 margin 的 CSS 选择器写的是原始 `.pdocinfo`（分页引擎已把 class 改名为 `pdocinfo_processed`，选择器落空、规则从未生效）——这是本 session 第三次撞到"处理后 class 被改名"这个模式，改选择器后阳性测试才真正触发 |
| P0-A #12+#13：候选项目在复用的可见预览 iframe 中真实渲染 + candidateHash 缓存——`CommandBus` 依赖注入可选 `renderCandidate(project, revision)`（无 DOM 时保持静态校验，零回归）；`app.js` 的 `renderCandidateForPreview` 复用 `renderPreview()`/`#preview-frame`；新增跨 iframe reload 的单调请求 token（`previewToken`/`pendingCandidateRenders`），人类编辑防抖与 Agent 候选预览共享同一排序，原 #15（nonce）需求由此满足并入本项；`preview_changes`/`apply_changes` 用 `sha256(stableStringify(candidate))` 算 `candidateHash` 缓存真实 render report，apply 命中缓存跳过重渲染、未命中退化为内联渲染再提交；候选渲染期间显示 `#candidate-preview-banner` 提示 | `f4ca539` | 8 个新单测（command-bus.test.js 6 个覆盖无渲染器零回归/真实校验合并/缓存复用/直接 apply 无预渲染/RENDER_FAILED/no-op 不触发渲染、preview.test.js 2 个覆盖 token 回显与 JSON 转义）+ 1 个新 e2e；**浏览器实测**：45 行发票 `set_font_scale` 从 9pt→14pt，`preview_changes` 返回真实 `logicalPages` 从 3 变 4（证明真实分页而非静态校验），`candidateHash` 非空；`apply_changes` 用同一 operations 返回**相同** `candidateHash`（证明缓存命中，未重渲染）；人工"Preview and apply"走 UI diff 面板全程正常、修改后 Revision 正确递增、控制台零报错。**踩坑（两处）**：(1) 最初把候选渲染超时定为 6 秒（沿用早前"~1 秒"的乐观估计），实测 500 行+13pt 字号的真实渲染在本地沙箱浏览器里跑到 47+ 秒（`PrintForm.formatAll()` 尚未做 P2/E9 计划中的行高预测量优化），改为 30 秒宽松兜底（只防真卡死，不是性能预算）；(2) 图快直接用 `npx playwright test` 单独跑新用例（跳过了 `test:e2e` 的 `pretest:e2e` 自动重建钩子），其 `webServer` 指向的 `site-dist/` 还是改代码前的 `build:site` 构建快照——e2e 新测试第一次跑时 `candidateHash` 稳定复现 `undefined`，用独立 Playwright 脚本对比同一浏览器直接测源码根目录才定位到是陈旧构建快照，不是代码问题；改用 `npm run test:e2e` 或先手动 `npm run build:site` 后即正常 |
| P0-A #14：Agent Contract 版本声明——`AGENT_CONTRACT_VERSION` 从 1.1.0 升到 1.2.0，`get_capabilities` 新增 `capabilities: { candidateHash, candidateRealRender }` 字段；`preview_changes`/`apply_changes` 的工具描述文本更新为提及真实渲染 + candidateHash | `bda0379` | **范围经用户确认后与路线图原计划不同**：路线图原设想是把 `apply_changes` 改成只认 `previewId`/hash、不再接受直接传 `operations[]`（破坏性两阶段提交，理由是"Agent Contract 2.0 不保留 1.x 写路径"）；但 #12/#13 实际实现的 `apply_changes` 仍然接受直接传 `operations[]`（未命中缓存时退化为内联渲染），已经达成"不提交未经真实验证候选"的信任目标，且这条路径已经过实测验证、有真实调用方依赖。就这个具体分歧点征询用户后，选择了"仅升版本号声明新能力，不改行为"（次版本号 1.2.0，非 2.0.0），保留现有回退路径不删除。1 个新单测（get_capabilities 覆盖有/无 renderCandidate 两种 `candidateRealRender` 取值）+ 已有 `agent-bootstrap.test.js` 断言同步更新为 1.2.0；浏览器实测：`get_capabilities` 返回 `contractVersion: "1.2.0"`、`capabilities: { candidateHash: true, candidateRealRender: true }`；184 单测 + 24 E2E 全绿。**遗留观察（非本次修复范围）**：契约版本号在 `core/constants.js`、`agent-setup.json`、`llms.txt` 三处手工同步维护，是重复事实来源，未来若再次遗漏某一处会造成 agent 引导材料与真实契约不一致；本次已同步全部三处 |

| P0-B #18：Studio 签发布局验收证据 + Agent Contract 2.0.0——新增第 16 个工具 `capture_layout_evidence`（把场景渲染成未提交候选并签发 receipt，不推进 revision）；`inspectRenderedDocument` 输出 `pageGeometry`（每页直接子元素 class + 页内相对整数矩形，无业务文本）；`complete_layout_review` 改为只接受 `evidenceIds`，旧式 `evidence`/`browser`/`scenarios` 自述字段一律拒绝 | `1e6cb3e` | **证据形态经 grilling 确认为几何指纹而非像素截图**：沙箱 iframe 不透明 origin 让父页读不到 DOM，像素只能走 foreignObject→canvas（canvas 污染风险 + 保真缺陷 + 单张数 MB + 真实数据模式下像素即业务数据，与隐私策略冲突），而"防 Agent 伪造"的目标由给 Studio 自己的测量结果签名即完整达成。9 个新/改单测（layout-review.test.js 重写为 10 个：正向通过、旧式拒绝、伪造 id 拒绝、场景不全拒绝、mutation 失效、指纹按场景不同、渲染不干净不签发但返回原因、无渲染器 `EVIDENCE_UNAVAILABLE`、捕获不推进 revision）+ 1 个新 e2e；193 单测 + 25 E2E 全绿。**浏览器实测**：真实签发 default/long-text 两张 receipt（指纹确实不同、revision 保持 0、browser 正确识别为 Chromium 148），旧式自述字段被拒 `EVIDENCE_RECEIPT_REQUIRED`、伪造 id 被拒 `EVIDENCE_UNKNOWN`、只给 default 被拒 `REVIEW_SCENARIOS_REQUIRED`、齐全后审查通过且 `request_export` ready；随后 mutation 一次，确认 receipt store 被清空（旧 id 报 `EVIDENCE_UNKNOWN`）、导出重新被 `LAYOUT_REVIEW_REQUIRED` 阻断；全程控制台零报错。**顺带修复**：`agent-setup.json` 的 `verification.expectedCommandContractVersion` 在 #14 那次漏改（仍是 1.1.0），会让照此引导的 Agent 拒绝一个完全正确的 Studio——已新增一个单测把版本号/工具数从代码推导校验，四处手工副本不再靠人记；`mcp-server.test.js` 的工具数硬编码也改为从 `TOOL_CONTRACTS.length` 推导。**另修一个既有 e2e 竞态**（非本次引入，但被新测试加重的并行负载暴露）：`studio-v1.spec.js` 用 `#status-a` 的 `/\d/` 当渲染完成信号，会匹配上一个模板遗留的状态甚至 "0 页"，导致在 iframe 重载间隙数到 0 页；改为直接等待 `.printform_page` 可见，修复前 3 次全量跑挂 1 次，修复后连跑 4 次全绿 |

| P0-B #19：Attestation 补全——新增 `printformRuntimeHash`（此前只哈希 document runtime，换掉分页引擎不会被任何检查发现）与 `cspScriptHashes`；`browsers` 从硬编码 `["Chromium","Firefox","WebKit"]` 改为由 #18 的 evidence receipt 推导（无审查的导出为空数组，诚实留空）；`verifyImportedProject` 与 `validate:v2` 同步校验第二段 runtime，用独立错误码 `PRINTFORM_RUNTIME_HASH_MISMATCH` 与 document runtime 区分 | `63513b2` | 3 个新单测（双 runtime + CSP hash 写入且与实际 CSP 一致、篡改分页引擎只触发 `PRINTFORM_RUNTIME_HASH_MISMATCH` 而非 document runtime 的、browsers 有/无审查两种取值）+ e2e 下载用例新增 attestation 断言（双 hash 不同、cspScriptHashes 与文档 CSP 匹配、browsers 恰好一个、layoutReview 含 2 张 evidence）。**CLI 实测**：重新构建后两个试点样本 `validate:v2` 全过（`printformRuntimeHashValid: true`）；往 `pf-printform-runtime` 注入一行代码后，只报 `PRINTFORM_RUNTIME_HASH_MISMATCH`（document runtime 与 content hash 仍 valid，证明错误码分离有效），退出码 1，干净文件退出码 0。196 单测 + 25 E2E 全绿。**已知 fail-closed 破坏**（范围内已确认）：本次之前导出的文件不含 `printformRuntimeHash`，重新导入降级 Untrusted |

| 契约版本第五处副本：Agent 连接面板的「Command contract」在 `index.html` 里硬编码 `1.1.0`，跨过 1.2.0 与 2.0.0 两次升级都没改，面板显示的版本与 `get_capabilities` 实际返回的不一致 | `5e563c4` | 修法不是把数字改对，而是让它**发空值、启动时从 `AGENT_CONTRACT_VERSION` 填**——最坏情况留白，不会理直气壮显示错的。新增单测断言发布的 HTML 里该元素必须为空，字面量无法溜回来（延续 `1e6cb3e` 的守卫思路，不再写"下次记得改"的提醒）。**未动** `mcp/server.mjs` 的 `serverInfo.version`：那是 stdio 服务器自身实现版本，与契约版本是两个概念，数字只是碰巧相同。浏览器实测面板与 `get_capabilities` 均为 2.0.0；197 单测 + 25 E2E 全绿 |

| **CI 自 `c081a91` 起连红三个提交**：`golden-pagination.spec.js` 的行分布黄金数字从 Chromium 抓取却断言给全部三个引擎，Firefox 不一致（Chromium/WebKit `[17,21,10,0]`，Firefox macOS `[15,20,13,0]`、CI Linux `[16,20,12,0]`——同引擎跨 OS 都不同）。本地始终绿是因为**本机没装 Firefox/WebKit**，我一直只跑 `--project=chromium` | `5e563c4` | 改法：跨引擎只断言不变量（总行数守恒 48、PADDT 页无数据行、ptac/paddt 落位数组——实测三引擎完全一致），精确分布用 `test.skip(browserName !== "chromium")` 只钉 Chromium 基准，与既有性能预算用例和 ROADMAP P3「不比较跨引擎像素一致性」一致。demo001 与 index015 三引擎确实一致，保持无条件断言不放松。装好 Firefox/WebKit 后本地跑全量三引擎：65 通过 / 10 跳过 / 0 失败。**教训已写入 ROADMAP §2.1 第三条陷阱**：涉及渲染结果的断言合并前必须跑不带 `--project` 的全量 e2e，push 后 `gh run list` 确认，别拿本地单引擎的绿当 CI 的绿 |

| 浏览器矩阵验收（P0-B 退出条件的发布流程部分）：新增可复用脚本 `scripts/browser-matrix.mjs`，跑两模板 × 4 目标（Chromium/品牌 Chrome/Firefox/WebKit）× 全边界场景（空/1/45/100/500 行 + 长文本）× 5 打印语言 | `2de7b73` | **88/88 全过**，零溢出/零丢行/零对比度失败；`empty` 按设计正确阻断（脚本把它列为预期 blocked，不当失败）。结论存档 [docs/BROWSER_MATRIX.zh-CN.md](docs/BROWSER_MATRIX.zh-CN.md)。**诚实说明**：4 个目标实为 3 个引擎（Chromium 与 Chrome 同引擎，WebKit 非真 Safari，Edge 未装），已写进报告不含糊。**带出一个待决策项**（见下方待办）：Purchase Order 分页随引擎变化，实测定位根因——行高两引擎完全相同（42.00px），差异全在 docinfo+页脚合计高出约 2.56px，而该模板装满 15 行后**只剩 1.42px 余量**，所以 Firefox 掉到 14 行、500 行时多出 2 张纸；Sales Invoice 余量充足，四目标逐页行数完全一致。**探测方法教训**：第一版探测用「页高 − 行高×行数」反推"非行区域"，这是循环论证（结果必然等于差一行），证明不了任何东西——必须逐区块实测才定位到真正差异 |

| Purchase Order 跨引擎分页收敛：`.pf-page-footer` 的 padding-bottom 12px→28px（非行区 +16px），让 引擎×语言 全部 15 个组合落到每页 14 行 | `4b0cdc1` | **完整机制**：数据行高三引擎完全相同（42.00px，字号不是问题），差异全在非行区块合计高度随 引擎×语言 在 386.58–411.20px 波动（跨度 24.62px ≈ 0.59 行），导致可用空间 612.80–637.42px = 14.59–15.18 行，**恰好跨在 15 这个整数边界上**。修法是把整段移到边界同一侧：解 `637.42−K<630` 且 `612.80−K≥588` 得 K∈(7.42, 24.80]，**取中点 16** 让上下各留约 8.6px，而不是贴着 7.42 那端（那只是换个悬崖站）。对模板改一次、所有浏览器同一份 CSS，**不做浏览器嗅探、不按引擎调字号**。已在 CSS 里写长注释说明约束，防止后人"顺手整理"改回去。**验证**：全量矩阵 88/88 通过且 22 个可比格子零分歧；三引擎全量 e2e 65 通过/10 跳过/0 失败。**代价**：每页少一行，页数多约 7%（500 行 34→36 页）。未采用反方向的"压缩 24px 保住 15 行"，因为省纸 7% 不值得重新设计已交付试点版式。**弯路记录（两处）**：(1) 先试 6px 并用只跑 en-MY 的聚焦探测判定"收敛"，**结论是错的**——全量矩阵里马来语仍分歧、日语方向还反转；窄范围的绿不等于绿。(2) 测量脚本两次有缺陷：一次用 `页高−行高×行数` 反推非行区（循环论证），一次误以为数据行在单个 `pf-grid` 容器内，实际**每行是独立 `<table>` 直接挂在页面下**，按 class 首 token 分组会把行头表和 15 个行表加成一个数——涉及数字的结论要先验证分解本身 |

| P1（部分）：表格列宽 + 打印字号缩放面板——`set_column_widths`/`set_font_scale`（`46254d6`）此前只能通过手改 Raw Template HTML/Theme CSS 触达。新增 `core/column-inspection.js` 的 `inspectColumnGroups()` 从模板发现 `.prowheader`/`.prowitem` 列组，标签经真实 i18n 目录解析（非硬编码）；`typography.js` 新增 `currentFontBasePt()` 从 themeCss 读回当前基础字号。两个面板都遵循既有 `set_locale`/`set_asset_source` 的直接应用模式（无 diff 弹窗） | `90a6c70` | 8 个新单测（4 个 currentFontBasePt + 4 个 inspectColumnGroups，含"无匹配数据表退化为仅表头选择器"与"模板无表格返回空列表"两个边界）；206 单测 + 65 E2E（10 跳过）全绿。**浏览器实测**：Sales Invoice 面板正确列出 5 列真实标签（No./Description/Qty/Unit/Amount）与当前宽度；字号 9pt→11pt 后预览可见文字变大、Amount 列被推出视口；Description 列宽 空→30% 后预览可见列变宽；切换 Studio 界面语言到中文后动态生成的按钮文案与占位符正确重新翻译；全程控制台零报错。**踩坑**：最初把这两个面板写成直接调用 `bus.execute("set_font_scale", …)`/`bus.execute("set_column_widths", …)` 当作独立 CommandBus 工具——浏览器实测立刻报 `Unknown tool`，因为这两个只是 `operations[]` 里的**操作类型**（不像 `set_locale`/`set_asset_source` 那样有专属包装工具），改为经通用 `apply_changes` 工具传入单个 operation 后行为正确；这类"从摘要读到*已实现*就假设 API 形状"的错误，**必须在真实浏览器里点一下才会暴露**，光跑单测不会发现（两个新单测只验证纯函数，不经过 CommandBus） |

| P1（部分）：Page settings + Repeated areas 面板——页面尺寸（`data-papersize-width/height`）与七个 repeat-* 标记（header/docinfo/rowheader/ptacRowheader/footer/footerLogo/footerPagenum）都只是 `.printform` 根元素上的 data-* 属性，**没有专属操作类型**，不像 set_column_widths/set_font_scale 那样；改为经通用 `set_attribute` 操作（每属性一条，同一 `apply_changes` 里打包多条，一次点击一次 revision）。新增 `core/page-inspection.js` 的 `inspectPageSettings()`/`inspectRepeatFlags()` 只读回两个标准模板实际用到的字段，不覆盖 `src/printform/config.js` 里更大的引擎级配置面（如 docinfo002-005、footer002-005、PADDT 专属配置等） | `8f0718b` | 7 个新单测（含"模板缺 papersize 属性返回 null 而非 0"——`Number(null)` 恰好是 finite 的 0，必须先 `hasAttribute` 再转数字，否则静默返回假数据；以及"模板没设的 flag 不猜引擎默认值，直接跳过"）；213 单测 + 65 E2E（10 跳过，1 次 Firefox 超时复测后确认是并行负载导致的既有 flake、非本次改动引入，已建 spawn_task 另行根查）全绿。**浏览器实测**：Sales Invoice 页高 1050→1200 后 `logicalPages` 从 3 变 2（45 行默认样本装进更少页，数值证据而非肉眼判断）；Footer 标记 关→开后面板正确读回 `true`；Restore 恢复草稿后两个面板都正确显示恢复后的值（非仅 revision 计数器）；切到 Purchase Order 模板（通过真实 `change` 事件，而非只设 DOM value——因为 `document-select` 的 change handler 有 `window.confirm` dirty-guard，自动化 `form_input` 设值不触发确认对话框会被脏检查静默复位）后两个面板正确显示该模板的真实值（750×1050、7 个 flag、7 列）；全程控制台零报错。**范围收敛**：Branding 配色（无现成 CSS 变量约定）与 Data contract 表单编辑器（无现成操作、量级堪比独立功能）经用户确认后未纳入本批，需要单独一轮范围讨论 |

| D2（部分）：新增 `CHANGELOG.md`（Keep a Changelog 格式，`[Unreleased]` 一段——`package.json` 版本号仍是占位 0.0.0，尚无正式 SemVer 发布可归档，D1 独立 SemVer 决策留待用户确认），只收录读者视角的"改了什么"，不复制 TASK.md 的工程日记式踩坑细节；README.md 与 README.zh-CN.md 的文档导航各加一行链接到 CHANGELOG 与 LICENSE | `5d06702` | 纯文档新增，无需测试（213 单测复跑确认无回归）；核对 CHANGELOG.md/LICENSE 两个链接目标文件均存在 |

| P1（部分）：Branding 品牌色面板——两个标准模板把品牌色硬编码成十几处原始 hex 字面量（表头背景、边框、PO 汇总框等），**不像字号那样早已走 `--pf-font-*` 变量**；把整套用色都改成 token 是量级明显更大、更主观的设计活。范围收敛到唯一一处：`.pf-brand` 标题文字色——两个模板里字面意义上"brand"的那个元素。新增 `core/branding.js`（`currentBrandColor`/`setBrandColor`，镜像 typography.js 的注入模式）+ `set_brand_color` operation，两个模板各自的 `.pf-brand { color: #hex }` 改为引用 `var(--pf-brand-color)`；UI 用原生颜色选择器 + 文本框配对（支持 3/6 位 hex 直接输入），经通用 `apply_changes` 直接应用 | `d2fe47a` | 9 个新单测（5 个 branding.js 纯函数 + 4 个 operations.js 集成，含 3/6 位 hex 接受、非法值拒绝）；221 单测全绿。**浏览器实测**（用独立端口 4180 起服务，因为 4174 当时被用户另开会话的 e2e 排查任务占用，特意避让不干扰）：Sales Invoice 面板正确读回 `#173d9a`，改成 `#e91e63` 测试色后标题文字确实变色，且质量门**正确报出新的 `CONTRAST_FAILURE`**（证明改色后走了真实重渲染+对比度重新校验，不是只改了个不生效的摆设）；改回原色后错误消失；Purchase Order 模板正确读回 `#8f1525`；全程控制台零报错。**范围仍收敛**：Data contract 表单编辑器依旧留待单独范围讨论，未纳入 |

| P1（部分）：Data contract 面板——经 grilling 确认为中档范围：schema 树形只读展示 + 表单编辑样本数据的标量/嵌套对象字段 + 编辑既有约束（required/minLength/maxLength/minimum/maximum/enum）。**不做**：增删字段（牵动模板绑定与 i18n 目录同步，留待单独设计）、数组逐行编辑（45 行表单没有可用性，`items` 类字段只显示只读提示，仍走原始 JSON）。新增 `core/data-contract-inspection.js`：`inspectDataContract()` 递归展开 `schema.properties` 成字段树并配上真实样本值；`applyDataContractEdits()` 接收一批 `{path: edit}`，返回克隆后应用编辑的新 schema/sampleData，不改动入参。面板复用既有的 `replace_schema`/`replace_sample_data` 整段替换操作，一次 `apply_changes` 同时提交两者——跟 Repeated areas 打包多条 `set_attribute` 是同一个模式，不需要新操作类型 | `3699991` | 11 个新单测（7 个 data-contract-inspection.js 纯函数 + 4 个既有面板不受影响的回归）；232 单测 + 65 E2E 全绿，`npm run doctor` 3/3 PASS。**浏览器实测踩坑**：应用处理器无差别查询所有 `.dc-field` 行读 `required` checkbox，但数组类型的行只渲染只读提示、没有控件，一提交就报 `Cannot read properties of null`——单测测的是纯函数不经过这条 DOM 收集逻辑，**必须在真实浏览器点一次才会暴露**（跟本轮 B1/B2 那次"以为已实现就假设调用形状"是同一类教训：光跑单测不会发现 UI 层的收集逻辑漏洞）。修复后重新实测：Sales Invoice 正确展开 seller/customer/reference/totals 分组 + 3 个顶层标量 + items 数组提示；改 `/invoiceNumber` 样本值+maxLength 后 revision 推进、预览发票号确实变了；切换 `/seller/name` 的 required 关闭后原始 schema 编辑器文本框同步确认已从 `required` 数组移除；Purchase Order 模板分组与字段结构同样正确；全程控制台零报错 |

| P2（部分）：核心分页引擎行高预测量缓存——经 grilling 确认的切入顺序第一项（缓存 → trace 事件 → PaginationSession 类重构再评估）。**先用 `spike/generate-perf-spike.mjs`（gitignore，不入库）搭一个独立环境画像**：直接跑 `dist/printform.js` 排 500 行发票，包一层 `getBoundingClientRect`/`getComputedStyle` 计数计时，而不是先猜架构再改——结果显示 72% 的耗时（3.6s/5s）都在 `getBoundingClientRect` 里，根因是 `renderRows()` 每行都做"追加 DOM→强制回流测量"的读写交替（layout thrashing），且 `measureHeight(row)` 每次迭代都重新测量，即使跳过容器测量，下一行的行高测量照样会把刚才的 DOM 变更强制回流掉——两个问题必须一起改才有效。改动两处：①在循环开始前一次性批量预测量全部行高（消灭读写交替）；②非页边界的普通行用已知行高做 `currentHeight + rowHeight` 的算术预测，预测值留 50px 安全余量后仍低于页限就跳过容器回流测量直接追加——行天生用固定宽度（`paper_width` 类或显式 `width`，不继承可变宽度祖先），实测 `.prowitem` 的 `margin-top`/`margin-bottom` 均为 0px，故无 collapse 顾虑，安全余量只是对未覆盖模板的保险，非已知缺口的遮羞布；越过边界仍走原有的精确"追加→测量→必要时撤销重试"路径，完全不变 | `4c50a35` | 金标准分页断言（demo001/delivery_order_test/index015）三引擎逐页行分布**字节不差**——这个改动只改"怎么算"，不改"算出什么"；232 单测 + 66 E2E（新增 1 条）全绿，`npm run doctor` 3/3 PASS。**spike 量化**：500 行+13px 字号，总耗时 4991ms→约 3300–3520ms（多次复测），`getBoundingClientRect` 累计耗时 3594ms→约 1050–2050ms，`pageCount` 全程稳定 23。**真实 Studio v2 场景**（DESIGN.md §4.4 历史记录"500 行+13pt 候选渲染跑到 47 秒以上"的原场景）复测两次分别为 1134.5ms、523.1ms——**不是同一份代码的受控前后对比**（历史数字来自更早、条件不同的一次测量），因此不引用具体倍数，但明确稳定落在 5 秒预算内，余量充足。新增 e2e 用例把"500 行+放大字号"这个具体组合钉成永久回归护栏——此前唯一的性能预算用例只测过默认 9pt，这个曾经的真实痛点组合此前完全没有自动化测试覆盖 |

| `e2e/studio-v1.spec.js` 在满负载并行套件下偶发超时（本 session 撞到 3 次，均在 Firefox，均为不同用例、均在单独重跑时秒过）——真正根因确认为**两条链式 `expect().toBeVisible({timeout:20_000})` 加起来逼近文件 45s 的整体超时**，不是等待逻辑本身有假死：抓到一次"超过 20s 超时"的失败现场，渲染其实已经完整跑完 8 页，只是在满负载下比 20s 慢。修法：单条等待超时 20s→40s，并显式设 `test.describe.configure({timeout:120_000})` 给两条链式等待留够余量；同时把本机 Playwright 并发 worker 数从 5 降到 3，减少三引擎同时跑的内存/CPU 争抢 | `94f2c7e`（另一个并行 session 完成并经 `1bb53aa` 合并） | 连续 3 次 `npx playwright test` 全量跑（不带 `--project`）**65/65 全过、零 flake**（此前同类满负载跑法平均 3 次里挂 1 次）；`npx vitest run` 221 单测同步复跑确认无回归（该修复只碰 e2e 配置与用例本身）|

| D1：四条独立 SemVer 线落地——引擎 `1.0.0`（[src/version.js](src/version.js) 为 SSOT，`PrintForm.version` 运行时暴露）、Studio v2 `0.9.0`（`STUDIO_VERSION`，刻意低于 1.0.0：版本号不得声称一个维护者尚未宣布的成熟度，升 1.0.0 留给显式宣布 Production Ready 那一刻）、协议与 Agent Contract 保持 `2.0.0` 不动；`package.json` 从占位 `0.0.0` 跟到引擎线。新增 [docs/COMPATIBILITY_MATRIX.zh-CN.md](docs/COMPATIBILITY_MATRIX.zh-CN.md) 说明四条线为何必须拆开（真实例证：Agent Contract 2.0.0 那次破坏性变更**没动导出文件一个字节**，共用版本号会强迫协议跳 major，等于向所有已交付 HTML 的持有者广播一个不存在的破坏性变更）+ 派生副本与防漂移对照表 | `5cea34f` | 4 个新单测（`tests/version.test.js`：四线均为合法 SemVer、package.json 必须等于 `PRINTFORM_VERSION`、`PrintForm.version` 必须等于 SSOT、**ROADMAP 仍写 Production Pilot 时 Studio 主版本号必须为 0**）；225 单测 + 65 E2E 全绿，`npm run doctor` 3/3 PASS。**反向验证守卫非空跑**：临时把 `STUDIO_VERSION` 改成 `1.0.0`，第 4 条测试确实变红，还原后恢复绿。**浏览器实测**：`PrintForm.version` 返回 `1.0.0` 且 demo001 仍正常渲染 8 页（未破坏引擎行为）；拦截诊断包 Blob 确认 payload 为 `studio: 0.9.0` / `agentContract: 2.0.0` / `protocol: 2.0.0`。**顺带修掉一个真实漂移 bug**：`downloadDiagnostics()` 里 `studio` 字段被硬编码成 `"2.0.0"`——那其实是**协议版本被复制到了描述 Studio 的字段上**，以致此前每一份诊断包都在报告一个从不存在的 Studio 版本。**刻意不做的事**：引擎版本号没有放进诊断包，因为 `src/` 不在 `build-site` 的拷贝白名单里，studio-v2 运行时 import 会在部署站点 404；为了填一个诊断字段就把版本号复制进 studio-v2，等于重新制造这次要根治的重复事实源 |

| E11：新增 `npm run doctor`（ROADMAP §2.2 早已列为计划项）——一条命令依次跑单测+生产构建（`build:site`，内含 vitest --run）+ 两个试点样本 `validate:v2`，每步实时输出，结尾一页 PASS/FAIL 汇总 + 汇总耗时，任一步失败则整体退出码非零。刻意不含 `test:e2e`：那是 CI 每次 push 都跑的三引擎慢检查，doctor 定位是本地"工作树健不健康"的快速一问，不是发布门禁的替代品 | `07b3947` | 实跑一次：3 步全 PASS（单测+构建 7.4s、两个 validate:v2 各 0.6s），退出码 0；纯工具脚本，逻辑简单（检查每步 `spawnSync` 的 `status === 0`），未加专属单测，与 `browser-matrix.mjs`/`validate-printform-v2.mjs` 等既有纯脚本一致不强制加测试 |


| A3：浏览器矩阵验收在真实 Linux（GitHub Actions Ubuntu runner）上跑通——`.github/workflows/browser-matrix.yml`（`workflow_dispatch` 手动触发，不进 push/PR 快速通道，理由同 `scripts/browser-matrix.mjs` 自身注释：15–25 分钟不适合当每次提交的门槛） | `af64b25` | 用户 push 后手动触发 [Actions run 30632832821](https://github.com/yapweijun1996/printform-js/actions/runs/30632832821)，全量 88 格（非 `--quick`）用时约 95 秒，**88/88 全过、零分歧**，四目标（含品牌版 Chrome）全部成功启动无 SKIP；Purchase Order/Sales Invoice 45 行场景逐页行数与 macOS 结论完全一致（`[14,14,14,3]`/`[24,21,0]`），证明 K=16px 收敛修法不是 macOS 专属巧合。结论存档 [docs/BROWSER_MATRIX.zh-CN.md](docs/BROWSER_MATRIX.zh-CN.md)「Linux 复现」一节。**Windows 仍无自动化通道，维持待办**（GitHub Actions 无现成的 Windows+四浏览器方案） |

| P2（评估，非实现）：`PaginationSession`/`PageContext`/`LayoutPlan`/`RenderResult` 类重构——按 grilling 定的顺序（缓存→trace→类重构再评估）走到第三步。**先看 P2 的退出条件本身**：100 行首屏 ≤2s、500 行完整分页 ≤5s、v1 无回归——这三项在缓存那一步（`4c50a35`）已经达成且有金标准分页断言 + 新回归护栏背书，退出条件不要求这批类存在。**再看现状**：`pagination-context.js` 已经有一个每次渲染新建的轻量 `pageContext` 纯对象（`initializePageContext`），被拆分到 formatter 的多个 prototype mixin 里共享读写，已经过 232 单测 + 三引擎 e2e 反复验证；把它和新造的 `PaginationSession`/`LayoutPlan`/`RenderResult` 重新包装成正式类，不修复任何已知 bug、不满足任何未达成的退出条件、也没有具体消费方提出这类结构化返回值的需求——唯一的价值是"更规整"，但代价是再次改动刚刚精心修复并验证过的分页热路径，且改动面横跨 formatter 全部文件。**结论：评估后判定暂不值得做，非放弃、非遗忘，是"无具体驱动力时不为假设中的未来需求设计"的主动决定**（本仓库工程纪律，见 CLAUDE 系统指令）；若未来出现具体驱动力（例如多个独立消费方需要检视分页中间态、或某个真实 bug 追根溯源到当前隐式 context 传递方式），再重新评估。同一决定连带跳过结构化 trace 事件——它在原计划里唯一的价值就是为这批类重构做准备，重构本身既已判定不做，trace 事件也一并延后，不单独实现。**顺带记录一个不在本次评估范围内、决定不牵连的独立小缺口**：`formatAllPrintForms()`（`src/printform.js:82-84`）单份表单渲染失败时只 `console.error` 记录并继续下一份，不把错误反映进返回值——Studio v2 的 `inspectRenderedDocument` 结构校验会间接兜底（渲染失败的表单不会产出预期的分页 DOM 形状，会被结构检查捕获），所以不是静默漏检风险，只是丢失了具体错误信息；范围小、风险低、与类重构决策无关，留作独立待办，不在本次动作中实现 | 无 commit（评估结论，非代码变更） | 无需新测试（未改动任何代码）；核对 `pagination-context.js`（55 行，`initializePageContext`/`refreshPageContextForRow`/`computeRepeatingHeightForPage`/`measureContentHeight` 四个方法）与 `src/printform.js:43-91`（`formatAllPrintForms` 的 try/catch 结构）确认上述现状描述准确 |

## 🔄 进行中

（无）

## ⬜ 待办

**六项 P0 硬门的代码部分已全部完成**（#12–14、#16–19），浏览器矩阵验收也已跑满并全过。

### 宣布 Production Ready 前建议补的一步（非阻塞）

浏览器矩阵已在 **macOS 与 Linux（GitHub Actions Ubuntu runner）** 两个操作系统上跑过，均 88/88 全过、零分歧（Linux 结果见 A3、[docs/BROWSER_MATRIX.zh-CN.md](docs/BROWSER_MATRIX.zh-CN.md)「Linux 复现」）。**仅剩 Windows 未验证**：GitHub Actions 没有现成的 Windows+四浏览器目标方案（`chrome`/`webkit` channel 在 `windows-latest` runner 上的可用性未知，需要单独调研），仍需另行安排；非阻塞。

### 其他候选方向（均未开始、未确认范围）

- **P1 工程师工作流**（EPIC E8）：**六个面板全部就绪**——Table columns（`90a6c70`）、Page settings + Repeated areas（`8f0718b`）、Branding 品牌色（`d2fe47a`）、Data contract（`3699991`，中档范围：查看+改样本值+改既有约束，不含增删字段/数组逐行编辑）与 Locale（原已存在的打印语言选择器），另加一个路线图原列表之外的 Print font scale 面板。P1 阶段的工程实施已无未开始项。
- **P2 分页引擎演进**（EPIC E9）：**核心退出条件已达成**（行高预测量缓存，`4c50a35`，100 行/500 行性能预算均满足）。`PaginationSession`/`PageContext`/`LayoutPlan`/`RenderResult` 类重构与结构化 trace 事件经评估后判定暂不值得做（无具体驱动力，见上方评估记录），非待办、非阻塞。仅剩 `formatAllPrintForms()` 吞掉单表单渲染错误这一独立小缺口留作未来可选项。
- **P3 发布治理**（EPIC E10）：GitHub Release 附两个已验证试点导出（发布材料备妥后由维护者执行 push/tag/release）、版本化模板目录。（LICENSE、SW precache manifest 自动生成、CHANGELOG、独立 SemVer + 兼容矩阵已完成）

## 🚧 阻塞

（当前无阻塞。历史坑已解除：SW 开发缓存 → `53d4a52`；`build:assets` 未重建导致预览用旧 runtime → 已写入 ROADMAP 2.4 + PR 模板；vitest 下 Node 25 原生 `localStorage` 桩对象遮蔽 jsdom 实现 → 共享 setup polyfill；本机手动预览服务器与 Playwright `reuseExistingServer` 端口冲突会产生假失败 → 验证 e2e 前先确认 4174 端口没有手动服务器占用；新增 `studio-v2/` 下被 import 的文件必须同步 `sw.js` 的 `APP_SHELL`（已发生两次，PR 模板已加提醒）；jsdom 环境下手写脚本重建 window/performance 等全局对象会撞 `Performance.now()` brand-check 死循环，需要真实浏览器上下文验证时改用 Playwright 读取沙箱 iframe（CDP 能穿透 sandbox，页面自身 JS 不能）；**手动测试注入 CSS/属性时要用分页引擎处理后的 `_processed` class 名，不是模板原始 class**（本 session 在测试代码和手动验证脚本里各撞到一次）；**大候选文档（大行数+大字号）的真实渲染可能耗时数十秒**，候选渲染超时不能照搬"~1 秒"的乐观估计，30 秒宽松兜底只防真卡死，不是性能预算（该历史场景已由 P2/E9 的行高预测量缓存 `4c50a35` 解决，30 秒兜底本身作为防真卡死的保险仍保留不变）；**`npx playwright test` 直接跑时默认 `webServer` 服务的是 `site-dist/`（`build:site` 构建快照）而非 `studio-v2/`/`studio/`/`docs/`/`img/` 实时源码**——`npm run test:e2e`（CI 用的也是这条）有 `pretest:e2e` 钩子自动重建，不受影响；只有为了单独跑某条用例而直接执行 `npx playwright test` 才会踩这个坑，此时只跑 `build:assets` 不够，必须整跑一次 `npm run build:site`，否则 Playwright 测的是旧代码且不会有任何报错提示，只是行为对不上（已加入 PR 模板提醒范围内的"重新构建"提醒项）。）

## 📌 下一步

P0-A、P0-B 与 E13-SERVER 的当前代码硬门已完成。**注意不要把这读成无条件 Production Ready**：当前认证仍限定为单 writer SQLite service、Chromium reference runtime、人工审批和既定安全门。

推荐下一 Epic：**E14 Durable Service Hardening**——外部数据库/迁移策略、active-active leader/fencing、跨设备浏览器 remote-store wiring、长时间 abandoned cleanup、故障注入矩阵和 artifact blob registry。E14 之前不增加新的 AI 设计能力，也不扩大多用户发布承诺。
