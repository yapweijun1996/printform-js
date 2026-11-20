# COD-07 关闭端点与取消端点的本地相位诊断

使用独立候选提交 `8a189338f9d5b6aea185503d857f877661a4bd15`、runner 源码哈希 `5a21c60af7ba45e3538115c4e3252e1451ba5e3a748224d485394d4b76373d36`、封存镜像 `sha256:c593f24e0c5ffab0ca83a7174e1f08cb5506c99325c8495393b7f2b95a0c41ce`。Linux amd64、Node v24.19.0、Chromium 151.0.7922.34、Docker 28.4.0 `vfs`。按 close、cancel、cancel、close 顺序执行四批，每批两个并发工作区。每个工作区含 128 个文件、128 个目录和 4 MiB 虚构源码，实际附加输出满 64,000 字节后才发 HTTP 请求。

Studio Stop 由 `ai-panel.js:112–124` 进入 `ai-source-workspace.js:43–59`，已创建的工作区通过 `source-workspace-run.js:111–123` 等待 `source-workspace-client.js:118–122` 的 `/close` 结果。本轮从真实 Chromium 单独计量此 HTTP 端点。浏览器点击至界面完成仍需另一组测量。 [Studio Stop](../../studio-v3/ai-panel.js) · [工作区关闭客户端](../../studio-v3/source-workspace-client.js)

| 本轮观测，毫秒 | `/cancel`，4 项 | `/close`，4 项 |
| --- | ---: | ---: |
| 最终 HTTP 回执，各样本 | 364.03、398.48、459.60、463.06 | 681.92、761.69、1,657.43、1,726.60 |
| 请求发出至独立 Docker die | 105–121 | 89–532 |
| 已验证的 run 容器清理 | 191.76–308.68 | 236.63–905.08 |
| 封存 anchor 快照阶段 | 214.61–310.32 | 256.42–744.77 |
| 主机树对账 | 0.16–0.36 | 0.20–1.61 |
| 关闭专属工作区物理清理 | — | 300.55–637.53 |
| 关闭专属 anchor 核验与删除 | — | 263.52–533.43 |
| 关闭专属卷核验与删除 | — | 36.99–104.08 |

8 项均获真实最终回执、独立进程退出和容器删除确认。相位证实先由同一容器的完成态验证退出，随后 run 清理与只读快照并行，两项成功后才对账。候选中的边界位于 `coding-runner/docker.mjs:225–255`。Close 随后执行 anchor 和卷清理，旧回执悉数返回 `WORKSPACE_CLOSED`。Cancel 维持原树与版本，保留完整取消回执，随后恢复命令成功。每组结束后容器与卷均为零。 [关闭及清理链路](../../coding-runner/workspaces.mjs)

最慢 Close 的 run rm 命令用时 845.07 毫秒，和 661.08 毫秒的 anchor exec 重叠，其后 anchor rm 又用 394.57 毫秒。另一慢样本的 kill CLI 为 464.30 毫秒，独立 die 为 532 毫秒，随后 Close 的物理清理用时 637.53 毫秒。区间可重叠，两对小样本呈现实际相位，时间差不能用来估计尾延迟。

原 100 项 `/cancel` 的最终回执 p95 为 1,036.47 毫秒，独立 die 至回执 p95 为 939.47 毫秒。全部 6 项超 1 秒的样本均位于不同并发对，独立 die 仅 91–117 毫秒，其中 5 个另一侧回执在 412.50–544.77 毫秒内，另一个为 999.90 毫秒。原样本缺乏内部追踪，无法把这 6 项归因于某次 Docker 删除或读操作。本次 4 项 `/cancel` 未复现其慢尾。 [既有 100 项数据](STUDIO_V3_COD07_RELEASE_PREP_LOAD_20261120.jsonl)

按不可变 ID 进行 run 删除前的独立复核耗时 14.93–66.34 毫秒。Moby 在精确 ID 查找无结果时仍可能回退按名称查找，共用 daemon 的删除路径应保留删除前核验。可在获准且确实具备 overlay2 的独立 Docker 环境中，对照 VFS 的 run/anchor 删除阶段并保留现有清理及快照契约。此次仅加入诊断钩子，COD-07 仍开放。 [Moby 容器查找](https://github.com/moby/moby/blob/v28.4.0/daemon/container.go)

原始脱敏相位日志和探针位于 `/workspace/scratch/pf-g6-close-phase-8a18933/`。仓库的 48 行 JSONL 按执行顺序逐字节拼接四份原始数据，合并 SHA-256 为 `498773ee6f2d098f7d6414214a78f4a0b1d2be8b9318ccd280bf90816de4a3e9`。四份单独的 SHA-256 为 `c07f28ad4632ea2dec0c30107b191dc2bfc73436ba647ca05c2d816818accc41`、`ad3a0c801e3c0f31a49863a43451715fcafe8fbc8aa8aed3ccc65622ee279eac`、`9accb087e5fbb1ce951080b8c237f1279a7fe34044425058b4f626eb14e91883`、`96b9254ecaaa1f55d23723bfdf6b19bcbfbd214202a923924031483c6dc41d97`。 [原始相位 JSONL](STUDIO_V3_COD07_CLOSE_PHASE_20261120.jsonl)
