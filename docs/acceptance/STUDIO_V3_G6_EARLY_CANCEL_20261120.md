# Studio v3 attach 前取消复验

基线为 `481e12e78a2e5f3d6a664726cbf52e6043877ce7`。这次只验证已确认没有进程运行的取消路径。Docker helper 仍在命令结束后按原逻辑创建和运行。

已请求取消且 broker 明确在 attach 前返回 `started:false` 时，`job.promise` 依旧等待已创建容器移除成功。此时现有 lease 排除了并发写入，仍采用原精确树和版本。移除有误会隔离工作区并保留未知效果。已经启动或无法确认的命令保留原完整快照路径。v1 回执形状、权限、命令期限和隔离均保持原值。

## 验证

8 个文件、60 项定向 Vitest 通过。两个受控 CLI 用例保持 run create 回执未完成并发出 Stop。确认移除时，CLI 动作仅为 create、inspect、rm，并收到当前版本的最终回执。移除失败时，Stop 返回工作区隔离，调用回执没有推断新版本或摘要。

```sh
npx vitest run coding-runner/early-cancel.test.mjs coding-runner/docker.test.mjs coding-runner/policy.test.mjs coding-runner/identity.test.mjs tests/studio-v3-source-authority.test.js tests/studio-v3-source-artifact-consumer.test.js tests/studio-v3-source-admission.test.js tests/studio-v3-source-lifecycle.test.js --maxWorkers=1 --no-file-parallelism
```

单次真实 Chromium 本机配对后，使用同一虚构工作区依次覆盖两条路径。测试控制器仅暂挂真实 Docker create 的 stdout 回程，独立核对容器为 created、属于该 workspace、镜像匹配、UID 1000:1000、根只读且禁网。真实 Stop 已进入 owner lease 后释放回程。两个步骤取得以下结果。

| 路径 | 实际结果 |
| --- | --- |
| attach 前 Stop | HTTP 200，`CANCELLED`，`started:false`，版本 0 和摘要不变，独立确认 run 容器消失。broker 调用只含 create、inspect、rm，无 attach 或 helper。 |
| 已运行的正常命令 | 真实 attach 后仅改写 `note.txt`，退出 0，原快照 helper 实际创建并启动，版本 0 → 1，变更与新文本摘要一致。 |

两个案例结束后，按工作区标签确认测试容器和卷均清零。测试用 Docker 镜像 `sha256:76badd727406b763e562556ba9cf53b1eb642dd9657674904ef7a20fa20b1537`，runner 源码哈希 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b`。本机控制器和脱敏结果留在 `/workspace/scratch/pf-g6-early-cancel-probe.mjs`、`/workspace/scratch/pf-g6-early-cancel-probe.json`。人工安排的 create 回程阻塞仅用于覆盖分支，不用于延迟测量。

这项修正只去除确定无写入时的重复快照。[100 项实际运行命令 Stop 证据](STUDIO_V3_G6_LOAD_20261120.md)保持原样，COD-07 仍开放。
