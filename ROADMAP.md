# ROADMAP.md — 路线图与低成本维护策略

> 最后核对：2026-08-17（E13-SERVER Durable Backend Deployment & Recovery Acceptance）。
>
> Studio v2 的 P0–P3 工程路线（依赖、接口、退出条件）的**权威文档**是 [docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)，本文不复制其内容，只补充：① 全仓库视角的阶段顺序；② 让项目**便宜维护**的专项计划（含改进与 debug 方向）。

---

## 0. 当前阶段：Studio v2 Production Foundation（2026-08-17）

状态：🔶 **YES, WITH CHANGES — remain Production Candidate，94/100**。E13-SERVER 的单 writer SQLite 受控部署已通过真实进程/HTTP acceptance；active-active、外部 HA 数据库和浏览器 UI remote-store wiring 仍未认证。

本阶段在现有 Protocol、CommandBus 与 PrintForm runtime 上做最小增量：FormSpec/component registry、Active Table Context、多页确定性诊断、Agent transaction gate、trusted export allowlist、Evidence Pack，以及 E13 durable transaction store/state machine/CAS/lease/recovery/server adapter 已进入代码和测试。仍不扩大为一般 Production Ready，因为当前服务只认证单 writer SQLite 部署，浏览器默认 localStorage 仍是 offline/single-session fallback，Firefox/WebKit/真实 Safari/打印机链也未认证。

已完成的代码门：

- `get_form_spec` / `list_components` 与语义组件操作；旧 HTML 通过 legacy adapter 兼容。
- 多个顺序表格按 active table 重复当前表头；formatter 仍是唯一分页责任方。
- `ROW_TOO_TALL`、overflow、keep-together、footer/page-number、blank page 等结构化诊断。
- `BEGIN → PREVIEW → APPROVE → APPLY → COMMIT`，候选 hash 不一致或失败时回滚。
- trusted export 的脚本/事件处理器/危险 URL/外部资源 allowlist 与 content hash。
- durable transaction store/server adapter：transaction/revision/lease/audit/evidence anchor 持久化；真实 SQL CAS、server clock lease、commit/evidence retry 幂等；发布门失败时 fail closed。

E12 的独立运维任务 `OPS-NANOID`、`OPS-PLAYWRIGHT`、`OPS-WINDOWS-DOCTOR` 已有独立证据；退出条件已满足。E13-SERVER 的 bounded backend 与 acceptance 已完成；后续转向 HA/recovery hardening，不在本阶段增加 AI 功能。

### 0.1 E12 验证记录

- Chromium Playwright `1.62.0` / revision `1234`：**56/56 PASS**。
- Browser matrix：Progress Claim、四个顺序表、100/500/1000 行、A4 @ 96dpi portrait/landscape、13 类 pagination diagnostic、approved export Evidence Pack。
- 工具链（历史 E12）：68 files / 361 unit tests、`build:site`、`check:agrun`、三份 pilot `validate:v2`、Windows `doctor` 5/5、`git diff --check` PASS。
- 供应链：`nanoid 3.3.18`，`npm audit --audit-level=high` 0 vulnerabilities。
- 认证边界：本阶段只认证 Chromium reference runtime；不把历史三引擎矩阵或 WebKit 结果解释为真实 Safari/打印机认证。

### 0.2 E13 实施与剩余门

| 能力 | 当前实现 | 剩余硬门 |
|---|---|---|
| Durable store | `DurableTransactionStore` + localStorage/offline + `SqliteDurableBackend` server adapter | 外部数据库迁移/HA 与 artifact blob registry |
| State machine | `DRAFT → PREVIEWED → VALIDATED → APPROVED → COMMITTING → COMMITTED`，含 expired/conflicted/recovery paths | 长时间 TTL/cleanup policy 的部署参数 |
| CAS | SQLite `BEGIN IMMEDIATE` + SQL conditional update；stale overwrite 被拒 | active-active writer/fencing 与外部 DB CAS |
| Lease | server database time、heartbeat/renew/release、expiry、new-id takeover | 长 TTL cleanup、监控与跨实例 takeover policy |
| Recovery | process crash/restart、network lost response、retry、Evidence retry 已验证 | server failover、kill-point 全量演练与自动化告警 |
| Evidence | pack ↔ artifact ↔ revision ↔ transaction ↔ audit anchor durable projection | 独立 artifact blob/attestation registry |

E12 的单用户路径保留兼容，不做破坏式替换。

### 0.3 E13-SERVER 验收记录

| 门 | 结果 |
|---|---|
| Real backend | SQLite WAL/FULL durable file；normalized transaction/revision/audit/evidence projections；Node `>=22.5.0` |
| CAS / lease | 双独立 session 一胜一 `REVISION_CONFLICT`；server DB time lease expiry/takeover；clock skew 不影响结果 |
| retry / recovery | lost response 与 reconnect 不重复 revision；commit retry `already_committed`；crash before/after CAS 重启可判定 |
| evidence / audit | Evidence Pack hash/revision/transaction anchor 幂等；append-only event sequence 可重读 |
| regression | E13-SERVER 8/8；全量 70 files / 378 tests；build:site、doctor 5/5、audit 0、validate:v2 3/3、Chromium 56/56 |
| deployment boundary | 单 writer service + SQLite 文件；active-active/HA/remote UI adapter 未认证，保留 Production Candidate |

### 0.4 推荐下一 Epic：E14 Durable Service Hardening（Target）

不在本阶段实现，先记录为有边界的后续任务：

| 任务 | 目标验收 |
|---|---|
| E14-01 数据库/迁移 | 外部 durable DB schema migration、备份/恢复演练、唯一约束与 CAS 在目标部署环境通过 |
| E14-02 HA / fencing | active-active writer、leader lease、split-brain fencing、failover 后不重复 commit |
| E14-03 remote client | Studio UI 可显式选择 server adapter；双浏览器/双设备 session 通过真实 remote transaction flow |
| E14-04 recovery operations | abandoned transaction TTL、lease cleanup、crash/retry/runbook、告警与可观测性 |
| E14-05 artifact registry | Evidence Pack 与 HTML artifact 的 durable blob/manifest/attestation registry 可独立恢复 |

E14 的退出条件是“多实例/多设备故障时仍无 silent overwrite、double commit、partial publish 或 ambiguous recovery”；在此之前，E13-SERVER 仅作为受控单 writer Production Candidate。

---

## 1. 阶段顺序（全仓库视角）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 已完成（2026-07-31） | 全库审查 31 处修复/改进：核心 2、v1+脚本 9、v2 安全 16、agent/开发者 UX 4（commits `00e3b7f`、`ebd5d20`、`1bc63d7`、`53d4a52`） | ✅ |
| 已完成（2026-07-31） | E5 收尾（预览红框 overlay `1dc2856`、diff 面板 `ebf3931`）+ E11 维护成本优化第一批 | ✅ |
| 已完成（2026-07-31） | E6/E7：P0-A 事务闭环 + P0-B 信任闭环的**代码硬门**（`f4ca539`、`bda0379`、`1e6cb3e`、`2de7b73` 等） | ✅ |
| 已完成（2026-07-31） | 浏览器矩阵验收：两模板 × 4 目标 × 全边界场景 + 五语言，88/88 全过，结论存档于 [docs/BROWSER_MATRIX.zh-CN.md](docs/BROWSER_MATRIX.zh-CN.md)，可用 `node scripts/browser-matrix.mjs` 复现 | ✅ |
| 已完成（2026-07-31） | Purchase Order 跨引擎分页收敛：非行区 +16px 让 15 组合全部落到每页 14 行，复跑矩阵 22 个可比格子零分歧 | ✅ |
| 长期 | E8 工程师工作流 → E9 分页引擎演进 → E10 发布治理 | ⬜ |

里程碑对外状态（Pilot → Production Candidate → Production Ready → Template Scale）沿用工程路线图的发布顺序表。E13-SERVER 已把受控部署的服务端事务恢复/并发门跑通，但 Production Ready 仍由维护者显式宣布，不由一次跑批绿灯自动推导；当前承诺仍限定为单 writer service、Chromium reference runtime、人工审批和既定安全门。

---

## 2. 低成本维护策略（E11，专项计划）

目标：**让"改一处、验一处、不回归"成为默认体验**，减少每次改动的人工验证面。

### 2.1 测试补强（防回归 = 最大的省钱项）

| 缺口 | 现状 | 计划 |
|---|---|---|
| v2 `history`/`operations`/`command-bus` 安全回归 | ✅ 已固化（`tests/studio-v2/history.test.js`、`operations.test.js`，命令总线扩展一条幂等用例） | — |
| v1 `mustache-lite` | ✅ 已固化（`tests/mustache-lite.test.js`：转义集 + 严格 section） | — |
| 预览消息安全 | ✅ 已固化（`tests/studio-v2/preview.test.js`：jsdom 模拟 `event.source` 匹配/伪造/缺失三种场景） | — |
| Agent 网关 / 草稿缓存边界 | ✅ 已固化（`gateway.test.js` 畸形 JSON 契约、`draft-cache.test.js` 超配额与过期草稿） | — |
| `sample-scenarios` 数组选取 | ✅ 已固化（`sample-scenarios.test.js`：`data.items` 优先于其他数组） | — |
| E2E 冒烟 | ✅ 已修正认知并补齐：`e2e/studio-v2.spec.js` 其实已有 12 条深度用例（五语言、边界行数、性能预算、PWA 离线等），此前 ROADMAP 误判为"覆盖少"；真正的空白是核心库直渲染路径与 v1 —— 已新增 `e2e/core-pagination.spec.js`（多页 ERP 文档、header 不重复配置、脚本晚注入回归）与 `e2e/studio-v1.spec.js`（预览渲染、结构模式原始模板锁定） | — |
| 分页黄金样本 | ✅ 已固化（`e2e/golden-pagination.spec.js`：demo001 页数+每页行分布、delivery_order_test 的 PTAC/PADDT 页面分布、index015 物理/逻辑页拆分），P2 重构时对照这三份跑 | — |

**顺带修复的测试基础设施缺陷**：Node 22+/25 内置的全局 `localStorage`（无 `--localstorage-file` 时是不可用的空对象桩）会遮蔽 vitest jsdom 环境本应提供的可用实现，导致任何触碰 `localStorage` 的测试在此 Node 版本下静默失败（`ui-i18n.test.js` 此前用文件内 `vi.stubGlobal` 单独绕过，其余文件未设防）。已加共享 `tests/setup/local-storage-polyfill.js`（纯内存 Storage 实现，按测试文件隔离）并在 `vite.config.js` 的 `test.setupFiles` 注册，后续任何新测试触碰 `localStorage`/`sessionStorage` 都自动受益，无需各自 workaround。

**顺带发现的本地验证陷阱**：`playwright.config.js` 的 `webServer.reuseExistingServer` 在非 CI 环境下为 `true`——如果本机手动起了另一个服务器占用 4174 端口（例如用浏览器工具单独预览某个页面），Playwright 会静默复用那个服务器而不是自己管理的 `site-dist` 服务器。只依赖仓库根目录也存在的文件（`demo001.html` 等）的用例不受影响，但依赖 `site-dist` 专属产物（如两个试点导出 HTML）的用例会遇到假失败（404 页面被当成真实响应，断言超时）。**验证 e2e 前先确认没有手动服务器占用 4174**，或直接看失败信息里是不是内容像"Not found"页面。CI 环境不受影响（`reuseExistingServer` 在 CI 下强制为 `false`）。

**第三个陷阱（2026-07-31 新发现，代价最大：让 CI 连红三个提交）**：`npx playwright test --project=chromium` 只跑一个引擎，而 CI 跑三个（Chromium/Firefox/WebKit）。本地长期只跑 Chromium 会让"全绿"这个说法比它听起来窄得多——本仓库出现过的具体后果是：`e2e/golden-pagination.spec.js` 的行分布黄金数字从 Chromium 抓取后被断言给全部三个引擎，Chromium 与 WebKit 恰好一致、Firefox 不一致，于是 `c081a91` 之后每一次 push 的 CI 都失败，而本地每次都绿。**根因是本机压根没装 Firefox/WebKit**（`npx playwright install firefox webkit`），所以从来没机会发现。规则：(1) 涉及**渲染结果**的断言，合并前必须跑一次不带 `--project` 的全量 `npm run test:e2e`；(2) 行分布/页数这类量是字体度量的函数，**连同一引擎跨操作系统都可能不同**（实测 Firefox 行分布 macOS 与 CI Linux 就不一样），所以精确数字只钉 Chromium 基准，跨引擎只断言不变量（总数守恒、区块落在正确页）——见 ROADMAP P3「每个浏览器维护独立基线，不比较跨引擎像素一致性」；(3) push 后顺手 `gh run list` 看一眼，别默认本地绿就等于 CI 绿。

**第四个陷阱（2026-07-31 新发现并解决）**：`e2e/studio-v1.spec.js` 在满负载全量并行套件下（5 workers × 3 引擎）偶发超时，本 session 撞到 3 次、每次不同用例、每次单独重跑都秒过——**不是等待逻辑假死**，而是两条链式 `expect().toBeVisible({timeout:20_000})` 加起来逼近文件级 45s 整体超时；抓到一次现场证实渲染其实已完整跑完 8 页，只是在满负载下比 20s 慢。修法（`94f2c7e`）：单条等待超时 20s→40s、文件级超时显式设 `test.describe.configure({timeout:120_000})`，并把本机 Playwright 并发 worker 从 5 降到 3 以减少三引擎同时跑的内存/CPU 争抢。**验证**：连续 3 次全量 `npx playwright test`（不带 `--project`）65/65 全过零 flake。教训与第三个陷阱相同：**满负载下的偶发失败不等于逻辑错误，必须先复现确认是"真假死"还是"真的只是慢"，再决定加超时还是修 bug**——本例混用了两者（加超时 + 降并发），因为根因就是"两者都不够宽松"。

**第二个陷阱（2026-07-31 新发现，比端口冲突更隐蔽）**：`playwright.config.js` 的 `webServer.command` 是不带参数的 `node scripts/serve-site.mjs`，其默认根目录是 `site-dist/`——`npm run build:site` 生成的**构建快照**（对 `studio-v2/`/`studio/`/`docs/`/`img/` 做的是纯文件拷贝，不是符号链接）。这和 `.claude/launch.json` 显式传 `"."` 参数、直接服务仓库根目录实时源码的开发预览完全不同。`package.json` 的 `test:e2e` 脚本本身有 `pretest:e2e: npm run build:site` 钩子，所以**正常使用 `npm run test:e2e`（CI 也是这样跑的）不受影响**——踩坑的前提是像本 session 调试时那样为了单独跑某条用例、图快而直接执行 `npx playwright test`（跳过了 pretest 钩子）。只跑过 `npm run build:assets`（只重建 `dist/printform.js`/`dist/printform-document.js`）也不够，因为 `site-dist/studio-v2/` 是整个目录的纯拷贝，`build:assets` 不会碰它。**不会有任何报错或警告**，只是新功能的断言莫名其妙对不上（真实案例：P0-A #12 的 `candidateHash` 字段在直接服务源码根目录的浏览器里工作正常，但同一个用 `npx playwright test` 直接跑的 e2e 用例稳定复现 `undefined`——用独立脚本对比两种服务方式才定位到是 `site-dist/` 陈旧快照，不是代码回归）。**结论：本地要单独用 `npx playwright test` 而不是 `npm run test:e2e` 时，先手动跑一次 `npm run build:site`**；否则就用 `npm run test:e2e -- --project=chromium` 这类形式，让 pretest 钩子自动兜底。

### 2.2 Debug 能力（降低排查成本）

- Current 已有：核心 `data-debug=y` 调试面板、v2 诊断包下载、元素级 issues（selector + rect）、预览红框 overlay（`1dc2856`）、`npm run doctor`（一条命令跑单测+生产构建+两个试点 `validate:v2`，逐步实时输出 + 结尾一页 PASS/FAIL 汇总；刻意不含 e2e——那是 CI 每次 push 都跑的三引擎慢检查，doctor 是给"我这份工作树健不健康"的快速一问）。
- ✅ 已评估（2026-07-31，见 TASK.md）：v2 结构化 trace 事件替代 console 依赖——原计划的唯一目的是给 P2 的 `PaginationSession` 类重构铺路，重构本身经评估判定暂不做，trace 事件随之一并延后，不单独实现。

### 2.3 仓库形态收编（减少认知负担）

| 问题 | 处理 |
|---|---|
| 根目录 21 个 `index0XX.html` 演示页无索引 | ✅ 已建 [examples/README.md](examples/README.md) 目录清单（按特性分组，每页一句话说明测什么）；未移动任何文件 |
| `studio/studio.js` 约 1.5k 行，违反 AGENTS.md 300 行规则 | v1 已冻结：登记为**豁免**，不做大拆分（拆分风险 > 收益）；新代码严格执行 300 行规则 |
| 文档双语重复（USAGE_GUIDE 等 en/zh 两份） | 中文为权威（v2 索引已声明），英文版页首加"摘要 + 以中文版为准"声明，不再逐句同步 |
| `dist/` 曾被误解为进 git | 已确认 `.gitignore` 生效、CI 构建；DESIGN.md 已写明 |

### 2.4 CI 扩展（把人工检查变成机器检查）

1. ✅ CI 已增加 `npm run validate:v2` 两个试点导出（防协议回归；用篡改 protocolVersion 的样本实测确认非零退出码）。
2. ✅ CI 已跑 2.1 新增的 5 条 Playwright 冒烟（随现有 `npm run test:e2e` 一起执行，无需单独触发）。
3. ✅ 已加 [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)：涉及 `studio-v2/core/**` 时是否已跑 `npm run build:assets`（acceptance.js 打进 runtime 包，源改了不重建预览不生效——这是实测踩过的坑）+ 文档同步 + TASK.md 状态更新三项提醒。

### 2.5 文档防漂移

- 根目录五文档（DESIGN/SPEC/EPIC/ROADMAP/TASK）每次功能 commit 后由提交者顺手更新"最后核对"行；对不上以代码为准。
- 配置文档继续用 `npm run docs` 从 `CONFIG_DESCRIPTORS` 生成，禁止手改生成物。
- Studio v2 系列文档维持 Current/Target/Backlog 状态词纪律（[索引](docs/STUDIO_V2_INDEX.zh-CN.md)定义）。

---

## 3. 已知风险与缓解

| 风险 | 缓解 |
|---|---|
| P2 分页重构回归 ERP 旧行为 | 已落 2.1 的黄金样本断言（`4c50a35` 的行高预测量缓存已验证字节不差）；`PaginationSession` 类重构本身经评估判定暂不做，此风险随之收窄——见 [docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) P2 节 |
| SW 缓存导致"改了没生效"误判 | 已实现开发模式网络优先；部署版本号盖章缺失会构建失败 |
| ~~`sw.js` 手写 `APP_SHELL` 清单随新增文件漂移~~ | ✅ **已根治（2026-07-31，`eebcae1`）**：改为构建时由 `scripts/app-shell.mjs` 走产物目录生成，新增模块无需登记。此前一天内漂移两次（`core/operation-schemas.js`、`ui/diff-view.js`），都是被 PWA 离线用例抓到；改造时还发现旧清单本就漏了 `core/runtime.js`，从没人察觉——这正是"该生成而非手写"的论据 |
| v1/v2 双 Studio 长期并存的双倍维护 | v1 冻结纪律 + 文档明示"新需求一律进 v2" |
| ~~无 LICENSE（P3 前对外分发受限）~~ | ✅ 已解除：2026-07-31 采用 [MIT](LICENSE)，`package.json` 同步 |
