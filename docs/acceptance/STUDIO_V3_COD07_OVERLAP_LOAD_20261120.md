# COD-07 并行清理原型的 100 项本地负载复验

独立原型 `3b53510ee8533ab92ca3191838cdc476f158f40d` 在本次实机测试达到本地三个数值目标。原型 runner 源码哈希为 `2d20ecfb0e24c21878bc78bc26f58e404f08dd00c366235502b9f38f708f0114`，封存镜像为 `sha256:354bbb6eea8dfdd44030ba4131812dba14e50fa70dd720025a8eaff36391524c`。发布基线要求的 runner 源码哈希仍为 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b`。 [发布基线](../studio-v3-agent-release/baseline-manifest.json)

## 口径

Linux 6.18.57 amd64、应用进程 CPU 配额 4 核、内存 16 GiB、Node v24.19.0、Chromium Headless Shell 151.0.7922.34、Docker Engine 28.4.0 `vfs`。测量期间该 daemon 专用于本次 Docker 测试。运行仓库原有驱动，共 50 轮，每轮两个并发工作区。每个工作区含虚构的 128 个文件、128 个目录和 4 MiB 源码。固定命令输出 64,000 ASCII 字节后短暂空闲，驱动在独立观察到完整输出后测量 `/cancel` 最终 HTTP 回执，并用 Docker 事件和清单分别核验容器进程退出及删除。

## 结果

| 计时，毫秒 | 样本 | p50 | p95 | 最大值 | 本次目标 |
| --- | ---: | ---: | ---: | ---: | --- |
| 运行中 GET 状态 | 100 | 11.50 | 25.95 | 75.49 | p95 ≤ 500，通过 |
| 请求发出至独立 Docker die | 100 | 99 | 156 | 450 | ≤ 3,000，通过 |
| 请求发出至最终 HTTP 回执 | 100 | 437.07 | 904.31 | 1,404.99 | p95 ≤ 1,000，通过 |
| 读取已完成回执 | 100 | 11.05 | 37.72 | 190.62 | 补充观测 |
| 独立 Docker die 至最终 HTTP 回执 | 100 | 333.24 | 813.31 | 1,218.99 | 补充观测 |

p95 使用最近秩。最终回执有 4 项超过 1 秒。全部 100 项返回 HTTP 200 和已完成的 `CANCELLED` 回执，原树和版本相等，输出恰为 64,000 字节，均获得独立的 Docker die 事件并确认容器清除。4 个工作区创建均返回 200，4 条恢复命令均退出 0，最后独立确认托管容器与卷均为零。驱动退出码 0。核验原始 111 行仅含耗时、计数、公开镜像及源码身份和断言状态。原始数据 SHA-256 为 `0fce4915b6095f8b9d3533fc8d0950ab697fbea9ceb6b716aaf156ca33016931`。 [原始 JSONL](STUDIO_V3_COD07_OVERLAP_LOAD_20261120.jsonl)

本轮测量属于独立原型的本机 `/cancel`。原先 100 项最终回执 p95 8,137.53 毫秒的结果继续保留，浏览器点击 Stop 或 `/close` 的计时另有口径。辅助的同长度文件改写、源码对账以及清理失败时的未知效果由独立测试覆盖。如果 daemon 创建请求已提交而 CLI 未收到不可变 ID，暂时查不到名称仍无法确认最终清理，这次负载没有触发该路径。发布版 COD-07 保持开放。 [原 100 项验收](STUDIO_V3_G6_LOAD_20261120.md) · [并行原型相位及失败控制](STUDIO_V3_COD07_OVERLAP_PILOT_20261120.md)

## 复现

在上面的独立原型提交安装仓库依赖，使用新的输出文件名。

```sh
npx playwright install chromium --only-shell
docker build --tag printform-coding-runner:overlap-full-3b53510 coding-runner
PF_CODING_IMAGE=printform-coding-runner:overlap-full-3b53510 node scripts/studio-v3-coding-load.mjs overlap-load-evidence.jsonl 50
```
