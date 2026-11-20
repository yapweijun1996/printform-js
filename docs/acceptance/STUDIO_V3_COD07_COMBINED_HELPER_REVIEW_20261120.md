# COD-07 Docker helper 合并调用复核

本次从已发布的 `6e9fd0efaffabdca36ec55b579fc02cdc45e5b37` 做源码核对。现场 Docker CLI 报 28.4.0（build d8eb465）。决定保留现有 create 和附加 start 的两阶段调用。

- Docker CLI 28.4.0 的 create 和 run 都进入同一个 `createContainer`，并由此调用 daemon 的 `ContainerCreate`。run 在创建后继续执行 attach、等待进程状态和 `ContainerStart`。现有单独的附加 start 额外进行一次初始 inspect。 [create.go](https://github.com/docker/cli/blob/v28.4.0/cli/command/container/create.go#L138) · [共享的 daemon 创建调用](https://github.com/docker/cli/blob/v28.4.0/cli/command/container/create.go#L350) · [run.go](https://github.com/docker/cli/blob/v28.4.0/cli/command/container/run.go#L144) · [start.go](https://github.com/docker/cli/blob/v28.4.0/cli/command/container/start.go#L87)
- 已有两项满树 `/cancel` 相位测量的终端回执为 3,447–3,496 毫秒，sealed snapshot helper 总计 3,052–3,124 毫秒。共同的 Docker create 单独占用 2,344–2,418 毫秒。合并最多省掉一次 CLI 启动与 start 的初始 inspect，仍需执行耗时的 daemon 创建、完整快照与按属主清理。两项相位样本只说明实际耗时分布。 [相位诊断](STUDIO_V3_COD07_PHASE_DIAGNOSTIC_20261120.md)
- 当前 create 和附加 snapshot 各有 30 秒 CLI 期限。若共用 30 秒，现有允许的附加阶段会缩短。若共用 60 秒，现有 create 阶段期限会放宽。合并 CLI 超时时也会缺少单独的 create 成功边界，增加对延迟资源的清理确认工作。helper 的原进程期限和 v1 最终回执保留。

本轮完成源码与已有相位证据复核。创建、隔离、超时和确认行为保持原值。已有预创建原型针对的是重叠 daemon create，其已准备样本和立即停止样本记录仍独立保留。原 100 项负载数据保持完整，COD-07 仍开放。
