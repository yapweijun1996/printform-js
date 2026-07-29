# PrintForm Studio v2 产品策略

> 状态：Production Pilot
>
> 本文同时记录 Current 定位与 Backlog 产品方向，不替代当前协议。

## 产品定位

PrintForm Studio v2 是面向 ERP 工程师的 AI 辅助打印表单编译器与质量检查器。它把数据契约、声明式模板、主题、样本和固定 runtime 封装成一份可读、可手改、自包含的 HTML。

它不是自由画布、客户低代码平台或云端 PDF 服务。产品价值不是让所有人设计任何页面，而是让工程师更快交付可集成、可审查、可重复验证的业务打印表单。

## 第一用户

主要用户熟悉 ERP 数据、HTML/CSS 与 JSON，常见任务包括：

- 从数据 schema 和样本建立销售发票或采购订单。
- 调整 letterhead、字体层级、表格列、重复区与 footer。
- 用边界数据检查多页分页、长文本、多语言与合计区。
- 将最终 HTML 接入 ColdFusion、JavaScript 或其他 ERP 后端。
- 使用 Codex、Claude Code 或其他 Agent 提议修改，再人工批准。

第三方库开发者是次要用户；非技术业务人员不是当前目标用户。

## 要解决的问题

传统打印表单的失败通常不是“无法写 HTML”，而是修改后无法快速证明：

- 数据是否符合契约，普通值是否安全转义。
- 每页是否正确重复文档信息和表头。
- 长表格是否丢行、重复、乱序、重叠或越界。
- AI 修改的到底是什么，预览是否就是待提交候选版本。
- 导出文件是否仍使用已批准的 runtime 和内容。

Studio v2 因此优先建设确定性渲染、语义 diff、证据与 fail-closed 质量门，而不是增加自由设计能力。

## Current 用户流程

1. 导入单 HTML 或选择 Sales Invoice／Purchase Order 样本。
2. 在结构化源码区编辑 manifest、schema、i18n、CSS、HTML 与样本数据。
3. Studio 在 sandbox iframe 中渲染当前草稿并显示分页指标。
4. UI 或 Agent 调用共享命令总线修改 revision。
5. AI 按检查表审阅默认与长文本场景，并提交当前的 review receipt。
6. 工程师确认系统打印预览后，点击生产导出。

这是受控试点流程；当前 receipt 和 dry-run 的限制见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)。

## Target 用户流程

1. 未知导入默认按真实 ERP 数据处理，不缓存且不暴露给 Agent。
2. 工程师主要使用 Branding、Page、Repeated areas、Table、Locale 和 Data contract 面板。
3. Raw HTML/CSS/JSON 保留在 Advanced 模式。
4. Agent 先取得真实候选分页结果和持久化 semantic diff，再请求原子提交。
5. Studio 对每个场景签发 RenderReport 与截图证据。
6. 六项 P0 硬门通过后，工程师才能确认 Production Ready 导出。

## 非目标

- 不建设 Canva 式任意定位、图层或富文本画布。
- 不在模板中执行 `eval`、任意表达式或业务金额计算。
- 不让 AI 自动点击生产确认或替工程师承担打印验收责任。
- 不默认上传真实数据、遥测、截图或诊断资料。
- 不要求不同浏览器像素完全一致。
- 不以移动浏览器作为一致打印目标。

## 模板策略

Production Ready 前只固化两个生产试点：

- Sales Invoice：验证金额、税额、明细、合计和大数据量分页。
- Purchase Order：验证多区块文档信息、每页重复、条款、审批与最后页 footer。

Quotation、Delivery Order、Credit Note 等进入 Backlog。只有两个试点都通过 P0 硬门和四浏览器功能保证后，才建立版本化模板目录。

## 产品指标

北极星指标：

> 从 ERP schema + sample JSON 到工程师批准的 Trusted 单 HTML 所需的中位时间。

质量护栏：

- 内容丢失、重复、乱序、重叠和越界为零。
- 所有生产导出都能验证 attestation，且保留人工确认。
- 100 行首次可见不超过 2 秒，500 行完整分页不超过 5 秒。
- 记录首次验收通过率、人工修正次数和导出阻断原因。

默认不上传遥测；指标通过本地、脱敏、用户主动分享的诊断报告收集。

## 成熟度与发布

| 阶段 | 产品承诺 |
|---|---|
| Production Pilot | 可用于受控工程试点；必须人工检查系统打印预览 |
| Production Ready | 六项 P0 硬门全部由自动测试和真实浏览器证据证明 |
| Template Scale | P1 工程体验稳定后，才扩展模板目录与迁移治理 |

Protocol、PrintForm runtime 与 Studio 分别采用独立 SemVer，并通过兼容矩阵说明组合关系。
