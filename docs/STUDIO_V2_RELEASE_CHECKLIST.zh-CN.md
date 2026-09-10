# PrintForm Studio v2 发布检查表

> 当前成熟度：**Production Pilot**。本清单分别列出当前试点检查和 Production Ready 硬门——Foundational transaction/evidence gates exist, but behavioral gaps and selected-platform acceptance remain open. Production Ready requires closure and maintainer approval. 当前本地 review packet 草案见 [STUDIO_V2_RELEASE_PACKET.md](STUDIO_V2_RELEASE_PACKET.md)，不构成发布批准。
>
> Last reviewed: 2026-09-10. The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) keeps M1 implementation acceptance Partial. P0 remains 35 Pass, 0 Fail, and 0 Not run. The current `npm run doctor` passed 5/5 with 106 files / 571 tests (see [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md)); the target current-source Playwright run passed 54/54. Real Demo Gateway browser evidence is supporting evidence only: session 201, models 200, design/review SSE 200, 7/7 bounded media variants, and privacy controls passed. Direct-BYOK PI-04 provider acceptance, platform/print checks, remote CI, deployment/retention and maintainer approval remain open. These results do not authorize release. Preserve private UI approval, host-bound admission and human production-export confirmation.

## Production Pilot 自动检查

- `npm ci`
- `npm audit --audit-level=moderate`
- `npm test -- --run --maxWorkers=1 --no-file-parallelism`
- `npm run build:assets` + `node scripts/build-site.mjs`
- `npm run test:e2e`
- `npx playwright test --workers=1`（2026-09-08 Windows combined: 190/222 passed, 32 expected skips, 0 failures；Chromium 74/74、Firefox 58/58 applicable、WebKit 58/58 applicable）
- `npm run validate:v2 -- site-dist/studio-v2/samples/sales-invoice-v2.html`
- `npm run validate:v2 -- site-dist/studio-v2/samples/purchase-order-red-v2.html`
- `npm run validate:v2 -- site-dist/studio-v2/samples/progress-claim-northpeak-v2.html`
- 确认 Pages artifact 只包含 `site-dist/`，不包含源码仓库或开发凭证。

## Production Pilot 浏览器烟测

在 Chrome、Edge、Firefox、Safari 当前稳定版检查 Sales Invoice 与 Purchase Order。前一稳定版至少回归“导入 → 预览 → 人工导出 → 独立打开”。移动浏览器只验证查看与数据渲染。

- 切换空值、1、45、100、500 行、长文本和五种语言场景。
- 人工检查内容数量、顺序、重复、遗漏、重叠、越界、页码及重复区。
- 检查采购订单每页 document info、表头，以及最后页合计、条款和签名。
- 非法类型、坏 URL、资源失败、容量超限和已支持的 hash 错误必须阻断。
- WebMCP、第一方 CDP bridge 和 Studio UI 对当前命令返回一致结果与错误码。
- 自定义脚本必须降级为 `Untrusted`，且不能生成生产有效凭证。
- 导出的单 HTML 在断网状态自动渲染，并可重复调用 `PrintFormDocument.render(data)`。

当前布局指标不能单独证明“无重叠、无遗漏”；Pilot 必须保留人工全页审查。

## 系统打印预览

- 使用默认缩放、正确纸张和边距，检查字体替换、DPI、表格列和分页边界。
- 四个浏览器分别保存自己的截图／打印基线和容差。
- 不要求跨引擎像素一致；共同硬标准是不丢失、不重复、不乱序、不重叠、不越界，页码与重复区正确。
- 工程师确认打印驱动设置，并保留最后一次人工验收记录。

## Production Ready 硬门

Use the [DoD](STUDIO_V2_DEFINITION_OF_DONE.md) for step closure and the [TASK ledger](../TASK.md#sequential-execution-ledger) for progress. All applicable cases, the selected PI target and this checklist must close before release. A plan percentage, including 100% local engineering closure, never substitutes for maintainer approval or a missing print/platform check.

Additional behavioral acceptance: the [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) records 35 Pass (01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08/02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08/03-01/03-02/03-03/03-04/03-05/03-06/03-07/03-08/13-01/13-02/13-03/13-04/13-05/13-06/13-07/13-08/X-01/X-02/X-03), 0 Fail, and 0 Not run. P0 case evidence is complete; PI/provider, platform and release gates still require evidence and approval.

以下六项须全部由代码、自动测试和真实浏览器证据证明，不允许人工豁免。**代码部分已于 2026-07-31 全部完成**（不允许人工勾选绕过，见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)确认标准）：

1. ✅ 候选项目在复用的可见预览 iframe 中真实分页渲染，`preview_changes`/`apply_changes` 返回绑定 `candidateHash` 的报告。
2. ✅ revision 永不复用，写入靠 `expectedRevision` + `candidateHash` 内容寻址天然防止旧预览被提交（未做破坏性 previewId 两阶段提交，评估后判定当前机制已达成同等安全目标，见信任与代理模型文档《Backlog》一节）。
3. ✅ Studio 签发几何指纹（非像素截图）场景 Evidence Receipt，Agent 不能自我声明证据。
4. ✅ Preview channel 验证目标 frame、跨 iframe reload 的单调请求 token（等价一次性 nonce）、revision 和 candidate hash。
5. ✅ Attestation 覆盖两段 runtime hash、CSP script hash、权威内容 hash 与由真实 evidence receipt 推导的浏览器凭证。
6. ✅ 自动验证内容数量、顺序、重复、遗漏、重叠、越界、对比度与重复区完整性。

**这不等于可以宣布 Production Ready**：该状态是对外承诺，由维护者显式宣布，不由代码硬门齐全或一次跑批绿灯自动推导——还需完成本清单其余的发布流程验收（完整浏览器矩阵、系统打印预览人工确认等）。当前 Windows Chromium/Firefox/WebKit 目标 Playwright 证据为 54/54；远程 macOS/Linux 88/88 矩阵本次未运行，既有 88/88 失败记录仅作诊断，不计入通过。Edge、Safari.app、真实打印链、direct-BYOK PI-04、部署/留存和完整发布矩阵仍未认证。硬门设计和退出条件见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)及[工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)。

## 发布确认

- 没有未保存草稿时才接受 PWA 更新。
- AI/MCP 只能取得 readiness；工程师必须亲自确认系统打印预览并点击导出。
- 记录协议、Studio、runtime 版本及当前实际完成的浏览器矩阵。
- 未知导入按真实 ERP 数据处理；不默认上传缓存、日志、截图或遥测。

## E14 / production workflow acceptance (open release criteria)

- AI panel 固定为 `Panel navigation → Current document context → Conversation → Composer`。
- The project envelope is canonical; preview is derived visual evidence. AI conversation must not replace Quality or human export.
- Context Bar 必须来自真实 document/selection/scope state，不能是静态装饰文本。
- Proposal、Change、Validation 必须分开显示；`Applied` 只能表示 transaction commit 成功。
- Auto-apply safe changes 必须继续经过 preview、validation、approval、revision 和 candidate hash gate。
- History、Changes、Activity、Settings 和 Gateway 默认按需打开；技术 trace 不进入普通聊天记录。
- mobile、focus restore、tab semantics、keyboard navigation 和 1440px Production export visibility 必须有回归验证。

## Required closure checklist

- [ ] Close the applicable S01-S20 engineering steps using the [sequential plan](STUDIO_V2_EXECUTION_PLAN.md); record the exact source/artifacts and all required runtime evidence under the [DoD](STUDIO_V2_DEFINITION_OF_DONE.md).
- [ ] Complete PI-00..05: actual browser Harness, direct BYOK, host tools/approval, policy-bound sessions, composed acceptance and tested local cutover/cache rollback. Preserve historical AGRUN evidence as historical.

- [ ] Adopt and record the release profile: OS/browser/version, templates, paper, locale, size limits and persistence/deployment model (PROD-10). The single-user Windows/Chromium proposal does not silently remove broader existing goals.
- [ ] Classify unknown imports before persistence/AI; prevent unauthorized real-data copies across durable snapshots, recovery and sessions (PROD-13).
- [ ] Complete the component/operation scope matrix, including stale selection, mixed batches, indirect global effects and cross-entry/browser evidence (PROD-01; the direct component-selection control is implemented and separately evidenced).
- [ ] Preview-first blocks every automatic AI commit, including Review repairs and retries (PROD-02).
- [x] Context, preview, Quality and export agree on current revision/render/readiness; saved and applied remain distinct (PROD-03). Evidence: 03-01 through 03-08 pass 3/3 in Chromium, Firefox and WebKit, including five-locale refresh and human-cancelled export without automatic download.
- [x] Card Undo verifies the intended revision and actual command outcome; S09 04-01 through 04-06 each pass 3/3 with fresh Undo/Redo, stale-card `REVISION_CONFLICT`, candidate/Discard separation, Stop/late protection, rapid/double Apply recovery, project switch and durable restored committed preview (PROD-04). Independent Changes/history search remains E14-UI-05/PROD-07.
- [ ] Bound row counts and repeatHeader rules behave correctly for multiple tables (PROD-05/06).
- [x] Errors locate the owning page/component/field and explain the next action (PROD-07). Evidence: S11 07-01..02 pass 6/6 across Chromium, Firefox and WebKit; focused Quality/preview/controller checks pass 20/20. Independent Changes/history search remains E14-UI-05 backlog.
- [x] Raw edits, recovery failure, import/switch, picker cancellation and download fallback have verified outcomes; no silent data loss or false save claim (PROD-08). Evidence: S10 08-01..06 pass across Chromium, Firefox and WebKit; browser download remains started-only, without a disk-completion claim.
- [ ] Adopted layout passes real editing tasks, five locales, keyboard/focus and supported viewports; preserve existing resizable rail and export visibility (PROD-09/10). S12 locally verifies the retained current default at 18/18 browser cases plus 12/12 responsive/inspector regressions; the alternative proposed reorganization and release-profile adoption remain open.
- [ ] Performance uses the existing Chromium reference budgets; actual print output is manually checked on declared targets (PROD-10).
- [ ] All three pilots have aligned build/static/browser/release evidence; CI now has explicit static checks for all three, but browser/print/release alignment remains open (PROD-12).
- [ ] Record diagnostics, known limitations, rollback/recovery steps, exact artifacts and maintainer release approval.
- [ ] S21: obtain maintainer approval for the exact profile and artifacts; perform deployment/publishing only with explicit applicable authorization, then verify the actual result. Keep pending approval visible in TASK.
- [ ] For shared-service claims only: remote UI, server deployment, auth/isolation, backup/recovery and applicable HA/fencing acceptance (E15).

Existing AI full-page review remains required by CommandBus readiness. Provider unavailability must be shown as incomplete review, not waived validation.
Static `validate:v2` can report productionValid with `layout.verified: false`; it does not replace current browser evidence or Studio export readiness.
