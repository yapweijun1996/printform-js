# ROADMAP.md — 路线图与低成本维护策略

> 最后核对：2026-07-31（对齐 `535c58c`；E11 专项计划第 2.1–2.4 节现已全部完成，仅 2.5 文档防漂移是持续性工作项，非一次性任务）。
>
> Studio v2 的 P0–P3 工程路线（依赖、接口、退出条件）的**权威文档**是 [docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)，本文不复制其内容，只补充：① 全仓库视角的阶段顺序；② 让项目**便宜维护**的专项计划（含改进与 debug 方向）。

---

## 1. 阶段顺序（全仓库视角）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 已完成（2026-07-31） | 全库审查 31 处修复/改进：核心 2、v1+脚本 9、v2 安全 16、agent/开发者 UX 4（commits `00e3b7f`、`ebd5d20`、`1bc63d7`、`53d4a52`） | ✅ |
| 近期（1–2 周） | E5 收尾（预览红框 overlay、diff 面板）+ E11 维护成本优化第一批（见下） | ⬜ |
| 中期 | E6/E7：P0-A 事务闭环 + P0-B 信任闭环 → Production Ready 硬门 | 🔶 部分 |
| 长期 | E8 工程师工作流 → E9 分页引擎演进 → E10 发布治理 | ⬜ |

里程碑对外状态（Pilot → Production Ready → Template Scale）沿用工程路线图的发布顺序表。

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

### 2.2 Debug 能力（降低排查成本）

- Current 已有：核心 `data-debug=y` 调试面板、v2 诊断包下载、元素级 issues（selector + rect）、预览红框 overlay（`1dc2856`）。
- 计划：
  1. v2 结构化 trace 事件替代 console 依赖（P2 前置项，先定义事件形状）。
  2. `npm run doctor`：一条命令跑 测试 + build + validate:v2 两个试点，输出一页体检报告。

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
| P2 分页重构回归 ERP 旧行为 | 先落 2.1 的黄金样本断言，重构每步跑旧样本 |
| SW 缓存导致"改了没生效"误判 | 已实现开发模式网络优先；部署版本号盖章缺失会构建失败 |
| `sw.js` 手写 `APP_SHELL` 清单随新增文件漂移 | **2026-07-31 实例**：新增 `core/operation-schemas.js` 忘记同步清单，PWA 离线加载失败（新文件 import 离线 404），被 `e2e/studio-v2.spec.js` 的 PWA 离线用例当场抓到并修复。根治方案是[工程路线图](docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) P3 的自动生成 precache manifest；在此之前，**新增 `studio-v2/` 下任何被 import 的模块必须同步加入 `APP_SHELL` 并跑一次 PWA 离线用例** |
| v1/v2 双 Studio 长期并存的双倍维护 | v1 冻结纪律 + 文档明示"新需求一律进 v2" |
| 无 LICENSE（P3 前对外分发受限） | 保持现状声明（PROJECT_OVERVIEW 已写明），P3 处理 |
