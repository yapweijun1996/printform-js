# TASK.md — 任务板

> 最后核对：2026-07-31（对齐 `b702a27`，197 个单测 + 三引擎 E2E 全绿；**六项 P0 硬门代码部分 + 浏览器矩阵验收（88/88）+ 跨引擎分页收敛均已完成**，原 #15 已并入 #12。成熟度仍是 Production Pilot——Production Ready 由维护者显式宣布，建议先在 Linux/Windows 重跑一次矩阵）。
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

| P0-B #18：Studio 签发布局验收证据 + Agent Contract 2.0.0——新增第 16 个工具 `capture_layout_evidence`（把场景渲染成未提交候选并签发 receipt，不推进 revision）；`inspectRenderedDocument` 输出 `pageGeometry`（每页直接子元素 class + 页内相对整数矩形，无业务文本）；`complete_layout_review` 改为只接受 `evidenceIds`，旧式 `evidence`/`browser`/`scenarios` 自述字段一律拒绝 | （待提交） | **证据形态经 grilling 确认为几何指纹而非像素截图**：沙箱 iframe 不透明 origin 让父页读不到 DOM，像素只能走 foreignObject→canvas（canvas 污染风险 + 保真缺陷 + 单张数 MB + 真实数据模式下像素即业务数据，与隐私策略冲突），而"防 Agent 伪造"的目标由给 Studio 自己的测量结果签名即完整达成。9 个新/改单测（layout-review.test.js 重写为 10 个：正向通过、旧式拒绝、伪造 id 拒绝、场景不全拒绝、mutation 失效、指纹按场景不同、渲染不干净不签发但返回原因、无渲染器 `EVIDENCE_UNAVAILABLE`、捕获不推进 revision）+ 1 个新 e2e；193 单测 + 25 E2E 全绿。**浏览器实测**：真实签发 default/long-text 两张 receipt（指纹确实不同、revision 保持 0、browser 正确识别为 Chromium 148），旧式自述字段被拒 `EVIDENCE_RECEIPT_REQUIRED`、伪造 id 被拒 `EVIDENCE_UNKNOWN`、只给 default 被拒 `REVIEW_SCENARIOS_REQUIRED`、齐全后审查通过且 `request_export` ready；随后 mutation 一次，确认 receipt store 被清空（旧 id 报 `EVIDENCE_UNKNOWN`）、导出重新被 `LAYOUT_REVIEW_REQUIRED` 阻断；全程控制台零报错。**顺带修复**：`agent-setup.json` 的 `verification.expectedCommandContractVersion` 在 #14 那次漏改（仍是 1.1.0），会让照此引导的 Agent 拒绝一个完全正确的 Studio——已新增一个单测把版本号/工具数从代码推导校验，四处手工副本不再靠人记；`mcp-server.test.js` 的工具数硬编码也改为从 `TOOL_CONTRACTS.length` 推导。**另修一个既有 e2e 竞态**（非本次引入，但被新测试加重的并行负载暴露）：`studio-v1.spec.js` 用 `#status-a` 的 `/\d/` 当渲染完成信号，会匹配上一个模板遗留的状态甚至 "0 页"，导致在 iframe 重载间隙数到 0 页；改为直接等待 `.printform_page` 可见，修复前 3 次全量跑挂 1 次，修复后连跑 4 次全绿 |

| P0-B #19：Attestation 补全——新增 `printformRuntimeHash`（此前只哈希 document runtime，换掉分页引擎不会被任何检查发现）与 `cspScriptHashes`；`browsers` 从硬编码 `["Chromium","Firefox","WebKit"]` 改为由 #18 的 evidence receipt 推导（无审查的导出为空数组，诚实留空）；`verifyImportedProject` 与 `validate:v2` 同步校验第二段 runtime，用独立错误码 `PRINTFORM_RUNTIME_HASH_MISMATCH` 与 document runtime 区分 | （待提交） | 3 个新单测（双 runtime + CSP hash 写入且与实际 CSP 一致、篡改分页引擎只触发 `PRINTFORM_RUNTIME_HASH_MISMATCH` 而非 document runtime 的、browsers 有/无审查两种取值）+ e2e 下载用例新增 attestation 断言（双 hash 不同、cspScriptHashes 与文档 CSP 匹配、browsers 恰好一个、layoutReview 含 2 张 evidence）。**CLI 实测**：重新构建后两个试点样本 `validate:v2` 全过（`printformRuntimeHashValid: true`）；往 `pf-printform-runtime` 注入一行代码后，只报 `PRINTFORM_RUNTIME_HASH_MISMATCH`（document runtime 与 content hash 仍 valid，证明错误码分离有效），退出码 1，干净文件退出码 0。196 单测 + 25 E2E 全绿。**已知 fail-closed 破坏**（范围内已确认）：本次之前导出的文件不含 `printformRuntimeHash`，重新导入降级 Untrusted |

| 契约版本第五处副本：Agent 连接面板的「Command contract」在 `index.html` 里硬编码 `1.1.0`，跨过 1.2.0 与 2.0.0 两次升级都没改，面板显示的版本与 `get_capabilities` 实际返回的不一致 | `5e563c4` | 修法不是把数字改对，而是让它**发空值、启动时从 `AGENT_CONTRACT_VERSION` 填**——最坏情况留白，不会理直气壮显示错的。新增单测断言发布的 HTML 里该元素必须为空，字面量无法溜回来（延续 `1e6cb3e` 的守卫思路，不再写"下次记得改"的提醒）。**未动** `mcp/server.mjs` 的 `serverInfo.version`：那是 stdio 服务器自身实现版本，与契约版本是两个概念，数字只是碰巧相同。浏览器实测面板与 `get_capabilities` 均为 2.0.0；197 单测 + 25 E2E 全绿 |

| **CI 自 `c081a91` 起连红三个提交**：`golden-pagination.spec.js` 的行分布黄金数字从 Chromium 抓取却断言给全部三个引擎，Firefox 不一致（Chromium/WebKit `[17,21,10,0]`，Firefox macOS `[15,20,13,0]`、CI Linux `[16,20,12,0]`——同引擎跨 OS 都不同）。本地始终绿是因为**本机没装 Firefox/WebKit**，我一直只跑 `--project=chromium` | `5e563c4` | 改法：跨引擎只断言不变量（总行数守恒 48、PADDT 页无数据行、ptac/paddt 落位数组——实测三引擎完全一致），精确分布用 `test.skip(browserName !== "chromium")` 只钉 Chromium 基准，与既有性能预算用例和 ROADMAP P3「不比较跨引擎像素一致性」一致。demo001 与 index015 三引擎确实一致，保持无条件断言不放松。装好 Firefox/WebKit 后本地跑全量三引擎：65 通过 / 10 跳过 / 0 失败。**教训已写入 ROADMAP §2.1 第三条陷阱**：涉及渲染结果的断言合并前必须跑不带 `--project` 的全量 e2e，push 后 `gh run list` 确认，别拿本地单引擎的绿当 CI 的绿 |

| 浏览器矩阵验收（P0-B 退出条件的发布流程部分）：新增可复用脚本 `scripts/browser-matrix.mjs`，跑两模板 × 4 目标（Chromium/品牌 Chrome/Firefox/WebKit）× 全边界场景（空/1/45/100/500 行 + 长文本）× 5 打印语言 | `2de7b73` | **88/88 全过**，零溢出/零丢行/零对比度失败；`empty` 按设计正确阻断（脚本把它列为预期 blocked，不当失败）。结论存档 [docs/BROWSER_MATRIX.zh-CN.md](docs/BROWSER_MATRIX.zh-CN.md)。**诚实说明**：4 个目标实为 3 个引擎（Chromium 与 Chrome 同引擎，WebKit 非真 Safari，Edge 未装），已写进报告不含糊。**带出一个待决策项**（见下方待办）：Purchase Order 分页随引擎变化，实测定位根因——行高两引擎完全相同（42.00px），差异全在 docinfo+页脚合计高出约 2.56px，而该模板装满 15 行后**只剩 1.42px 余量**，所以 Firefox 掉到 14 行、500 行时多出 2 张纸；Sales Invoice 余量充足，四目标逐页行数完全一致。**探测方法教训**：第一版探测用「页高 − 行高×行数」反推"非行区域"，这是循环论证（结果必然等于差一行），证明不了任何东西——必须逐区块实测才定位到真正差异 |

| Purchase Order 跨引擎分页收敛：`.pf-page-footer` 的 padding-bottom 12px→28px（非行区 +16px），让 引擎×语言 全部 15 个组合落到每页 14 行 | `4b0cdc1` | **完整机制**：数据行高三引擎完全相同（42.00px，字号不是问题），差异全在非行区块合计高度随 引擎×语言 在 386.58–411.20px 波动（跨度 24.62px ≈ 0.59 行），导致可用空间 612.80–637.42px = 14.59–15.18 行，**恰好跨在 15 这个整数边界上**。修法是把整段移到边界同一侧：解 `637.42−K<630` 且 `612.80−K≥588` 得 K∈(7.42, 24.80]，**取中点 16** 让上下各留约 8.6px，而不是贴着 7.42 那端（那只是换个悬崖站）。对模板改一次、所有浏览器同一份 CSS，**不做浏览器嗅探、不按引擎调字号**。已在 CSS 里写长注释说明约束，防止后人"顺手整理"改回去。**验证**：全量矩阵 88/88 通过且 22 个可比格子零分歧；三引擎全量 e2e 65 通过/10 跳过/0 失败。**代价**：每页少一行，页数多约 7%（500 行 34→36 页）。未采用反方向的"压缩 24px 保住 15 行"，因为省纸 7% 不值得重新设计已交付试点版式。**弯路记录（两处）**：(1) 先试 6px 并用只跑 en-MY 的聚焦探测判定"收敛"，**结论是错的**——全量矩阵里马来语仍分歧、日语方向还反转；窄范围的绿不等于绿。(2) 测量脚本两次有缺陷：一次用 `页高−行高×行数` 反推非行区（循环论证），一次误以为数据行在单个 `pf-grid` 容器内，实际**每行是独立 `<table>` 直接挂在页面下**，按 class 首 token 分组会把行头表和 15 个行表加成一个数——涉及数字的结论要先验证分解本身 |

## 🔄 进行中

（无）

## ⬜ 待办

**六项 P0 硬门的代码部分已全部完成**（#12–14、#16–19），浏览器矩阵验收也已跑满并全过。

### 宣布 Production Ready 前建议补的一步（非阻塞）

浏览器矩阵是**在 macOS 单机**跑的，而同一引擎跨操作系统已知存在度量差异（ROADMAP §2.1 第三条陷阱：Firefox 行分布在 macOS 与 CI 的 Linux 上就不同）。本次修复留了约 8.6px 双侧余量，按实测 24.62px 波动足以吸收，但**未在 Linux/Windows 实跑验证**。若要覆盖，在目标系统上重跑 `node scripts/browser-matrix.mjs` 即可。

### 其他候选方向（均未开始、未确认范围）

- **P1 工程师工作流**（EPIC E8）：Branding/Page/Repeated areas/Table columns/Locale/Data contract 可视化编辑面板，目前 Raw JSON/CSS/HTML 编辑器仍是唯一入口。
- **P2 分页引擎演进**（EPIC E9）：`PaginationSession`、结构化 trace、行高预测量缓存（大候选文档真实渲染耗时数十秒的根因）。
- **P3 发布治理**（EPIC E10）：独立 SemVer、LICENSE、CHANGELOG、SW precache manifest 自动生成。

## 🚧 阻塞

（当前无阻塞。历史坑已解除：SW 开发缓存 → `53d4a52`；`build:assets` 未重建导致预览用旧 runtime → 已写入 ROADMAP 2.4 + PR 模板；vitest 下 Node 25 原生 `localStorage` 桩对象遮蔽 jsdom 实现 → 共享 setup polyfill；本机手动预览服务器与 Playwright `reuseExistingServer` 端口冲突会产生假失败 → 验证 e2e 前先确认 4174 端口没有手动服务器占用；新增 `studio-v2/` 下被 import 的文件必须同步 `sw.js` 的 `APP_SHELL`（已发生两次，PR 模板已加提醒）；jsdom 环境下手写脚本重建 window/performance 等全局对象会撞 `Performance.now()` brand-check 死循环，需要真实浏览器上下文验证时改用 Playwright 读取沙箱 iframe（CDP 能穿透 sandbox，页面自身 JS 不能）；**手动测试注入 CSS/属性时要用分页引擎处理后的 `_processed` class 名，不是模板原始 class**（本 session 在测试代码和手动验证脚本里各撞到一次）；**大候选文档（大行数+大字号）的真实渲染可能耗时数十秒**，候选渲染超时不能照搬"~1 秒"的乐观估计，30 秒宽松兜底只防真卡死，不是性能预算（P2/E9 的分页性能优化仍未开始）；**`npx playwright test` 直接跑时默认 `webServer` 服务的是 `site-dist/`（`build:site` 构建快照）而非 `studio-v2/`/`studio/`/`docs/`/`img/` 实时源码**——`npm run test:e2e`（CI 用的也是这条）有 `pretest:e2e` 钩子自动重建，不受影响；只有为了单独跑某条用例而直接执行 `npx playwright test` 才会踩这个坑，此时只跑 `build:assets` 不够，必须整跑一次 `npm run build:site`，否则 Playwright 测的是旧代码且不会有任何报错提示，只是行为对不上（已加入 PR 模板提醒范围内的"重新构建"提醒项）。）

## 📌 下一步

P0-A 与 P0-B 的**代码硬门已全部完成**。**注意不要把这读成 Production Ready**：路线图 P0-B 退出条件还含"两模板 × 四浏览器 × 全边界场景通过"这一发布流程验收，不是代码改动能单独达成的，因此各文档的成熟度仍标 Production Pilot。

见上方「待办」列出的四个候选方向（浏览器矩阵验收 / P1 面板 / P2 引擎 / P3 治理），都需要先对齐范围再动手。
