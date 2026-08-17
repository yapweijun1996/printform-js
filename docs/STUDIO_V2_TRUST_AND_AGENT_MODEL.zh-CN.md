# PrintForm Studio v2 信任与代理模型

> 状态：Production Pilot
>
> Current 描述当前代码；Target 定义尚未实现的 Production Ready 信任闭环。**2026-08-17 当前契约为 Agent Contract 3.0.0**：公共 Agent 写入必须走事务化 preview/approve/apply，旧的 2.1.0 叙述仅作为历史记录。

> 本轮新增的 Production Foundation 还包括 FormSpec/component registry、Active Table Context、结构化 pagination diagnostics、strict trusted-export allowlist 与持久化 Evidence Pack。若本文下方的 2026-07-31 历史段落与此覆盖冲突，以本段和 `DESIGN.md`/`SPEC.md` 为准。

## 信任边界

单 HTML 是项目与交付物的唯一事实来源。Studio、UI、WebMCP 和第一方 CDP bridge 都只能修改隔离草稿；AI 不能代替工程师执行最终生产导出。

`pf-attestation` 是防篡改验证记录，不是组织数字签名，也不证明业务数据本身正确。金额、税额、折扣与总计继续由 ERP 后端负责，模板只显示、格式化和校验一致性。

## Current：已实现

- Trusted 文件限制 executable script，并通过内容/runtime hash 检查受支持结构。
- 任意自定义 script（含模板 `<script`、主题 `</style` 逃逸）会将项目降级为 `Untrusted`；`validateProject` 会从内容独立重推导可执行标记，不只信存储的 flag。
- 「重置信任」会物理剥离 script 元素、`on*` 事件属性与 `javascript:` URL，而不是只翻回 flag（2026-07-31）。
- Preview 使用无同源、无网络权限的 sandbox iframe；预览消息仅在 `event.source` 等于该 iframe 的 `contentWindow` 时受理，伪造的渲染报告无法清除导出门禁（2026-07-31）。
- 打印预览拒绝 `Untrusted` 项目，并在导航 blob URL 前切断 `window.opener`（2026-07-31）。
- revision 使用永不复用的单调编号；undo 后提交产生新编号，过期 `expectedRevision` 稳定返回 `REVISION_CONFLICT`（2026-07-31）。
- `set_manifest_value` 拒绝 `__proto__`/`constructor`/`prototype` 路径段，防止原型污染放宽资产策略（2026-07-31）。
- UI、WebMCP 与 CDP 适配器共用命令总线与 revision 检查；WebMCP 注册在标准位置 `navigator.modelContext`（兼容 `registerTool` 与 `provideContext`）。
- 当前 revision 的浏览器 RenderReport（含元素级 issues：selector、页码、坐标）和 AI review receipt 会影响导出 readiness。
- 最终生产导出需要工程师在 UI 中确认。

## Current：Pilot 限制

- ✅ 已解除（2026-07-31）：`preview_changes` 现在真实分页候选项目（复用可见预览 iframe，非隐藏 iframe——见[工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) P0-A 第 3 项）。
- ✅ 已升级（2026-08-17）：`apply_changes` 只能提交已批准 transaction 的 candidate；必须匹配 transaction ID、revision 与 candidate hash，公共契约不接受直接传 `operations[]`。命令总线仍可复用已渲染 candidate report，并在候选内容变化时 fail closed。
- ✅ 已解除（2026-07-31）：review evidence 改为 Studio 签发的 receipt，Agent 自述标签被拒（见下方《验收证据》）。
- ✅ 已解除（2026-07-31）：预览消息除 `event.source` 外还绑定单调请求 token（跨 iframe reload 存活，只采纳最新一次请求的回执）；candidate hash 由 `preview_changes` 返回。
- ✅ 已解除（2026-07-31）：attestation 覆盖两段 runtime hash + CSP script 允许列表，`browsers` 由真实 evidence receipt 推导（见下方《完整性与证明》）。内容无遗漏、乱序、重叠由 `ROW_*` 四项 + `HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` 覆盖。

**六项 P0 的代码硬门已于 2026-07-31 全部完成**，浏览器矩阵验收也已跑满并留存结论（88/88 全过，见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)）。状态**仍暂记为 Production Pilot**：矩阵发现 Purchase Order 的分页页数随引擎变化（500 行时 Chromium 34 页 / Firefox 36 页，功能无缺陷但打印张数不同），该差异是接受还是修复尚未决策；Production Ready 是对外承诺，由维护者显式宣布，不由跑批绿灯自动推导。

## 数据隐私

Current 默认策略（未知 HTML 或 JSON 一律视为可能含真实 ERP 数据）：

- 默认不写入恢复缓存、日志、诊断包或 Agent 返回值。
- Agent 默认只读取 schema、模板结构、布局指标和生成的边界数据。
- 真实数据需要工程师逐会话明确授权，授权不跨刷新或新会话保留。
- 授权真实数据时关闭草稿恢复缓存；导出项目不得偷偷包含额外缓存副本。
- 不提供默认遥测；诊断资料由用户脱敏后主动导出。

## Backlog（早期设想，已评估未采纳）：破坏性两阶段提交

本节是 Agent Contract 2.0 最初设想的写路径重设计；2026-08-17 已落地为公共事务化写路径。真实契约版本历史是 1.1.0→1.2.0（候选渲染能力）→2.0.0（`complete_layout_review` 改用 `evidenceIds`）→2.1.0（operation catalog、design inspection 与安全 apply flags）→3.0.0（FormSpec、transaction gate、persistent journal/evidence 与 raw Agent write 收口）。

以下是当初设想、未采纳的具体形状，保留仅供历史参考：

所有写命令先根据共享 JSON Schema 验证。`operations` 使用按 `type` 区分的联合契约，不接受未知操作或额外字段（**这部分已实现**，见 `core/operation-schemas.js`）。

设想中的真实候选预览（未采纳的调用形状）：

```js
preview_changes({ expectedRevision, operations, scenarios })
// => {
//   previewId, revision, candidateHash, diff,
//   scenarioReports, expiresAt
// }
```

历史设想中的原子提交（当前公共 API 已采用等价的显式事务形状）：

```js
apply_changes({ expectedRevision, previewId, candidateHash, reason })
```

revision 使用永不复用的单调编号——**这部分已实现**，undo 创建新的 revision identity，而不是回到可再次命中的旧编号。

## Current：验收证据（2026-07-31 实现）

`capture_layout_evidence({ expectedRevision, scenario })` 让 Studio 把该场景渲染成**未提交的候选**（复用可见预览 iframe，不推进 revision——否则捕获 long-text 就会作废刚拿到的 default 证据），渲染干净时签发 Evidence Receipt：

```js
{
  evidenceId,
  revision,
  scenario,
  browser: { name, version },
  layoutFingerprint,   // sha256(每页直接子元素的 class + 页内相对整数矩形)
  renderReportHash,    // sha256(完整渲染报告)
  visualMode,          // "geometry" or synthetic-data-only "pixels"
  pixelSnapshotHash,   // only present for synthetic pixel evidence
  metrics,
  createdAt
}
```

**证据仍以 Studio 自己测量的几何指纹为基础。** synthetic-data session 可显式请求 `visualMode: "pixels"`，像素在 sandbox iframe 内由 DOM-to-canvas rasterizer 生成；它不携带源 URL，图片位置使用安全 placeholder，并以 `pixelSnapshotHash` 参与视觉回归比较。real-data session 在 gateway 层硬拒绝像素模式（`PIXEL_EVIDENCE_SYNTHETIC_ONLY`），只允许 geometry-only SVG，因此业务值不会进入像素 evidence。`layoutFingerprint` 用**页内相对坐标**，并由 evidence 的 `baseProjectHash` 绑定当前 draft，否则同一份证据不能证明当前项目。

渲染不干净的场景不签发证据（`evidence: null`），但返回该场景的 validation 供 Agent 修复——这是唯一能看到未提交场景真实错误的途径。无渲染器的会话（CLI 校验器、单测）返回 `EVIDENCE_UNAVAILABLE`，绝不伪造 receipt。

`complete_layout_review` 只接受 Studio 已签发的 `evidenceIds`、findings 和 summary，且必须覆盖 `default` 与 `long-text` 两个场景；旧式 `evidence`/`browser`/`scenarios` 自述字段一律 `EVIDENCE_RECEIPT_REQUIRED`（即便同时附了有效 receipt 也拒绝——留着旧路径等于没做这件事）。伪造 id 报 `EVIDENCE_UNKNOWN`，跨 revision 的 receipt 报 `EVIDENCE_STALE`。任何 mutation/undo 都会清空 receipt store，旧证据不能为新内容背书。

Agent 可以发现和修复问题，但 Studio 不能控制外部 Agent 是否停止发言。技术上强制的是：没有有效证据就不能取得 Production Ready 凭证或请求生产导出。

## Current：完整性与证明（2026-07-31 实现）

- ✅ Preview bridge 校验 `event.source`、目标 iframe、跨 iframe reload 存活的单调请求 token（等价于一次性 nonce）、revision；candidate hash 由 `preview_changes` 返回。
- ✅ 每个业务行具有稳定 identity（`data-pf-row-index`，源数组下标，穿过整个分页流程不丢失）。
- ✅ RenderReport 比较输入与输出数量、顺序，检测重复、遗漏、重叠、越界与重复区缺失。
- ✅ Attestation 覆盖 document runtime hash、PrintForm runtime hash、CSP script hash 允许列表、权威内容 hash 与真实浏览器凭证（`layoutReview` 内嵌 evidence receipt 摘要）。修改任一 runtime 都会在导入与 `validate:v2` 时被拒，且两段 runtime 用不同错误码区分（`RUNTIME_HASH_MISMATCH` / `PRINTFORM_RUNTIME_HASH_MISMATCH`）。
- ✅ 浏览器声明只来自实际签发过 evidence receipt 的会话；无审查的导出 `browsers` 为空数组（诚实留空，不虚报）。跨引擎覆盖由 CI 的 Playwright 三引擎矩阵背书，不写进每份文件。

## Trusted 与 Untrusted

| 状态 | 允许行为 | 禁止行为 |
|---|---|---|
| Trusted Pilot | 沙箱预览、验证、人工导出 | 宣称已达到 Production Ready |
| Trusted Production Ready | 通过全部硬门后由工程师确认导出 | AI 自动确认或绕过系统打印预览 |
| Untrusted | 沙箱运行、人工检查、明确风险后导出 | 生成生产有效凭证 |

六项 P0 硬门不得人工豁免。需要任意 JavaScript 的项目必须保持 `Untrusted`，不能通过修改 attestation 恢复 Trusted。

## 契约升级

Agent Contract 3.0.0 已于 2026-08-17 切换（`core/constants.js`）。2.1.0 的 operation catalog/design inspection 与 layout review 能力继续保留；3.0.0 收紧公共 Agent 写路径，增加 FormSpec、transaction、diagnostics、revision/evidence 查询工具。`complete_layout_review` 仍要求 `evidenceIds`，拒绝旧式自述字段。

其余读取路径保持兼容；公共 Agent 的写路径则以 3.0.0 的 fail-closed transaction contract 为准。Studio 内部 raw source/editor 命令不是 Agent 工具，也不构成对外写入兼容承诺。

WebMCP、第一方 CDP bridge 与 UI 共享同一 `CommandBus.execute`，天然同步切换。当前能力以 `get_capabilities` 返回的 `contractVersion` 与 `capabilities` 为准（`candidateHash`、`candidateRealRender`、`layoutEvidenceReceipts`）。
