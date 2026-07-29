# PrintForm 单 HTML 协议 v2

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

## Trust

- 受信文件只能包含两个固定 executable script：`pf-document-runtime` 和 `pf-printform-runtime`。
- 任意工程师脚本会把文件降级为 `Untrusted`；Studio 可在无同源、无网络 sandbox 预览，也可人工导出，但不能产生生产有效凭证。
- `pf-attestation` 是防篡改记录，不是组织数字签名。手改任何权威内容或 runtime 后，Headless validator 会报告哈希失配。

## JSON Schema Profile

支持对象、数组、字符串、数字、整数、布尔、null，以及 properties、required、items、enum、const、长度／范围、pattern、date/date-time/email/uri、uniqueItems 和 additionalProperties。未知关键字或格式直接阻断，绝不静默忽略。

## CI

```bash
npm run validate:v2 -- path/to/document.html
```

命令输出机器可读 JSON，只做协议、数据、信任、容量与哈希验证。分页、越界和字体仍必须使用 Playwright／真实浏览器验证。
