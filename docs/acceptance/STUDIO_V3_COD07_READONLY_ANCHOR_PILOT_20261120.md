# COD-07 只读工作区 anchor 快照试验

Linux amd64、Node v24.19.0、Chromium Headless Shell 151.0.7922.34 和 Docker Engine 28.4.0。本机 Docker 存储驱动为 `vfs`。两套 sealed 镜像均约 230 MB。VFS 创建子层时调用 `CopyDir`，删除层时遍历删除其目录。基线中实测 Docker helper create 占快照阶段的大部分时间。 [Moby v28.4.0 VFS 实现](https://github.com/moby/moby/blob/v28.4.0/daemon/graphdriver/vfs/driver.go#L126-L196)

| 变体 | 源码提交 | runner 源码哈希 | sealed Docker 镜像 |
| --- | --- | --- | --- |
| 基线 | `7937c7155d3a80e2bb08093adb9572c36d78d1e5` | `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b` | `sha256:76badd727406b763e562556ba9cf53b1eb642dd9657674904ef7a20fa20b1537` |
| 只读 anchor 原型 | `6bef43f3055748c6ac58956c6be8b5437750e0ae`，独立工作树 | `90935bd50571355c356ca269a713da78e4058fe22709efe47731679924309459` | `sha256:18ba927d54bec7d9fa67d3dff599037b215aec32999e8117e3f0f4e0c6788c3e` |

对每个变体顺序运行一轮，各有两个并发工作区和两个样本。每个工作区含 128 个文件、128 个目录、4 MiB 源码。真实 Chromium 配对。确认命令已输出 64,000 字节且实际运行后调用 `/cancel`。Docker 事件独立核对进程退出，进程容器的删除先于快照，完成回执包含完整输出及准确的树摘要与版本。所有工作区均通过恢复命令，随后清零容器和卷。

| 本轮观测范围，毫秒 | 基线 | 只读 anchor 原型 |
| --- | ---: | ---: |
| 最终 HTTP 回执 | 2,536.22–2,618.34 | 1,250.23–1,343.14 |
| Docker 独立 die | 83–85 | 201–215 |
| 请求至已验证的 run 容器删除 | 299.52–305.36 | 714.55–798.67 |
| 快照阶段 | 2,224.53–2,309.95 | 474.83–520.94 |
| 一次性 helper 的 Docker create | 1,654.56–1,762.69 | — |
| 一次性 helper 的验证与删除 | 185.94–197.21 | — |
| anchor inspect | — | 38.13–38.95 |
| anchor exec、快照与附加传输 | — | 426.39–462.73 |
| 工作区创建 | 8,176.84–9,410.74 | 12,582.61–13,290.56 |

原型改用现有的只读 anchor 挂载及一次固定快照命令，保持写入命令与初始化、patch、search 容器独立。两项样本均实际检查 anchor 的完整不可变 ID、镜像、managed/属主/工作区标签及 `/workspace` 挂载 `RW=false`。快照返回后，按该 ID 查询的 anchor stdout/stderr Docker 日志为空。

另有一项小树真实写入控制。Node 命令改写同长度文件并恢复 mtime，独立 Docker 日志确认写入后才取消。源码版本恰好递增 1，读回内容和 SHA-256 相符。并发 patch 返回 `WORKSPACE_BUSY`，先前构建产物返回 `STALE_ARTIFACT`，随后 patch 和构建通过。关闭工作区后旧回执返回 `WORKSPACE_CLOSED`，专属容器和卷清零。

脱敏原始相位记录在本机 `/workspace/scratch/pf-anchor-phase/`。基线 SHA-256 为 `bfeb0eec0906922c7f9116ee9a1cceb6a8ef6cc9a6d78506a59c0eeb42423d18`，原型为 `20b8302334355c3ab4b2b538b3d227ec3591d245d869b301d6ebcf8e0e8220c3`。同目录的 `run.mjs`、`trace.mjs` 和 `changed.mjs` 为诊断脚本。

两组顺序运行、每组仅两项。两个原型最终回执都超过 1 秒，工作区创建和 run 容器删除的时差也需要在配对重复负载中复核。此处未计量浏览器点击 Stop、`/close` 或长尾。COD-07 仍开放，以原 100 项结果为准。 [负载证据](STUDIO_V3_G6_LOAD_20261120.md)

后续可验证一个独立问题。取得同一不可变 ID 的密封 run 已退出状态，独立确认其 PID namespace 已无写入进程且不会重启后，能否并行执行该 run 容器的删除与只读快照。最终回执仍需等两项成功，任一未知结果仍隔离工作区。当前原型仍先等容器删除成功再启动快照。
