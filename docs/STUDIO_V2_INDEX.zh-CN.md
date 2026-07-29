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
| 理解 AI 与安全边界 | [信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md) | Current 限制与 Target 信任闭环 |
| 安排工程实施 | [工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) | P0–P3 依赖、接口和退出条件 |
| 执行发布验收 | [发布检查表](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md) | Pilot 检查与 Production Ready 硬门 |
| 配置 Codex/Claude | [Agent setup](../studio-v2/AGENT_SETUP.md) | Current MCP/WebMCP 接入步骤 |
| 维护旧 Studio | [Studio v1 设计](STUDIO_DESIGN.zh-CN.md) | Legacy v1，不是 v2 规范 |

## 当前能力快照

| 能力 | 状态 | 说明 |
|---|---|---|
| 自包含单 HTML | Current | 协议、样本、主题与两段 runtime 可封装在同一文件 |
| 声明式数据绑定 | Current | 使用 JSON Pointer；不执行表达式或业务公式 |
| Studio 静态 PWA | Current | 可部署到 GitHub Pages，并缓存最后成功的应用壳 |
| UI/WebMCP/CDP 命令面 | Current | 共用命令总线，但当前仍是 Agent Contract 1.x |
| 五语言打印内容与 Studio UI | Current | `en-MY`、`zh-CN`、`ms-MY`、`ja-JP`、`vi-VN` |
| 人工生产导出确认 | Current | AI/MCP 不能代替最终点击 |
| 候选项目真实分页 dry-run | Target | 当前 dry-run 只做内存变更、静态验证与摘要 diff |
| Studio 签发的截图证据 | Target | 当前 review receipt 依赖 Agent 提交的文字声明 |
| 双 runtime 完整证明 | Target | 当前证明范围尚未覆盖完整 Production Ready 要求 |
| 内容顺序、遗漏与重叠证明 | Target | 当前指标不足以证明这些不变量 |

## 成熟度规则

Production Pilot 可以用于受控试点，但工程师必须检查浏览器系统打印预览。只有以下六项全部完成，才可将状态改为 Production Ready：

1. 候选项目在隔离浏览器中执行真实分页 dry-run。
2. revision 永不复用，写操作使用有效 preview receipt 原子提交。
3. Studio 签发场景报告与截图证据，Agent 不能自我声明证据。
4. Preview 消息验证目标 iframe、一次性 nonce、revision 与 candidate hash。
5. Attestation 覆盖两段 runtime、CSP、内容与真实浏览器凭证。
6. 自动检查内容数量、顺序、重复、遗漏、重叠、越界与重复区完整性。

这些硬门不得通过人工勾选绕过。自定义脚本仍可作为 `Untrusted` 草稿人工导出，但不能获得生产有效凭证。

## 稳定边界

- 单 HTML 继续是唯一事实来源，不增加 ZIP、sidecar schema 或必需构建步骤。
- Studio v1 继续冻结并并存，不自动迁移旧模板。
- AI 只参与设计与检查；导出 HTML 不依赖 AI、WebMCP 或 MCP。
- 最终输出依赖浏览器系统打印，不内置 PDF 引擎或云端 PDF 服务。
- 移动端只保证查看和数据渲染，不承诺一致打印分页。
