# 版本与兼容矩阵

> 最后核对：2026-07-31（对齐 `3515409` 之后的 SemVer 落地提交）。
>
> 本仓库有**四条独立的版本线**。它们描述四种不同的东西、按四种不同的节奏变化，共用一个数字只会让其中三条被迫做无意义的跳版。

## 四条版本线

| 版本线 | 当前 | 事实来源（SSOT） | 它描述什么 | 什么情况下会升 major |
|---|---|---|---|---|
| **PrintForm 引擎** | 1.0.0 | [src/version.js](../src/version.js) → `PrintForm.version` | `dist/printform.js` 这个零依赖分页脚本本身 | 改变既有 ERP DOM 的分页结果、移除 `data-*` 配置项、改掉 `*_processed` class 约定 |
| **Studio v2** | 0.9.0 | [studio-v2/core/constants.js](../studio-v2/core/constants.js) `STUDIO_VERSION` | 编辑器应用本身（UI、面板、PWA） | 工程师工作流出现不兼容的重大改动；**升到 1.0.0 专门保留给维护者显式宣布 Production Ready 的那一刻** |
| **单 HTML 协议** | 2.0.0 | 同上 `PROTOCOL_VERSION` | 导出文件的结构契约（`pf-manifest`/`pf-schema`/`pf-template`… 各区块的 id 与语义） | 旧版导出文件无法再被本版 Studio 正确解析 |
| **Agent Contract** | 2.0.0 | 同上 `AGENT_CONTRACT_VERSION` | `CommandBus` 暴露给 Agent 的命令面（16 个工具的入参/返回/错误码） | 删除工具、改变既有工具的入参形状或返回契约（如 2.0.0 那次 `complete_layout_review` 改用 `evidenceIds`） |

## 为什么必须拆开

一次真实的例子：Agent Contract 从 1.2.0 升到 2.0.0（`complete_layout_review` 改用 `evidenceIds`）时，**导出文件的结构一个字节都没变**——协议还是 2.0.0，任何已导出的旧文件依然可以正常打开、渲染、验证。如果这四条线共用一个版本号，那次改动会强迫协议也跳 major，等于向所有已交付的 HTML 文件的持有者广播一个不存在的破坏性变更。

反过来同理：Studio 加一个工程师面板（如本轮的 Table columns / Brand color）不该让分页引擎跳版，因为引擎的字节没有变化，用户手上那份 `dist/printform.js` 的行为完全一致。

## 派生副本与防漂移

版本号只在上表的 SSOT 里定义一次；下列位置是**副本**，全部由机器校验，不靠人记：

| 副本位置 | 内容 | 由谁校验 |
|---|---|---|
| `package.json` 的 `version` | 引擎版本 | [tests/version.test.js](../tests/version.test.js) 断言等于 `PRINTFORM_VERSION` |
| `studio-v2/agent-setup.json`（两处：`studio.commandContractVersion`、`verification.expectedCommandContractVersion`） | Agent Contract 版本 + 工具数 | [tests/studio-v2/agent-bootstrap.test.js](../tests/studio-v2/agent-bootstrap.test.js) 从 `constants.js` 与 `TOOL_CONTRACTS.length` 推导 |
| `studio-v2/llms.txt` | 同上 | 同上 |
| `mcp/server.mjs` 的 `serverInfo.version` | **不是**上述任何一条线——它是 stdio MCP 服务器自身的实现版本，数字与 Agent Contract 碰巧相同纯属巧合，不要"顺手对齐" | 无（刻意不校验） |

Studio 的 Agent 连接面板不硬编码版本号：`index.html` 里该元素发空值，启动时由 `AGENT_CONTRACT_VERSION` 填入，并有单测断言发布产物里它必须为空——最坏情况留白，而不是理直气壮显示一个错的数字（`5e563c4` 的修法）。

**历史教训**：契约版本号 1.1.0→1.2.0 那次漏改了 `agent-setup.json` 的 `verification.expectedCommandContractVersion`，会让照该 manifest 引导的 Agent 拒绝一个完全正确的 Studio，而当时没有任何测试会发现。`downloadDiagnostics()` 里也曾把 `studio` 字段硬编码成 `"2.0.0"`——那其实是协议版本被复制到了描述 Studio 的字段上，每一份诊断包都在报告一个从不存在的 Studio 版本。**发现"同一事实存在多份手工副本"时，正确做法是加机器检查，而不是在文档里写"下次记得改"。**

## 组合兼容性

- Studio v2 能打开**同 major** 的协议文件（2.x）；跨 major 只读打开，不提供自动迁移（见 `core/migrations.js`）。
- 导出的单 HTML **不依赖** Studio、WebMCP 或 MCP——它内嵌两段 runtime，断网双击即可渲染。因此"用哪个版本的 Studio 导出"不影响该文件将来能否使用。
- 引擎版本与协议版本无耦合：导出文件通过 `printformRuntimeHash` 锁定它内嵌的**那一份**引擎源码，换掉即被 attestation 检出（`PRINTFORM_RUNTIME_HASH_MISMATCH`）。
