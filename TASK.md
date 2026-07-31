# TASK.md — 任务板

> 最后核对：2026-07-31（对齐待提交的渲染行数完整性校验批次，工作区基于 `ebf3931`，164 个单测 + 22 个 E2E 全绿；P0-A/P0-B 已拆分为 #12–19，见下方待办表）。
>
> 规则：任务完成时移到「已完成」并附 commit；新任务先写验收标准再动手。Epic 归属见 [EPIC.md](EPIC.md)。

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
| PR 检查项：新增 `.github/PULL_REQUEST_TEMPLATE.md`，含 `build:assets` 提醒 + 文档同步提醒 + TASK.md 状态提醒三项 | （待提交） | 模板内 `DESIGN.md` 相对链接校验存在 |
| 黄金样本分页断言：demo001（45 行+PTAC）、delivery_order_test（PTAC+PADDT 组合）、index015（2-up 物理/逻辑页拆分）三页固化页数+每页行分布 | `c081a91` | 新增 `e2e/golden-pagination.spec.js`；**过程记录**：首次手动用 MCP 浏览器抓取 demo001 数据时把 prowitem/ptac 数量看错位（误以为逐页混排），写断言后跑测试立刻炸出 diff——改用 Playwright 自身跑一遍单独探测脚本拿到真实数据（prowitem 全在 1-2 页 [23,22]，ptac 全在 3-7 页 [4,3,3,3,4]）才是准的；另发现一次误报：全量跑 21 条时 1 条 v2 自包含导出测试失败，根因是本机 Playwright 的 `reuseExistingServer` 复用了我手动开的仓库根目录服务器（4174 端口冲突），并非代码回归——清掉手动服务器后 21/21 全绿，此后不再在验证期间保留手动服务器占用该端口 |
| P0-A：operations 判别联合 schema 校验（新增 `core/operation-schemas.js`，复用 `core/schema.js` 引擎，未知 operation 仍走既有 `UNSUPPORTED_OPERATION`，已知类型的缺字段/多字段/类型错误统一 `INVALID_OPERATION_SHAPE`） | （待提交） | 9 个新单测（8 个 operations.test.js + 1 个 command-bus.test.js 端到端）；浏览器实测：通过真实 WebMCP 网关验证多字段/缺字段两种畸形操作均被拒、revision 不推进，合法操作正常生效（0→1）。**过程记录**：新文件忘记同步 `sw.js` 的 `APP_SHELL` 清单，导致 PWA 离线用例失败（新文件 import 离线 404）——被全量 e2e 跑一遍当场抓到并修复，未提交带 bug 的版本；已把这个坑写进 ROADMAP.md §3 供下次新增文件时参考 |

| 高层语义工具第一批：`set_column_widths`（支持逗号分隔复合选择器同步多张表）、`set_font_scale`（整体平移 7 级字号刻度，替换旧注入块不重复） | （待提交） | 10 个新单测（6 个 column-widths 含真实 `.prowheader`/`.prowitem` 分离表场景 + 2 个 font-scale + 2 个既有 typography 测试保持通过）；浏览器实测：对 Sales Invoice 真实模板一次调用同步表头+数据行列宽、字号从 9pt 平移到 12pt，截图确认视觉变化，`validate_project` 零错误、0 溢出、0 对比度问题 |

| Apply 前并排 diff 面板：新增 `ui/diff-view.js`（LCS 逐行对比，JSON 段先 stableStringify 避免键序误判，>1500 行自动跳过高亮防卡顿），替换 `window.confirm` 单行文本；新增 `#source-diff-modal` + 6 个新 i18n key×5 语言，清理已失效的 `source.none`/`confirm.applySource` | `ebf3931` | 6 个 diffLines 纯逻辑单测 + 1 个新 e2e（apply/cancel/无变更三路径）；浏览器实测：JSON 段（manifest 标题变更）红绿高亮正确、原始 HTML 段（模板追加行）正确识别为纯新增、trust 降级单独渲染"trusted → untrusted"、Cancel 后 revision 与草稿完全不变、移动端视口正确堆叠为单列、全程控制台零报错；159 单测 + 22 E2E 全绿 |
| P0-B #4（部分）：渲染行数完整性校验——`inspectRenderedDocument` 新增 `expectedRowCount` 参数，对比 `.prowitem_processed` 实际渲染数与 `bindTemplate` 绑定数，不一致报 `ROW_COUNT_MISMATCH`（新错误码，5 语言 i18n） | （待提交） | 5 个新单测（含修正 `runtime.test.js` 原有 mock 未模拟真实 class 改名的失真问题，并新增"丢一行"回归用例）；浏览器实测：Sales Invoice 1/45/100/500/长文本 5 个场景 + Purchase Order 空/1/45/500 4 个场景，`renderedRows`/`expectedRows` 全部相等、零误报；164 单测 + 22 E2E 全绿。**仅覆盖"数量"，不含稳定 identity/顺序校验**（见下方待办拆分） |

## 🔄 进行中

（无）

## ⬜ 待办（P0-A / P0-B 拆分，按依赖顺序；见 [docs/STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md](docs/STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md) Target 章节）

> 这两组是 Production Ready 的硬门（见 [docs/STUDIO_V2_INDEX.zh-CN.md](docs/STUDIO_V2_INDEX.zh-CN.md) 成熟度规则），体量大、涉及信任模型的破坏性契约变更（Agent Contract 2.0 不保留 1.x 写路径）。#12–14 互相耦合，必须作为一组一起交付，不能拆开合并；其余各项相对独立，可单独排期。每项落地都要浏览器实测 + 全量测试，不与其他任务混批。

| # | 任务 | Epic | 依赖 | 验收标准 |
|---|---|---|---|---|
| 12 | P0-A：候选项目在隐藏 sandbox iframe 中真实渲染（不复用当前草稿的 RenderReport）——`preview_changes` 内部序列化 candidate 为独立 HTML，注入隐藏 iframe，等待其自身 `printform:rendered`，取代当前"仅静态校验、不分页"的 `validation(candidate)` | E6 | 无（可先做，且可以是内部实现改进，不必立刻改变对外契约形状） | 对一个会导致真实溢出/换页数变化的 operations 调用 `preview_changes`，返回的 validation 反映**真实分页结果**而非仅 schema/业务规则；现有 145+ 单测与 22 e2e 不回归 |
| 13 | P0-A：`preview_changes` 返回 `previewId`/`candidateHash`/`scenarioReports`（含 default 与 long-text）/`expiresAt`；`apply_changes` 改为只消费有效 previewId+hash，不再接受新 operations | E6 | #12 | 路线图 P0-A 退出条件：stale/过期/hash 不符/未知 operation 都有稳定错误码；default 与 long-text 场景报告绑定同一 candidate hash；这是 Agent Contract 2.0 的破坏性核心，UI/WebMCP/CDP 必须同一提交内切换 |
| 14 | P0-A：Agent Contract 2.0 切换——`get_capabilities` contract version 升级，旧 1.x 写命令返回升级提示而非静默兼容 | E6 | #12、#13 | 路线图"契约升级"条款；WebMCP/CDP/UI 三者对同一输入行为一致 |
| 15 | P0-B：Preview bridge 加一次性 nonce（配合 #12 的隔离 iframe），阻止非本次预览的消息被接受 | E7 | #12 | 伪造/重放的 nonce 一律拒绝；与 2026-07-31 已有的 `event.source` 校验叠加，不替代 |
| 16 | P0-B：稳定行 identity + 顺序校验（本批已交付"数量"部分，见上方已完成表；这里是剩余的"顺序/identity"部分）——给每个 `.prowitem` 打稳定 id（如 array index + 内容 hash），RenderReport 比对顺序而非只比对总数 | E7 | 无（可独立于 #12–14） | 人为交换两行数据顺序后重新渲染，报告能明确指出"顺序变化"而不仅是"数量不符" |
| 17 | P0-B：矩形碰撞 + 重复区不变量检测重叠、越界及 header/docinfo/footer 缺失 | E7 | 无 | 人为让 header 缺失或两区块重叠时，产生专用错误码（现有 HORIZONTAL_OVERFLOW/VERTICAL_OVERFLOW 不覆盖"缺失"和"重叠"两类） |
| 18 | P0-B：Studio 签发截图 Evidence Receipt（`evidenceId`/`screenshotHash`/`renderReportHash` 等），`complete_layout_review` 改为只接受 evidenceIds，不再接受 Agent 自述标签 | E7 | #12（复用隔离 iframe）、需要截图能力（当前代码库无任何屏幕捕获基础设施，是全新能力） | 路线图 P0-B 退出条件：Agent 伪造 evidence 标签必须被拒绝 |
| 19 | P0-B：Attestation 覆盖两段 runtime + CSP + 内容 + 真实浏览器 receipt（当前只有 runtime/content hash，无"真实浏览器测过"的证明） | E7 | #18 | 路线图"完整性与证明"条款 |

## 🚧 阻塞

（当前无阻塞。历史坑已解除：SW 开发缓存 → `53d4a52`；`build:assets` 未重建导致预览用旧 runtime → 已写入 ROADMAP 2.4 + PR 模板；vitest 下 Node 25 原生 `localStorage` 桩对象遮蔽 jsdom 实现 → 共享 setup polyfill；本机手动预览服务器与 Playwright `reuseExistingServer` 端口冲突会产生假失败 → 验证 e2e 前先确认 4174 端口没有手动服务器占用；新增 `studio-v2/` 下被 import 的文件必须同步 `sw.js` 的 `APP_SHELL`（已发生两次，PR 模板已加提醒）。）

## 📌 下一步（建议顺序）

TASK.md 中优先级明确、体量适中的项目已全部完成（#1–7、#10、#11 均已提交，外加本批的 P0-B 行数校验）。剩余是 #12–19（P0-A/P0-B 拆分），体量大、涉及信任模型的破坏性契约变更，建议：

1. #16、#17 相对独立、风险低，可参照本批"渲染行数完整性校验"的模式继续做（延伸 `inspectRenderedDocument`，不改外部契约）——适合作为下一批起点。
2. #12 是 #13/#14 的前提，且可以先作为**内部实现改进**单独交付（不必与 #13 的破坏性契约变更同批）——建议先做 #12，验证"隔离 iframe 真实渲染 candidate"这个核心机制本身可靠，再决定 #13/#14 的契约形状。
3. #18/#19 需要全新的截图/证据基础设施，且依赖 #12，建议放最后，先在小范围原型验证浏览器截图方案（如 `<canvas>` 光栅化 iframe 内容 vs 浏览器原生 API）再动手。
