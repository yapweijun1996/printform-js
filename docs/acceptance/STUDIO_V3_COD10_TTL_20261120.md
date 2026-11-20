# COD-10 本地源码工作区自动过期复验

在源码 `d2412e889fabb0e0b4cf91561f3bfa0cb28d3e3a` 上，以原生 Chromium 的本地 HTTP 配对和匹配的封存 Docker 镜像复验。Docker 是 28.4.0，Node.js 是 v24.19.0。runner 源码哈希为 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b`，镜像为 `sha256:76badd727406b763e562556ba9cf53b1eb642dd9657674904ef7a20fa20b1537`。

探针用 `createCodingServer` 的现有配置入口临时收紧空闲周期至 15,000 毫秒，配对有效期至 48,000 毫秒。两项均经 `GET /health` 验证。默认配置分别为 600,000 和 3,600,000 毫秒。本次使用真实时钟、独立 Docker 清单和两个浏览器配对主体。两个工作区属同一 Docker broker，各有单独的工作区标签。第二个主体读取第一个的回执收到 HTTP 404 `WORKSPACE_NOT_FOUND`。

- 主体 A 在 Node.js 中实际生成虚构的 JSON 操作制品，核对了生产调用 ID、精确内容和独立 SHA-256。随后停止访问该工作区，直至 Docker 清单确认其 anchor 与 tmpfs 卷都已清除。配对仍有效时再查旧回执和重新请求制品，分别核对 HTTP 状态与无数据返回。
- 主体 B 用已有只读回执维持活动，跨过 A 的清理点时仍保有自己的 anchor、卷和可读回执。B 接近配对到期时停止请求，单独检查 Docker 清单。清理发生在 B 配对到期后、其空闲期限前，之后才向 API 重放旧回执请求。这个顺序区分自动过期清理和请求触发的清理。
- 资源清单按 managed 标签和工作区或 broker 属主标签过滤，包含停止的容器。进入等待前实际核对每个工作区各 1 个 anchor 与 1 个卷。退出前和伴随服务关闭后各复查一次本次 broker 的清单。

| 实际观测 | 结果 |
| --- | --- |
| A 的制品 | 161 字节，SHA-256 `de0bb6219ee3cb5a84992e75adcb3ff6303e83071d0ec538cb7095e910846a3f` |
| A 的空闲清理 | 自最后一次访问起 21,409 毫秒时观测到容器与卷清零，距配对到期尚有 1,971 毫秒。旧回执和再次请求制品均返回 HTTP 409 `WORKSPACE_CLOSED` |
| B 的配对过期清理 | 最后一次心跳距配对到期还有 1,688 毫秒。容器与卷在配对到期后 756 毫秒已清零，距最后一次心跳 2,444 毫秒。旧回执返回 HTTP 401 `AUTH_REJECTED` |
| B 的心跳和最终清单 | 15 次心跳成功。复验退出码 0，本次 broker 在伴随服务关闭前后均剩 0 个容器、0 个卷 |

空闲清理由周期扫描触发，上述时刻包含 Docker 清理和探针轮询时间。按源码，关闭工作区清空完整回执和快照，配对过期再清空该主体的准入重放缓存。

复验使用 [Chromium 本地传输夹具](../../tests/support/source-runner-browser.mjs)、[伴随服务](../../coding-runner/server.mjs)、[配对过期与撤销](../../coding-runner/security.mjs)和[工作区关闭](../../coding-runner/workspaces.mjs)。本机探针在 `/workspace/scratch/pf-g6-ttl-probe.mjs`，结果在 `/workspace/scratch/pf-g6-ttl-probe.log`。

这组证据覆盖运行中的 broker 自动清除受测的短期工作区和回执。显式 Close/撤销仍由[上一轮 Docker 复验](STUDIO_V3_COD07_COMBINED_HELPER_REVIEW_20261120.md#cod-10-所属资源关闭复验)覆盖。默认周期的全时长运行、异常退出残留处理、宿主或持久化介质的留存/删除仍待各自验证。当前编码伴随服务没有持久化恢复功能。COD-07 仍以原始负载测量为准。
