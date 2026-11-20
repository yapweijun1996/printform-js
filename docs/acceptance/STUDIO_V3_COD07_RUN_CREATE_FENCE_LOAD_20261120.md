# COD-07 保留创建记录原型的 100 项本地复验

独立原型 `8d5a069fb5766ee63e2f88e440a78f1a4729c62f` 在本次本机测量达到三个数值目标。封存 runner 源码哈希为 `0a6f55cff5e32743e69b7edc86dd780cefd4e3caf0b5f1c7dff66f7c32cc1542`，镜像为 `sha256:72c8ec11da0767a93dfbfb9ce18e239b30f2da424ab8f99e0a799ada944cffe1`。发布基线仍绑定 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b`。 [发布基线](../studio-v3-agent-release/baseline-manifest.json)

Linux 6.18.57 amd64、Node v24.19.0、Chromium Headless Shell 151.0.7922.34、Docker Engine 28.4.0 `vfs`，应用进程配额为 4 CPU、16 GiB。测量期间该 daemon 专用于本次 Docker 测试。仓库原有驱动执行 50 轮，每轮两个并发工作区。每个工作区含虚构的 128 个文件、128 个目录和 4 MiB 源码。固定命令实发 64,000 字节，驱动确认完整输出后才计时。这次直接测量带权威源码对账的 `/cancel` 最终 HTTP 回执。Docker die 事件和独立清单分别核实进程退出和容器清除。

| 计时，毫秒 | 样本 | p50 | p95 | 最大值 | 本次目标 |
| --- | ---: | ---: | ---: | ---: | --- |
| 运行中 GET 状态 | 100 | 10.62 | 28.79 | 498.12 | p95 ≤ 500，通过 |
| 请求至独立 Docker die | 100 | 99 | 158 | 240 | ≤ 3,000，通过 |
| 请求至最终 HTTP 回执 | 100 | 443.66 | 955.10 | 1,386.13 | p95 ≤ 1,000，通过 |
| 读取完成回执 | 100 | 12.15 | 57.66 | 187.39 | 补充观测 |
| 独立 Docker die 至最终 HTTP 回执 | 100 | 339.03 | 802.66 | 1,243.13 | 补充观测 |

p95 取最近秩。最终回执有 3 项超过 1 秒。100 项全部取得 HTTP 200、`CANCELLED` 完成回执、精确 64,000 字节输出、独立 Docker die、原树摘要及版本和容器已移除断言。4 次工作区创建和 4 条恢复命令全部通过。四个工作区关闭后独立检查托管容器及卷均为零。驱动退出码 0。原始记录共 111 行，保留完整字段和值，SHA-256 为 `dccc5714e03e1bf8d8e3edbfbfe013e3bc5948032e0c24557ec49b14418cf5f2`。 [原始 JSONL](STUDIO_V3_COD07_RUN_CREATE_FENCE_LOAD_20261120.jsonl)

本地实机的受控延迟对照单独验证过该镜像。夹具在分发唯一的有属主 run create 之前让调用实际超时，约 30,102 毫秒。首次 Close 返回 503 `PROCESS_STATE_UNKNOWN` 并保留原工作区 anchor 和卷。把先前捕获的创建请求提交给同一 Docker 后，实查新容器仍处于 `created`，PID 0，无启动调用。第二次 Close 按核实后的不可变 ID 删除容器，返回 HTTP 200。此控制覆盖仍在运行的 broker 保留创建记录的行为，实际 daemon 或 broker 崩溃重启后的状态恢复仍待验证。

同一封存镜像在负载测试之后串行执行 9 项 runner Docker 用例和 1 项实际 TTL 用例，10/10 通过。测试耗时 297.64 秒，Vitest 总耗时 298.79 秒。覆盖实际失败测试、修复、构建与制品绑定、属主隔离、终止、精确 BOM、回执体积、撤销及空闲/配对自动清理。

独立的提前 Stop 夹具同时通过。夹具已创建 run 容器并暂缓传回成功结果，Stop 之后才交付该结果。回执 `started:false`，版本为 0，树摘要保持原值，实际调用只有 create、inspect 和 rm。随后普通命令真实启动并退出 0，通过封存 anchor 快照核对修改后的文件摘要并推进至版本 1。关闭后该工作区及托管资源清单均为零。上述夹具延迟仅用于确定性分支验证。

本机输出保存在 `/workspace/scratch/pf-g6-fence-full.9lWasb/`。Docker/TTL 套件日志 SHA-256 为 `b594ee9e6b888ba5e5e6a73abee24d7af8aedc267570c870b34157e228fd3fa3`，提前 Stop 脱敏日志为 `c30044169997e5cf9e9b9ad0f56285113c09facc3eb2a7c39b7aae3ba59aca23`。

## 复现

在独立原型提交安装仓库依赖，输出使用新文件名。

```sh
npx playwright install chromium --only-shell
docker build --tag printform-coding-runner:run-create-fence-probe coding-runner
PF_CODING_IMAGE=printform-coding-runner:run-create-fence-probe node scripts/studio-v3-coding-load.mjs fence-load-evidence.jsonl 50
PF_CODING_INTEGRATION=1 PF_CODING_IMAGE=printform-coding-runner:run-create-fence-probe npx vitest run coding-runner/docker.integration.test.mjs tests/coding-runner-retention.integration.test.mjs --maxWorkers=1 --no-file-parallelism --bail=1
```

两次原型满限额测试的源码绑定和原始数据各自保留。此前发布相关 runner 的最终回执 p95 8,137.53 毫秒仍有效。浏览器 Stop 点击时延和发布版 COD-07 保持开放。 [先前并行原型满负载复验](STUDIO_V3_COD07_OVERLAP_LOAD_20261120.md) · [既有负载证据](STUDIO_V3_G6_LOAD_20261120.md)

## 集成候选的撤销重试控制

共享工作区 `/workspace/scratch/pf-g6-release-prep` 的 `8a189338f9d5b6aea185503d857f877661a4bd15` 将快照响应校验独立成模块，并让同一已撤销凭据的原请求仅能重试原属主清理。该版本 runner 源码哈希为 `5a21c60af7ba45e3538115c4e3252e1451ba5e3a748224d485394d4b76373d36`，封存镜像为 `sha256:c593f24e0c5ffab0ca83a7174e1f08cb5506c99325c8495393b7f2b95a0c41ce`。53 项单元测试通过。

真实本机 Docker 上，受控创建请求在分发前等待约 30,119 毫秒。第一次撤销返回 503，原 anchor 和卷保留，普通请求和新 intent 的撤销均收到 401。夹具随后分发之前捕获的唯一自有创建请求。容器仍为 `created`，未执行源码。同一撤销 intent 重试返回 200，按验证后的不可变 ID 删除该容器，属主资源清零。后续同一 intent 返回已确认回执。没有重新授权原令牌。这与上文 100 个样本使用不同的封存镜像，且仅验证受控延迟。发布版和真实 daemon 重启的门禁保持开放。

同一集成候选另用相同镜像运行仓库 50 轮驱动。本机 Docker Engine 28.4.0 `vfs` 上，两个并发工作区按原满限额夹具共得到 100 个完整 `CANCELLED` 回执，原树和版本一致，所有运行容器已删除。最终回执 p95 为 **1,036.47 毫秒**，超过 1 秒门槛，6 项超过 1 秒，最大 1,406.56 毫秒。运行状态 p95 39.82 毫秒，独立 Docker die p95 160 毫秒、最大 364 毫秒，均符合各自目标。4 次创建和恢复均通过，独立清单确认无托管容器或卷残留。原始 111 行的 SHA-256 为 `745884efdeb40a67c32b4a1d2ce3e2292faa04517a0c501dfe3f1962fc8f23af`。两个封存版本的结果分别保留。 [集成候选原始 JSONL](STUDIO_V3_COD07_RELEASE_PREP_LOAD_20261120.jsonl)
