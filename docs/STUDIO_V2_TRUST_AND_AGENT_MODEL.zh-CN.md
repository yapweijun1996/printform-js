# PrintForm Studio v2 信任与代理模型

> 状态：Production Pilot
>
> Current 描述当前代码；Target 定义尚未实现的 Production Ready 信任闭环。Agent Contract 2.0.0 已实现（见《契约升级》）。

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
- ✅ 已解除（2026-07-31）：`apply_changes` 命中 candidateHash 缓存时复用已渲染报告，未命中则内联真实渲染后再提交，不存在绕过真实渲染的提交路径。仍接受直接传 `operations[]`（经确认的非破坏性设计，信任目标已达成）。
- ✅ 已解除（2026-07-31）：review evidence 改为 Studio 签发的 receipt，Agent 自述标签被拒（见下方《验收证据》）。
- ✅ 已解除（2026-07-31）：预览消息除 `event.source` 外还绑定单调请求 token（跨 iframe reload 存活，只采纳最新一次请求的回执）；candidate hash 由 `preview_changes` 返回。
- 当前 attestation 与布局指标不足以证明两段 runtime 完整性（TASK.md #19 未完成）。内容无遗漏、乱序、重叠已由 `ROW_*` 四项 + `HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` 覆盖。

因此 Current 状态仍称 Production Pilot：代码层硬门只差 #19，但路线图 P0-B 退出条件还包含"两模板 × 四浏览器 × 全边界场景"这类发布流程验收，不是代码改动能单独达成的。

## 数据隐私

Target 默认策略：未知 HTML 或 JSON 一律视为可能含真实 ERP 数据。

- 默认不写入恢复缓存、日志、诊断包或 Agent 返回值。
- Agent 默认只读取 schema、模板结构、布局指标和生成的边界数据。
- 真实数据需要工程师逐会话明确授权，授权不跨刷新或新会话保留。
- 授权真实数据时关闭草稿恢复缓存；导出项目不得偷偷包含额外缓存副本。
- 不提供默认遥测；诊断资料由用户脱敏后主动导出。

## Target：Agent Contract 2.0

所有写命令先根据共享 JSON Schema 验证。`operations` 使用按 `type` 区分的联合契约，不接受未知操作或额外字段。

真实候选预览：

```js
preview_changes({ expectedRevision, operations, scenarios })
// => {
//   previewId, revision, candidateHash, diff,
//   scenarioReports, expiresAt
// }
```

`scenarioReports` 至少包含 `default` 与 `long-text` 的验证、分页和内容完整性结果。preview 只存在于隔离草稿，过期后不可提交。

原子提交：

```js
apply_changes({ expectedRevision, previewId, candidateHash, reason })
```

`apply_changes` 不再接受新的 operations。preview 过期、revision 冲突、hash 不符或存在生产硬错误时，整组失败且草稿不变。

revision 使用永不复用的单调编号。undo 创建新的 revision identity，而不是回到可再次命中的旧编号。

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
  metrics,
  createdAt
}
```

**证据是 Studio 自己测量的几何指纹，不是像素截图。** 权衡记录（2026-07-31 与用户确认）：预览 iframe 是不透明 origin 沙箱，父页读不到其 DOM，真像素只能在 iframe 内走 foreignObject→canvas，有 canvas 污染风险、字体保真缺陷、单张数 MB，且像素在真实数据模式下**就是业务数据**（与本文《数据隐私》默认策略直接冲突）。而 #18 要防的是"Agent 谎称自己看过"——Studio 自己渲染、自己测量的报告本身就是事实，给它签名即已达成防伪造。Agent 仍可用自己的 CDP 截图工具看像素，只是那不构成证据。`layoutFingerprint` 用**页内相对坐标**，否则同一份布局在不同滚动位置会哈希出不同值。

渲染不干净的场景不签发证据（`evidence: null`），但返回该场景的 validation 供 Agent 修复——这是唯一能看到未提交场景真实错误的途径。无渲染器的会话（CLI 校验器、单测）返回 `EVIDENCE_UNAVAILABLE`，绝不伪造 receipt。

`complete_layout_review` 只接受 Studio 已签发的 `evidenceIds`、findings 和 summary，且必须覆盖 `default` 与 `long-text` 两个场景；旧式 `evidence`/`browser`/`scenarios` 自述字段一律 `EVIDENCE_RECEIPT_REQUIRED`（即便同时附了有效 receipt 也拒绝——留着旧路径等于没做这件事）。伪造 id 报 `EVIDENCE_UNKNOWN`，跨 revision 的 receipt 报 `EVIDENCE_STALE`。任何 mutation/undo 都会清空 receipt store，旧证据不能为新内容背书。

Agent 可以发现和修复问题，但 Studio 不能控制外部 Agent 是否停止发言。技术上强制的是：没有有效证据就不能取得 Production Ready 凭证或请求生产导出。

## Target：完整性与证明

- Preview bridge 校验 `event.source`、目标 iframe、一次性 nonce、revision 和 candidate hash。
- 每个业务行和关键区块具有稳定 identity。
- RenderReport 比较输入与输出数量、顺序和 checksum，并检测重复、遗漏、重叠、越界和重复区缺失。
- Attestation 覆盖 document runtime、PrintForm runtime、CSP script hash、权威内容 hash 与真实浏览器凭证。
- 浏览器声明只能来自实际测试 receipt，不能由 Studio 固定写入全部浏览器名称。

## Trusted 与 Untrusted

| 状态 | 允许行为 | 禁止行为 |
|---|---|---|
| Trusted Pilot | 沙箱预览、验证、人工导出 | 宣称已达到 Production Ready |
| Trusted Production Ready | 通过全部硬门后由工程师确认导出 | AI 自动确认或绕过系统打印预览 |
| Untrusted | 沙箱运行、人工检查、明确风险后导出 | 生成生产有效凭证 |

六项 P0 硬门不得人工豁免。需要任意 JavaScript 的项目必须保持 `Untrusted`，不能通过修改 attestation 恢复 Trusted。

## 契约升级

Agent Contract 2.0.0 已于 2026-07-31 切换（`core/constants.js`）。破坏性变更**只有一处**：`complete_layout_review` 改为要求 `evidenceIds`，拒绝旧式 `evidence`/`browser`/`scenarios` 自述字段——保留它们等于让 Agent 继续自证，#18 的安全目标会归零，所以这里必须破。

其余写路径**保持向后兼容**：`apply_changes` 仍接受直接传 `operations[]`（1.2.0 加入的真实候选渲染是可加能力，非破坏性）。这与本文早期设想的"2.0 不保留任何 1.x 写路径"不同——真实实现中信任目标已由候选真实渲染达成，无必要连带破坏调用方式。

WebMCP、第一方 CDP bridge 与 UI 共享同一 `CommandBus.execute`，天然同步切换。当前能力以 `get_capabilities` 返回的 `contractVersion` 与 `capabilities` 为准（`candidateHash`、`candidateRealRender`、`layoutEvidenceReceipts`）。
