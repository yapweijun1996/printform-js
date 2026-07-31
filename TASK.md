# TASK.md — 任务板

> 最后核对：2026-07-31（对齐待提交的红框 overlay 改动，工作区基于 `3d6cb8a`，100 个单测全绿）。
>
> 规则：任务完成时移到「已完成」并附 commit；新任务先写验收标准再动手。Epic 归属见 [EPIC.md](EPIC.md)。

---

## ✅ 已完成（2026-07-31 全库审查批次）

| 任务 | Commit | 验证 |
|---|---|---|
| 核心：脚本晚于 DOMContentLoaded 注入时排版不执行 → 检查 `readyState` | `00e3b7f` | 单测 + 构建 |
| 核心：PADDT 分段克隆残留 `tb_page_break_before` 逐段强制换页 → 对齐 PTAC | `00e3b7f` | 新增回归测试 |
| v1：结构模式索引错位（渲染文档取索引、原始模板执行删改）→ 结构模式加载原始模板 | `ebd5d20` | 浏览器实测：区块 7→5，绑定保留 |
| v1：postMessage 无 origin 校验 + 日志 level XSS → origin 校验 + 白名单 | `ebd5d20` | 浏览器实测 |
| v1：mustache-lite 缺 `'`/`` ` `` 转义、吞不配对 section → 补齐 + 报错 | `ebd5d20` | node 冒烟 |
| v1：行数滑块跨模板残留、打印预览误注入 bridge | `ebd5d20` | 浏览器实测 |
| 脚本：serve-site 畸形 URL 崩溃、build-site SW 占位符静默失效、validate:v2 未签名误报篡改 | `ebd5d20` | curl / 构建 / CLI 实测 |
| v2：预览报告可伪造 → `event.source === iframe.contentWindow` | `1bc63d7` | 浏览器实测伪造被拒 |
| v2：打印预览 opener 逃逸 → `opener=null` + untrusted 拒绝 | `1bc63d7` | 代码审查 |
| v2：`set_manifest_value` 原型污染 → 拒绝原型路径段 | `1bc63d7` | 浏览器实测 `INVALID_OPERATION_PATH` |
| v2：undo 后 revision 复用破坏乐观锁 → 单调计数器 | `1bc63d7` | 浏览器实测 stale 写入报 `REVISION_CONFLICT` |
| v2：重置信任只翻 flag → 物理剥离 + 内容重推导 + themeCss 逃逸防护 | `1bc63d7` | node 冒烟 |
| v2：i18n 加载失败白屏、SW 离线导航失败、升级横幅不出现、恢复草稿超配额抛错、场景重复选择烧审查次数、findArray 误选数组、网关 JSON 错误契约、`allowExternalHttps` 死锁 | `1bc63d7` | 测试 + 构建 |
| v2：WebMCP 标准注册（navigator.modelContext，双 API）+ 2 个新测试 | `53d4a52` | 100 测全绿 |
| v2：元素级 issues（selector/pageIndex/rect/text）经 validate_project 暴露 | `53d4a52` | 浏览器实测拿到 `header > div > div > h1` |
| v2：质量门错误可点击跳编辑器（含 `/schema`、`/sampleData` 路径前缀统一） | `53d4a52` | 浏览器实测展开+聚焦+闪烁 |
| v2：本地开发 SW 网络优先（修"改了没生效"坑） | `53d4a52` | build:site 盖章验证 |
| 文档：新建 DESIGN/SPEC/EPIC/ROADMAP/TASK 五文档并对齐代码 | `3d6cb8a` | 人工核对 |
| v2：预览问题元素红框 overlay + 开关（bridge 端按 issues 实时重算 rect 绘制，postMessage 指令切换不重渲染） | （待提交） | 浏览器实测：注入低对比度主题后红框覆盖 6 处；关闭开关瞬时消失、quality gate 计数不变；切 locale 触发全量重渲染后状态仍保持；100 测全绿 |

## 🔄 进行中

（无）

## ⬜ 待办（按优先级）

| # | 任务 | Epic | 验收标准 |
|---|---|---|---|
| 2 | 安全回归测试固化：history 单调 revision、setJsonPath 原型污染、sanitizeExecutableContent、listenForPreview 来源校验、mustache-lite 严格模式 | E11 | vitest 用例落地，冒烟脚本淘汰 |
| 3 | `examples/README.md` 演示页目录（21 个 index0XX 每页一句话） | E11 | 新人能按目录找到对应特性 demo |
| 4 | CI 扩展：validate:v2 两试点 + Playwright 冒烟 3 条 | E11 | ci.yml 通过且能抓到人为注入的回归 |
| 5 | Apply 前并排 diff 面板（替代 confirm 文本） | E5/E8 | 变更 section 并排高亮，取消不落盘 |
| 6 | 高层语义工具第一批：`set_column_widths`、`set_font_scale` | E8 | 工具契约 + 单测 + agent 实测一步到位 |
| 7 | P0-A：operations discriminated union schema 校验 | E6 | 未知 operation/多余字段稳定报错 |
| 8 | P0-A：候选项目隔离 iframe 真实分页 dry-run + preview receipt | E6 | 路线图 P0-A 退出条件 |
| 9 | P0-B：preview nonce + candidate hash；Studio 签发截图证据 | E7 | 路线图 P0-B 退出条件 |
| 10 | 黄金样本分页断言（3 个代表页的页数/行数） | E9 前置 | P2 重构期间每步可跑 |

## 🚧 阻塞

（当前无阻塞。历史坑已解除：SW 开发缓存 → `53d4a52`；`build:assets` 未重建导致预览用旧 runtime → 已写入 ROADMAP 2.4 PR 检查项。）

## 📌 下一步（建议顺序）

1. 待办 #2 安全回归测试（半天，一次性锁住本次全部安全修复）。
2. 待办 #3 + #4（各 1–2 小时，维护成本立降）。
