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

1. ✅ 已实现（2026-07-31）：`operations[]` 按 `type` 判别联合校验（`core/operation-schemas.js`，复用 `core/schema.js` 引擎），已知类型的缺字段/多字段/类型错误统一 `INVALID_OPERATION_SHAPE`；命令执行层的共享 JSON Schema 校验（`preview_changes`/`apply_changes` 之外的其他工具入参）仍未覆盖。
2. ✅ 已实现（2026-07-31，commit `1bc63d7`）：永不复用的 revision counter；undo 后提交产生新 revision identity。
3. 🔶 设计已定稿、未实现（2026-07-31）：复用现有可见预览 iframe 渲染 candidate（用户拍板否决"新开隐藏 iframe"方案），不复用当前草稿的 RenderReport。`CommandBus` 通过依赖注入获得可选的 `renderCandidate` 异步渲染器；无 DOM 环境下保持现有静态校验行为，零回归。完整设计见 [DESIGN.md §4.4](../DESIGN.md)。
4. 🔶 设计已定稿、未实现：`preview_changes` 用 `sha256(stableStringify(candidate))` 算 `candidateHash`，按 hash 缓存真实 render report（内存级短 TTL，非正确性依赖——revision 单调不复用已经防住"底稿已变还想用旧预览"）；返回真实 issues/metrics 而非仅 schema 校验。`previewId`/`expiresAt` 等契约字段细节留待实现阶段确定。
5. 🔶 设计已定稿、未实现：`apply_changes` 命中 candidateHash 缓存时直接复用已渲染的 report 提交（跳过重复渲染）；未命中（Agent 跳过 preview 直接 apply）时退化为内联做一次同样的真实渲染 round-trip 再提交，不接受"绕过真实渲染"的直接提交。
6. 任一验证、分页、完整性或容量错误使整组提交回滚。

退出条件：

- stale revision、过期 preview、hash mismatch 和未知 operation 都有稳定错误码。
- default 与 long-text candidate 报告绑定同一 candidate hash。
- undo 后的旧写命令永远不能命中新状态。
- UI、WebMCP、CDP 对相同输入返回一致结果。

## P0-B：信任闭环

目标：生产导出依赖真实、可追溯、不可自我声明的浏览器证据。

1. Preview channel 加入目标 frame（✅ 2026-07-31 已实现 `event.source` 校验）、nonce、revision 与 candidate hash 验证。🔶 设计已定稿、未实现（2026-07-31）：原「一次性 nonce」需求（TASK.md 原 #15）由 P0-A 候选渲染设计里的请求令牌排序机制天然满足（跨 iframe reload 的单调 token，只采纳最新一次请求的回执，过期回执直接丢弃）——**#15 并入 P0-A 第 3 项一起交付，不再单独排期**；candidate hash 见 P0-A 第 4 项。
2. Studio 捕获场景截图和 RenderReport，并签发 Evidence Receipt。
3. `complete_layout_review` 改为引用 evidence IDs。
4. ✅ 已实现（2026-07-31）：`binding.js` 给每个 `data-pf-each` 展开行打 `data-pf-row-index`（源数组下标，穿过整个分页流程不丢失）；`inspectRenderedDocument` 用它做 `ROW_COUNT_MISMATCH`（数量）、`ROW_DUPLICATE_INDEX`（重复）、`ROW_MISSING_INDEX`（遗漏）、`ROW_ORDER_MISMATCH`（顺序）四项检查，无标记的旧版导出文档自动跳过不误报。数量/顺序/重复/遗漏四项均已覆盖。
5. 🔶 部分实现（2026-07-31）：`data-repeat-header`/`data-repeat-docinfo` 为"y"时每页必须携带对应 `_processed` 区块（`HEADER_MISSING`/`DOCINFO_MISSING`）；页面直接子元素间的纵向矩形重叠检测（`SECTION_OVERLAP`）。越界已由既有 `HORIZONTAL_OVERFLOW`/`VERTICAL_OVERFLOW` 覆盖。尚未覆盖：footer（重复语义与 header/docinfo 不同，"仅最后页出现一次"需要另外建模，未做）。
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
- ✅ 已实现（2026-07-31）：`ui/diff-view.js` 并排 diff 面板取代 `window.confirm` 一次性文本对话框（逐行 LCS 高亮）。仍是模态而非常驻侧栏，"persistent drawer" 的呈现形式留待与其余 P1 面板一起重新设计。
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
