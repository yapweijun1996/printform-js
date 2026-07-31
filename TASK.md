# TASK.md — 任务板

> 最后核对：2026-07-31（对齐待提交的高层语义工具批次，工作区基于 `77d9722`，153 个单测 + 21 个 E2E 全绿）。
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

## 🔄 进行中

（无）

## ⬜ 待办（按优先级）

| # | 任务 | Epic | 验收标准 |
|---|---|---|---|
| 5 | Apply 前并排 diff 面板（替代 confirm 文本） | E5/E8 | 变更 section 并排高亮，取消不落盘 |
| 8 | P0-A：候选项目隔离 iframe 真实分页 dry-run + preview receipt | E6 | 路线图 P0-A 退出条件 |
| 9 | P0-B：preview nonce + candidate hash；Studio 签发截图证据 | E7 | 路线图 P0-B 退出条件 |

## 🚧 阻塞

（当前无阻塞。历史坑已解除：SW 开发缓存 → `53d4a52`；`build:assets` 未重建导致预览用旧 runtime → 已写入 ROADMAP 2.4 + PR 模板；vitest 下 Node 25 原生 `localStorage` 桩对象遮蔽 jsdom 实现 → 共享 setup polyfill；本机手动预览服务器与 Playwright `reuseExistingServer` 端口冲突会产生假失败 → 验证 e2e 前先确认 4174 端口没有手动服务器占用。）

## 📌 下一步（建议顺序）

1. 待办 #5（Apply 前 diff 面板）——UI/UX 判断较多，建议单独一批，逐屏验证。
2. #8、#9 体量较大（隔离 iframe 真实分页、截图证据体系），建议单独排期，不与其他任务混批。
