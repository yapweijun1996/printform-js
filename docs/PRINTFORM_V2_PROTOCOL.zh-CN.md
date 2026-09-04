# PrintForm 单 HTML 协议 v2

> 状态：**Current / Production Pilot**。本文只描述仓库当前实现；Production Ready 目标接口与硬门见 [v2 文档索引](STUDIO_V2_INDEX.zh-CN.md) 和 [信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)。

> 最后核对：2026-09-04。Protocol 版本仍为 `2.0.0`；E14 AI Designer UX redesign 不改变本文件的单 HTML、绑定、runtime、trust 或导出契约。

## 目标

v2 文件是一份可直接打开、可复制、可手改、可离线打印的 HTML。Studio、WebMCP、第一方 MCP 和 Headless validator 都读取同一组区块；不存在隐藏项目文件。

## 权威区块

| ID | 类型 | 用途 |
|---|---|---|
| `pf-manifest` | `application/json` | 协议版本、locale、currency、timezone、资源与验收规则 |
| `pf-schema` | `application/schema+json` | JSON Schema 2020-12 Profile 数据契约 |
| `pf-theme` | `style` | 限定在 `#pf-mount` 下的主题与打印 CSS |
| `pf-template` | `template` | 未绑定、未分页的声明式 DOM |
| `pf-sample-data` | `application/json` | 独立打开时使用的合成样本 |
| `pf-attestation` | `application/json` | 最近一次验证的内容/runtime 哈希与摘要 |

每个权威区块必须恰好出现一次。`protocolVersion` 当前为 `2.0.0`。同一 major 的旧 minor 版本只能生成待审迁移；不同 major 只读拒绝。

## 数据绑定

- `data-pf-text="/customer/name"`：从根数据读取 JSON Pointer，并用 `textContent` 输出。
- `data-pf-each="/items"`：按数组复制当前完整元素。
- 循环内用 `data-pf-text="./description"` 读取当前 item。
- `data-pf-if="/optional/value"`：值为真时保留元素。
- `data-pf-format="currency|number|percent|date|datetime"`：使用 manifest 的 locale、currency、timezone。
- `data-pf-href="/reference/url"`：只接受 `http`、`https`、`mailto`、`tel`。

不支持表达式、`eval`、业务公式或原始 HTML 数据注入。金额、税额、折扣和合计必须由业务系统提供。

## Runtime API

```js
PrintFormDocument.validate(data)
await PrintFormDocument.render(data, options)
```

不调用 `render` 时，文件在 DOM ready 后读取 `pf-sample-data` 自动渲染。显式 `render(data)` 优先并可重复调用；每次都会重建未分页 DOM，再运行 PrintForm 分页。

失败返回 `status: "blocked"`，不会保留部分成功状态。生产上限默认是 10 MB、500 行和100个逻辑页。

渲染结果（`printform:rendered` 事件 detail）除 `status`、`validation`、`metrics` 外还包含 `issues[]`（2026-07-31 起）：每个越界/对比度问题元素的 `{ code, pageIndex, selector, rect, text? }`，每类上限 20 条，供 Agent 与 Studio 无截图定位问题。

## Trust

- 受信文件只能包含两个固定 executable script：`pf-document-runtime` 和 `pf-printform-runtime`。
- 任意工程师脚本会把文件降级为 `Untrusted`；Studio 可在无同源、无网络 sandbox 预览，也可人工导出，但不能产生生产有效凭证。
- `pf-attestation` 是防篡改记录，不是组织数字签名。validator 覆盖两段 runtime hash（document runtime + PrintForm 分页引擎本身，各自独立错误码）、CSP script hash 允许列表，以及由 Studio 签发的 evidence receipt 推导的真实浏览器证据（2026-07-31 起，见[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)《完整性与证明》）。

review receipt 现由 Studio 自己测量渲染结果后签发（几何指纹，非像素截图），拒绝 Agent 自述证据标签；`preview_changes`/`apply_changes` 会真实分页候选项目（复用可见预览 iframe）。即便如此，当前文件与 Studio 仍只按 Production Pilot 验收——Production Ready 是对外承诺，由维护者显式宣布，还需完成浏览器矩阵等发布流程验收（已在 macOS/Linux 跑满，见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)），不由代码硬门齐全自动推导。

## JSON Schema Profile

支持对象、数组、字符串、数字、整数、布尔、null，以及 properties、required、items、enum、const、长度／范围、pattern、date/date-time/email/uri、uniqueItems 和 additionalProperties。未知关键字或格式直接阻断，绝不静默忽略。

## CI

```bash
npm run validate:v2 -- path/to/document.html
```

命令输出机器可读 JSON，只做协议、数据、信任、容量与哈希验证。分页、越界和字体仍必须使用 Playwright／真实浏览器验证。

CLI validator 本身不等于浏览器布局证明（分页、越界、字体仍需真实浏览器）；但内容数量/顺序/遗漏/重叠校验（`ROW_*` 四项 + `HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP`）与双 runtime hash 完整证明均已实现，见[工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) P0-B 与[信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md)。
