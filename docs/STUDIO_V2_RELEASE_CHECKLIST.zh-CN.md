# PrintForm Studio v2 发布检查表

## 自动质量门

- `npm ci`
- `npm audit --audit-level=moderate`
- `npm run test:e2e`
- `npm run validate:v2 -- site-dist/studio-v2/samples/sales-invoice-v2.html`
- 确认 Pages artifact 只包含 `site-dist/`，不包含源码仓库或开发凭证。

## 真实浏览器烟测

每次发布在 Chrome、Edge、Firefox、Safari 当前稳定版执行；前一稳定版至少回归“导入 → 预览 → 导出 → 独立打开”。移动浏览器只验证查看与数据渲染。

对销售发票依次检查：

- 45 行默认样本无丢失、重叠、越界，页码及顺序正确。
- 切换空值、1、100、500 行、长文本和多语言场景。
- 非法类型、坏 URL、资源失败、超过限制和 runtime 哈希错误必须阻断。
- WebMCP、第一方 CDP bridge 和 Studio UI 对同一命令返回一致结果与错误码。
- 自定义脚本会降级为 `Untrusted`；清除脚本并人工确认后才可恢复受信状态。
- 导出的单 HTML 在断网状态可独立自动渲染，也可重复调用 `PrintFormDocument.render(data)`。

## 系统打印预览

- 在每个桌面浏览器打开系统打印预览，使用默认缩放、正确纸张和边距。
- 检查字体替换、DPI、页眉页脚、表格列、分页边界和最后一页合计。
- 浏览器之间不要求像素一致，但共同硬标准是不丢内容、不重叠、不越界、顺序及页码正确。
- 保存每个浏览器自己的截图／打印基线并记录可接受容差。

## 发布确认

- 没有未保存草稿时才接受 PWA 更新。
- 人工点击“生产有效”并下载最终 HTML；AI/MCP 不得代替此确认。
- 记录协议版本、runtime SHA-256、浏览器矩阵和验证摘要。
- 不上传真实 ERP 数据、缓存、日志或默认遥测；诊断包只由用户主动导出和分享。
