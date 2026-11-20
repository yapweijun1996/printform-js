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

## 复现

在独立原型提交安装仓库依赖，输出使用新文件名。

```sh
npx playwright install chromium --only-shell
docker build --tag printform-coding-runner:run-create-fence-probe coding-runner
PF_CODING_IMAGE=printform-coding-runner:run-create-fence-probe node scripts/studio-v3-coding-load.mjs fence-load-evidence.jsonl 50
```

两次原型满限额测试的源码绑定和原始数据各自保留。此前发布相关 runner 的最终回执 p95 8,137.53 毫秒仍有效。浏览器 Stop 点击时延和发布版 COD-07 保持开放。 [先前并行原型满负载复验](STUDIO_V3_COD07_OVERLAP_LOAD_20261120.md) · [既有负载证据](STUDIO_V3_G6_LOAD_20261120.md)
