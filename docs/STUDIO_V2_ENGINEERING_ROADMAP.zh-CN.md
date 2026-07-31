# PrintForm Studio v2 工程路线图

> 本文全部属于 Target 或 Backlog；当前可用行为以[协议文档](PRINTFORM_V2_PROTOCOL.zh-CN.md)和 `get_capabilities` 为准。

## 原则

- 先让已有承诺成为可证明的闭环，再扩展模板与自由度。
- 单 HTML 保持唯一事实来源；内存模型只负责稳定 parse/serialize。
- v1 Studio 冻结并独立维护，分页引擎采用兼容式渐进重构。
- 所有错误 fail-closed；人工可以导出 Untrusted，但不能豁免生产硬门。
- UI、WebMCP 与 CDP 共享命令契约和测试，不复制业务逻辑。

## P0-A：事务闭环

目标：Agent 看到、批准和提交的是同一份真实分页候选项目。

1. 为所有命令执行共享 JSON Schema 校验，operations 改为 discriminated union。
2. ✅ 已实现（2026-07-31，commit `1bc63d7`）：永不复用的 revision counter；undo 后提交产生新 revision identity。
3. 在隐藏 sandbox iframe 中渲染 candidate，不复用当前草稿的 RenderReport。
4. `preview_changes` 返回 `previewId`、candidate hash、语义 diff、场景报告和过期时间。
5. `apply_changes` 只消费有效 preview receipt，不接受新 operations。
6. 任一验证、分页、完整性或容量错误使整组提交回滚。

退出条件：

- stale revision、过期 preview、hash mismatch 和未知 operation 都有稳定错误码。
- default 与 long-text candidate 报告绑定同一 candidate hash。
- undo 后的旧写命令永远不能命中新状态。
- UI、WebMCP、CDP 对相同输入返回一致结果。

## P0-B：信任闭环

目标：生产导出依赖真实、可追溯、不可自我声明的浏览器证据。

1. Preview channel 加入目标 frame（✅ 2026-07-31 已实现 `event.source` 校验）、nonce、revision 与 candidate hash 验证（nonce 与 hash 未实现）。
2. Studio 捕获场景截图和 RenderReport，并签发 Evidence Receipt。
3. `complete_layout_review` 改为引用 evidence IDs。
4. 为业务行和关键区块增加稳定 identity，验证数量、顺序、重复与遗漏。
5. 使用矩形碰撞和重复区不变量检测重叠、越界及 header/docinfo/footer 缺失。
6. Attestation 覆盖两段 runtime、CSP、内容与实际浏览器 receipt。
7. `request_export` 汇总所有 blocker，最终点击仍只允许工程师执行。

退出条件：

- Agent 伪造 evidence 标签、其他 frame 伪造消息或修改任一 runtime 都会阻断。
- Sales Invoice 与 Purchase Order 在四浏览器通过空值、1、45、100、500 行、长文本和多语言场景。
- 共同硬标准为无丢失、重复、乱序、重叠和越界，页码与重复区正确。
- 六项 P0 全部完成后，才将文档状态改为 Production Ready。

## P1：工程师工作流

- 默认提供 Branding、Page、Repeated areas、Table columns、Locale 和 Data contract 面板。
- Raw HTML/CSS/JSON 移入 Advanced 模式，仍可手改并稳定 round-trip。
- 用持久化 semantic diff drawer 取代一次性 confirm 对话框。
- 图片支持文件选择、尺寸/比例/大小/alt 检查，并以单一事务修改多个 asset slot。
- 草稿按源文件 fingerprint 保存、限时保留；未知导入默认关闭缓存。
- 生成 JSON Schema 示例、边界数据及 `validate`/`render` ERP 接入片段。
- 连接状态区分 WebMCP registered、CDP discovered、Agent connected 与 last command。

退出条件：工程师无需编辑大段原始 JSON/CSS，即可完成两个标准模板的常见品牌、页面、表格与 locale 修改。

## P2：分页引擎演进

- 引入每个表单独立的 `PaginationSession`、`PageContext`、`LayoutPlan` 与 `RenderResult`。
- `formatAll()` 始终返回 Promise 和结构化结果，不吞掉 formatter 错误。
- 保持现有 class、`data-*` 与 v1 ERP DOM 行为；每一步用旧样本做回归。
- 预先测量并缓存行高度，减少 clone/append/measure/remove 造成的 layout thrashing。
- 以结构化 trace event 取代 Studio 对 console 的依赖。
- 为同一 major 建立显式 minor migration registry 和 golden fixtures。

退出条件：100 行首次可见不超过 2 秒，500 行完整分页不超过 5 秒，且 v1 关键路径无回归。

## P3：发布治理

- Protocol、PrintForm runtime 与 Studio 分别使用独立 SemVer。
- 发布兼容矩阵、CHANGELOG、实际 LICENSE、runtime checksums 与迁移说明。
- GitHub Release 附两个经过验证的自包含单 HTML 试点文件。
- 构建过程生成 Service Worker precache manifest，避免手工列表漂移。
- 每个浏览器维护独立截图/打印基线和容差，不比较跨引擎像素一致性。
- 建立版本化模板目录；新模板必须继承完整边界数据与浏览器矩阵。

## 发布顺序

| 里程碑 | 内容 | 对外状态 |
|---|---|---|
| 2.1 Trust A | P0-A 事务闭环、Agent Contract 2.0 | Production Pilot |
| 2.2 Trust B | P0-B 信任闭环、两个模板全矩阵 | Production Ready 候选 |
| 2.3 Workflow | P1 工程师结构化体验 | Production Ready |
| 2.4 Engine | P2 分页 session 与性能 | Production Ready |
| 3.0 Governance | P3 独立版本与模板目录 | Template Scale |

具体版本号在实施时分别属于 Studio、runtime 与 protocol；表中编号表示路线里程碑，不替代三者的 SemVer。

## 兼容策略

- Agent Contract 2.0 不保留 1.x 写路径；旧客户端只能读取升级提示。
- Protocol 同一 major 的迁移必须生成 diff 并另存为新 HTML；跨 major 只读。
- v1 Studio 不消费 v2 项目，也不自动迁移。
- 移动端只做查看与数据渲染回归；桌面四浏览器承担打印功能保证。
