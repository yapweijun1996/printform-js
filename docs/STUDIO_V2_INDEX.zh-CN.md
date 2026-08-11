# PrintForm Studio v2 文档索引

> 产品状态：**Production Pilot**
>
> 目标用户：熟悉 ERP、HTML/CSS 与 JSON 的工程师
>
> 权威语言：中文；英文 README 与 Agent setup 只提供摘要和入口

## 状态词

- **Current**：仓库当前已经实现，并有相应测试或人工验证依据。
- **Target**：达到 Production Ready 前已经决定、但尚未全部实现的行为。
- **Backlog**：P1–P3 方向，不构成当前版本承诺。

任何 Target 或 Backlog 内容都不得写入当前协议文档，或在 README 中描述为已经可用。

## 阅读顺序

| 目的 | 文档 | 权威范围 |
|---|---|---|
| 判断产品适用性 | [产品策略](STUDIO_V2_PRODUCT_STRATEGY.zh-CN.md) | 用户、非目标、指标、模板策略 |
| 理解当前单 HTML | [协议 v2](PRINTFORM_V2_PROTOCOL.zh-CN.md) | Current 文件结构、绑定与 runtime API |
| 理解 AI 与安全边界 | [信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md) | 六项 P0 信任闭环硬门（Current，代码已完成）与已评估未采纳的历史设想（Backlog） |
| 安排工程实施 | [工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) | P0–P3 依赖、接口和退出条件 |
| 执行发布验收 | [发布检查表](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md) | Pilot 检查与 Production Ready 硬门 |
| 查版本与组合兼容性 | [兼容矩阵](COMPATIBILITY_MATRIX.zh-CN.md) | 四条独立版本线、各自 SSOT 与升 major 判据 |
| 配置 Codex/Claude | [Agent setup](../studio-v2/AGENT_SETUP.md) | Current MCP/WebMCP 接入步骤 |
| 维护旧 Studio | [Studio v1 设计](STUDIO_DESIGN.zh-CN.md) | Legacy v1，不是 v2 规范 |

## 当前能力快照

| 能力 | 状态 | 说明 |
|---|---|---|
| 自包含单 HTML | Current | 协议、样本、主题与两段 runtime 可封装在同一文件 |
| 声明式数据绑定 | Current | 使用 JSON Pointer；不执行表达式或业务公式 |
| Studio 静态 PWA | Current | 可部署到 GitHub Pages，并缓存最后成功的应用壳 |
| UI/WebMCP/CDP 命令面 | Current | 共用同一 `CommandBus.execute`；Agent Contract **2.1.0**，18 个工具，含 operation catalog/design inspection 与候选安全 flags |
| 嵌入式 AI Designer | Current | 可折叠 side panel；默认 own-gpt-server 走公开 server-auth gateway（无需浏览器解锁），OpenAI/Gemini/Custom BYOK 仍使用加密 vault；会话、stream/Stop、preview→validated auto-apply→validation、Undo/Redo；生产导出仍由人工完成 |
| 五语言打印内容与 Studio UI | Current | `en-MY`、`zh-CN`、`ms-MY`、`ja-JP`、`vi-VN` |
| 人工生产导出确认 | Current | AI/MCP 不能代替最终点击 |
| 单调 revision（undo 不复用） | Current | 2026-07-31 落地；过期写入稳定返回 `REVISION_CONFLICT` |
| 预览消息目标 iframe 校验 | Current | `event.source === contentWindow`；一次性 nonce 需求已并入候选渲染的请求 token 排序机制（不再单列为独立项）；candidate hash 已实现 |
| 元素级布局诊断 | Current | 渲染报告 issues 带页内 selector、页码与坐标，经 `validate_project` 暴露 |
| 候选项目真实分页 dry-run | Current | `preview_changes`/`apply_changes` 复用可见预览 iframe 做真实分页渲染（非仅内存校验+静态 diff），按 `candidateHash` 缓存渲染报告 |
| Studio 签发的布局证据 | Current | Studio 自测的**几何指纹**（`layoutFingerprint`）与可选 geometry-only SVG；synthetic mode 可选 bounded pixel raster + `pixelSnapshotHash`，real-data mode 硬拒绝像素，receipt 同时绑定 revision/`baseProjectHash` |
| 双 runtime 完整证明 | Current | `printformRuntimeHash`（分页引擎）+ 既有 document runtime hash + `cspScriptHashes`；`browsers` 由 evidence receipt 推导，非硬编码 |
| 内容顺序、遗漏与重叠证明 | Current | `ROW_COUNT_MISMATCH`/`ROW_DUPLICATE_INDEX`/`ROW_MISSING_INDEX`/`ROW_ORDER_MISMATCH`/`HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` 全部落地 |
| 工程师结构化面板 | Current | Table columns、Print font scale、Page settings、Repeated areas、Brand color；Data contract 仍是 Backlog |

## 成熟度规则

Production Pilot 可以用于受控试点，但工程师必须检查浏览器系统打印预览。以下六项 P0 硬门的**代码部分已于 2026-07-31 全部完成**：

1. ✅ 候选项目在复用的可见预览 iframe 中执行真实分页渲染，`apply_changes` 命中同一 `candidateHash` 直接复用报告提交。
2. ✅ revision 永不复用；写操作用 `expectedRevision` + `candidateHash` 内容寻址天然防止旧预览被提交（未做破坏性两阶段提交，评估后判定当前机制已达成同等安全目标）。
3. ✅ Studio 签发几何指纹布局证据（`capture_layout_evidence`），Agent 不能自我声明证据（`complete_layout_review` 只接受 `evidenceIds`）。
4. ✅ Preview 消息验证目标 iframe + 跨 iframe reload 的单调请求 token（原「一次性 nonce」需求已并入此机制）+ revision 与 candidate hash。
5. ✅ Attestation 覆盖两段 runtime hash、CSP script hash、内容 hash 与由 evidence receipt 推导的真实浏览器凭证。
6. ✅ 自动检查内容数量、顺序、重复、遗漏、重叠、越界、对比度与重复区完整性。

**但这不等于 Production Ready**：该状态是对外承诺，由维护者显式宣布，不由代码硬门齐全自动推导。路线图 P0-B 退出条件还包含发布流程验收——两模板 × 四浏览器目标 × 全边界场景，已在 macOS 与 Linux（GitHub Actions Ubuntu runner）两个操作系统上各跑满 88/88 全过、零跨引擎分歧（见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)），仅 Windows 尚未验证。这些硬门不得通过人工勾选绕过。自定义脚本仍可作为 `Untrusted` 草稿人工导出，但不能获得生产有效凭证。

## 稳定边界

- 单 HTML 继续是唯一事实来源，不增加 ZIP、sidecar schema 或必需构建步骤。
- Studio v1 继续冻结并并存，不自动迁移旧模板。
- AI 只参与设计与检查；导出 HTML 不依赖 AI、WebMCP 或 MCP。
- 最终输出依赖浏览器系统打印，不内置 PDF 引擎或云端 PDF 服务。
- 移动端只保证查看和数据渲染，不承诺一致打印分页。
