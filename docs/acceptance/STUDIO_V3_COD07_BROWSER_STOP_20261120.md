# Studio 浏览器 Stop 与源码产物复验

在本地使用已发布 Studio `8e0a3d8e6c30157a2eb1782b4a6415bb96d0c0e3` 的构建、Chromium、真实 Docker companion 和脚本化 Demo 回复。Runner 源码哈希为 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b`，封存镜像为 `sha256:76badd727406b763e562556ba9cf53b1eb642dd9657674904ef7a20fa20b1537`。两个浏览器用例均通过，耗时 30.2 秒和 22.3 秒。用例总耗时包含浏览器启动后设置、配对、进程运行确认和资源核对。

- 产物用例执行真实测试与构建，核对产物字节、成功构建调用和源码修订绑定，随后验证用户在独立预览后可确认 Apply。
- Stop 用例等待该工作区的实际 Docker 命令输出启动标记，再点击 Studio 的 Stop。浏览器收到 `/close` 的 HTTP 200 和 `{id, closed: true}`，然后显示工作区已关闭。断言表单仍为初始修订、无候选交接、源码授权已重置、关联容器和卷均清除、实际模型请求为零。

使用上述镜像标签、正在服务的已构建 Studio 和可访问的本地 Docker 重跑。该测试固定 companion 端口，使用一个工作进程。

```sh
PF_CODING_BROWSER_INTEGRATION=1 \
  PF_CODING_IMAGE=printform-coding-runner:early-cancel-probe \
  npx playwright test e2e/studio-v3-source-artifact.spec.mjs --project=chromium --workers=1
```

Stop 用例将一次点击至确认和界面通知的时间作为测试附件。COD-07 的正式门槛仍采用 100 项独立 `/cancel` 测量。集成候选的 p95 为 1,036.47 毫秒，超过 1 秒门槛。 [浏览器用例](../../e2e/studio-v3-source-artifact.spec.mjs) · [候选对照样本](STUDIO_V3_COD07_CLOSE_PHASE_20261120.md)
