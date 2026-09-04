# PrintForm Studio v2 发布检查表

> 当前成熟度：**Production Pilot**。本清单分别列出当前试点检查和 Production Ready 硬门——六项硬门的代码部分已完成，但 Production Ready 状态本身仍需维护者显式宣布，不由代码完成或测试绿灯自动推导。
>
> 最后核对：2026-09-04。当前工作树已复核：70 files / 378 unit tests、doctor 5/5、三个 pilot `validate:v2`、Chromium E2E 56/56；完整三引擎 CI 结果仍以浏览器矩阵和 CI artifact 为准。

## Production Pilot 自动检查

- `npm ci`
- `npm audit --audit-level=moderate`
- `npm test -- --run`
- `npm run build:site`
- `npm run test:e2e`
- `npm run test:e2e -- --project=chromium`（本机快速验证；2026-09-04 为 56/56）
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

以下六项须全部由代码、自动测试和真实浏览器证据证明，不允许人工豁免。**代码部分已于 2026-07-31 全部完成**（不允许人工勾选绕过，见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)确认标准）：

1. ✅ 候选项目在复用的可见预览 iframe 中真实分页渲染，`preview_changes`/`apply_changes` 返回绑定 `candidateHash` 的报告。
2. ✅ revision 永不复用，写入靠 `expectedRevision` + `candidateHash` 内容寻址天然防止旧预览被提交（未做破坏性 previewId 两阶段提交，评估后判定当前机制已达成同等安全目标，见信任与代理模型文档《Backlog》一节）。
3. ✅ Studio 签发几何指纹（非像素截图）场景 Evidence Receipt，Agent 不能自我声明证据。
4. ✅ Preview channel 验证目标 frame、跨 iframe reload 的单调请求 token（等价一次性 nonce）、revision 和 candidate hash。
5. ✅ Attestation 覆盖两段 runtime hash、CSP script hash、权威内容 hash 与由真实 evidence receipt 推导的浏览器凭证。
6. ✅ 自动验证内容数量、顺序、重复、遗漏、重叠、越界、对比度与重复区完整性。

**这不等于可以宣布 Production Ready**：该状态是对外承诺，由维护者显式宣布，不由代码硬门齐全或一次跑批绿灯自动推导——还需完成本清单其余的发布流程验收（浏览器矩阵、系统打印预览人工确认等）。浏览器矩阵已在 macOS 与 Linux（GitHub Actions Ubuntu runner，`node scripts/browser-matrix.mjs` / `.github/workflows/browser-matrix.yml`）两个操作系统上各跑满 88/88 全过、零跨引擎分歧，仅 Windows 尚未验证。硬门设计和退出条件见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)及[工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md)。

## 发布确认

- 没有未保存草稿时才接受 PWA 更新。
- AI/MCP 只能取得 readiness；工程师必须亲自确认系统打印预览并点击导出。
- 记录协议、Studio、runtime 版本及当前实际完成的浏览器矩阵。
- 未知导入按真实 ERP 数据处理；不默认上传缓存、日志、截图或遥测。

## E14 AI Designer UX 验收（Target，不是当前 Production Ready 硬门）

- AI panel 固定为 `Panel navigation → Current document context → Conversation → Composer`。
- Preview 仍是 workspace source of truth；AI conversation 不得遮挡或替代质量门和生产导出。
- Context Bar 必须来自真实 document/selection/scope state，不能是静态装饰文本。
- Proposal、Change、Validation 必须分开显示；`Applied` 只能表示 transaction commit 成功。
- Auto-apply safe changes 必须继续经过 preview、validation、approval、revision 和 candidate hash gate。
- History、Changes、Activity、Settings 和 Gateway 默认按需打开；技术 trace 不进入普通聊天记录。
- mobile、focus restore、tab semantics、keyboard navigation 和 1440px Production export visibility 必须有回归验证。
