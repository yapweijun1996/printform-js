# ROADMAP.md — 路线图与低成本维护策略

> 最后核对：2026-07-31（对齐 commit `53d4a52`）。
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
| v2 `history`/`operations`/`command-bus` 安全回归 | 单调 revision、原型污染、信任剥离目前靠一次性冒烟脚本验证 | 固化为 vitest 用例（每项 ≤15 行，一次写好永久生效） |
| v1 `mustache-lite` | 无独立测试文件 | 补转义集 + 严格 section 的用例 |
| 预览消息安全 | 浏览器手测 | jsdom 模拟 `event.source` 不匹配的用例 |
| E2E 冒烟 | Playwright 已配置但用例覆盖少 | 每子系统 1 条冒烟路径：核心分页 1 页/多页、v1 结构模式、v2 预览 ready |
| 分页黄金样本 | 无 | 对 `demo001` 等 3 个代表页固化「页数 + 每页行数」断言，P2 重构前必备 |

### 2.2 Debug 能力（降低排查成本）

- Current 已有：核心 `data-debug=y` 调试面板、v2 诊断包下载、元素级 issues（selector + rect）。
- 计划：
  1. 预览红框 overlay（数据已就绪，bridge 端渲染，约半天）。
  2. v2 结构化 trace 事件替代 console 依赖（P2 前置项，先定义事件形状）。
  3. `npm run doctor`：一条命令跑 测试 + build + validate:v2 两个试点，输出一页体检报告。

### 2.3 仓库形态收编（减少认知负担）

| 问题 | 处理 |
|---|---|
| 根目录 21 个 `index0XX.html` 演示页无索引 | 建 `examples/README.md` 目录清单（每页一句话说明测什么）；**不移动文件**（ERP 链接可能引用现有路径） |
| `studio/studio.js` 约 1.5k 行，违反 AGENTS.md 300 行规则 | v1 已冻结：登记为**豁免**，不做大拆分（拆分风险 > 收益）；新代码严格执行 300 行规则 |
| 文档双语重复（USAGE_GUIDE 等 en/zh 两份） | 中文为权威（v2 索引已声明），英文版页首加"摘要 + 以中文版为准"声明，不再逐句同步 |
| `dist/` 曾被误解为进 git | 已确认 `.gitignore` 生效、CI 构建；DESIGN.md 已写明 |

### 2.4 CI 扩展（把人工检查变成机器检查）

1. CI 增加 `npm run validate:v2` 两个试点导出（防协议回归）。
2. CI 增加 Playwright 冒烟（2.1 的 E2E 用例）。
3. PR 模板加一行：「涉及 `studio-v2/core/**` 时是否已跑 `npm run build:assets`？」（acceptance.js 打进 runtime 包，源改了不重建预览不生效——这是实测踩过的坑）。

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
| v1/v2 双 Studio 长期并存的双倍维护 | v1 冻结纪律 + 文档明示"新需求一律进 v2" |
| 无 LICENSE（P3 前对外分发受限） | 保持现状声明（PROJECT_OVERVIEW 已写明），P3 处理 |
