# PrintForm Studio v2 信任与代理模型

> 状态：Production Pilot
>
> Current 描述当前代码；Target 定义 Agent Contract 2.0 与 Production Ready 信任闭环。

## 信任边界

单 HTML 是项目与交付物的唯一事实来源。Studio、UI、WebMCP 和第一方 CDP bridge 都只能修改隔离草稿；AI 不能代替工程师执行最终生产导出。

`pf-attestation` 是防篡改验证记录，不是组织数字签名，也不证明业务数据本身正确。金额、税额、折扣与总计继续由 ERP 后端负责，模板只显示、格式化和校验一致性。

## Current：已实现

- Trusted 文件限制 executable script，并通过内容/runtime hash 检查受支持结构。
- 任意自定义 script 会将项目降级为 `Untrusted`。
- Preview 使用无同源、无网络权限的 sandbox iframe。
- UI、WebMCP 与 CDP 适配器共用命令总线与 revision 检查。
- 当前 revision 的浏览器 RenderReport 和 AI review receipt 会影响导出 readiness。
- 最终生产导出需要工程师在 UI 中确认。

## Current：Pilot 限制

- `preview_changes` 尚未在隔离 iframe 中真实分页候选项目。
- `apply_changes` 尚未要求 Studio 签发的 preview receipt。
- undo 后可能重新使用旧 revision 数字。
- 当前 review evidence 是 Agent 提交的标签，不是 Studio 保存并签发的截图证据。
- Preview 消息尚未同时绑定目标 iframe、一次性 nonce、revision 与 candidate hash。
- 当前 attestation 与布局指标不足以证明两段 runtime 完整性，以及内容无遗漏、乱序和重叠。

因此 Current 状态只能称为 Production Pilot。

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

## Target：验收证据

Studio 为每次受支持场景签发 Evidence Receipt：

```js
{
  evidenceId,
  revision,
  candidateHash,
  scenario,
  browser: { name, version },
  screenshotHash,
  renderReportHash,
  metrics,
  createdAt
}
```

`complete_layout_review` 只接受 Studio 已签发的 `evidenceIds`、findings 和 summary。Agent 不能用字符串声明自己已经看过截图。任何项目、locale、样本、主题、模板或资源变更都会使旧证据失效。

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

Agent Contract 2.0 是破坏性升级。WebMCP、第一方 CDP bridge 与 UI 必须同时切换并通过同一契约测试；旧 1.x 写入命令只返回升级提示，不保留兼容写路径。当前命令仍以 `get_capabilities` 返回的 contract version 为准。
