# 浏览器矩阵验收记录

> 这是[工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) P0-B 退出条件「Sales Invoice 与 Purchase Order 在四浏览器通过空值、1、45、100、500 行、长文本和多语言场景」的留存结论。
>
> 复现命令：`node scripts/browser-matrix.mjs`（约 15–25 分钟；`--quick` 跳过 100/500 行）。原始数据写入 `browser-matrix-result.json`（已 gitignore，不入库）。
>
> 本次执行：2026-07-31（首次跑批 + 修复后复跑），构建对齐 `4b0cdc1`，macOS。**Linux 复现**：2026-07-31，GitHub Actions Ubuntu runner（`.github/workflows/browser-matrix.yml`，`workflow_dispatch`），构建对齐 `af64b25`，见下方「Linux 复现」一节。

> Current-source review: 2026-09-10. Historical macOS/Linux matrix results remain 88/88. The Windows full four-target runner now passes **88/88** against source commit `a4caf93857669e05d0d521567ecf5ab6f4389df5` (Chromium/Chrome/Firefox/WebKit, 22 cells each). The earlier current-source 88/88 diagnostic failure is superseded by this rerun. These are browser/render results, not certification of Edge, Safari.app or any print driver. See [current evidence](STUDIO_V2_PRODUCTION_PLAN.md).

## 结论

**当前源码的 88 个格子全部通过，零问题**，且四个目标的逐页行数均符合各场景预期；`empty` 按设计 blocked。历史修复后的 22 个可比格子仍保持跨引擎逐页行数一致（首次跑批时有 4 个格子分歧，见下方「跨引擎分页差异」）。

## 覆盖范围

| 维度 | 取值 |
|---|---|
| 模板 | Sales Invoice、Purchase Order (Crimson) |
| 浏览器目标 | Chromium（Playwright 内置）、Google Chrome（品牌版）、Firefox、WebKit |
| 行数场景 | 空值、1、45、100、500 |
| 其他场景 | 长文本（多语言混排）|
| 打印语言 | en-MY、zh-CN、ms-MY、ja-JP、vi-VN |

**关于「四浏览器」的诚实说明**：本记录的四个目标里，Chromium 与 Chrome 共用同一引擎（因此分页结果必然一致，跑 Chrome 只额外证明品牌版构建可用）；Playwright 的 WebKit 是 Safari 引擎但**不是真 Safari.app**。Edge 本机未安装，它同样是 Chromium 引擎。所以实际覆盖的是**三个渲染引擎**（Blink / Gecko / WebKit），不是四个独立引擎——路线图措辞里的"四浏览器"若指四个独立引擎，本记录不满足；若指桌面主流浏览器覆盖面，则满足。

## 判定标准

每个格子必须：渲染状态 `ready`、零水平/垂直溢出、零对比度失败、`renderedRows === expectedRows`（无丢行）。

例外：`empty` 场景**必须**是 `blocked`——没有行项的发票按 schema 设计就该验证失败，把它当成矩阵失败会让整份报告失去意义。

## 跨引擎一致性

**修复后：22 个可比格子四目标逐页行数完全一致，零分歧。** Sales Invoice 自始至终一致，Purchase Order 经下述修复后收敛。

首次跑批时 Purchase Order 有 4 个格子分歧（默认 / 45 行 / 100 行 / 500 行，Firefox 每页少一行，500 行时 34 页 vs 36 页）；加语言维度后马来语仍分歧、日语分歧方向反转。已解决，机制与修法见下。

长文本场景**自始至终**三引擎一致（11 页 `[3,3,…,2]`），因为长文切分按词数计算、不依赖字体度量——侧面印证差异根源是区块高度测量。

## 跨引擎分页差异：已解决（2026-07-31）

### 完整机制

数据行高在三个引擎中**完全相同（42.00px）**——字号从来不是问题所在。差异全部来自非行区块（页头 + 文档信息 + 行头 + 页脚 logo + 页码脚），其合计高度随 **引擎 × 打印语言** 在 **386.58 – 411.20px** 之间波动，跨度 24.62px，约 0.59 个行高。

于是留给数据行的空间是 **612.80 – 637.42px**，换算成行数是 **14.59 – 15.18 行**——**恰好跨在 15 这个整数边界上**。所以有的组合装 15 行、有的只装 14 行。这不是某个引擎的缺陷，是该版式的行容量天生落在临界点。

### 修法：把整个范围移到边界同一侧

给非行区加常数 K 后，可用空间变为 `[612.80−K, 637.42−K]`，要落进 14 行区间 `[588, 630)`：

- `637.42 − K < 630` → K > 7.42
- `612.80 − K ≥ 588` → K ≤ 24.80

**取中点 K = 16px**（`.pf-page-footer` 的 padding-bottom 12px → 28px），上下各留约 8.6px 余量，而不是贴着 7.42 那一端——那只是换一个悬崖站。加在页脚下方也符合打印实际（多数打印机底部有不可打印区）。

**这是对模板改一次、所有浏览器套用同一份 CSS**，不需要浏览器嗅探，也没有按引擎调字号。

### 代价与另一条未选的路

代价是每页 15 行变 14 行，页数约多 7%（500 行从 34 页变 36 页——注意：变成了原先 Firefox 的页数，而不是 Chromium 的）。

另一条路是反方向：把非行区**压缩约 24px**，让所有组合都装下 15 行。省纸，但要从文档信息块/页脚真省出 24px，版式变化明显。**未采用**，因为收益（7% 纸张）不值得重新设计已交付试点模板的版式；若将来纸张成本成为诉求，可重开此选项。

### 曾走过的弯路（避免重复）

- 先试过只加 6px 余量，用聚焦探测（仅 en-MY）测出"四目标收敛"，**结论是错的**——全量矩阵一跑，马来语仍分歧、日语分歧方向还反了过来。**窄范围的绿不等于绿。**
- 中途两次测量脚本有缺陷：一次用 `页高 − 行高×行数` 反推非行区（循环论证，结果必然差一行）；一次误以为数据行在单个 `pf-grid` 容器内，实际**每行是独立的 `<table>` 直接挂在页面下**，按 class 首个 token 分组会把行头表和 15 个行表加成一个数。涉及数字的结论，先验证分解本身对不对再推论。

## Linux 复现（2026-07-31，GitHub Actions Ubuntu runner）

之前的结论只在 macOS 单机跑过，而 ROADMAP §2.1 第三条陷阱记录过"同一引擎跨操作系统度量可能不同"（Firefox 行分布 macOS 与 CI Linux 曾经不一样）。为验证 K=16px 的收敛修法在 Linux 上是否同样成立，新增 `.github/workflows/browser-matrix.yml`（`workflow_dispatch` 手动触发）在 Ubuntu runner 上完整跑了一次（非 `--quick`，全部 88 格）：

- **运行记录**：[Actions run 30632832821](https://github.com/yapweijun1996/printform-js/actions/runs/30632832821)，用时约 95 秒（比本地估计的 15–25 分钟快得多——CI runner 磁盘/CPU 更快，且不含人工交互开销）。
- **结果：88/88 全过，零分歧**，四个目标（Chromium/Chrome/Firefox/WebKit）在 Ubuntu 上全部成功启动（含品牌版 Chrome，未出现 SKIP）。
- **逐页行数与 macOS 结论完全一致**：Purchase Order 45 行场景四目标均为 `[14,14,14,3]`；Sales Invoice 45 行场景四目标均为 `[24,21,0]`。K=16px 的收敛修法**不是 macOS 专属的巧合**，同一份 CSS 在 Linux 上同样把所有组合收敛到边界同一侧。

结论：ROADMAP/TASK.md 此前标注的"建议在 Linux/Windows 上重跑一次矩阵"，Linux 部分已完成且通过；Windows 现在也完成了本地完整 `browser-matrix.mjs` 复跑，但仍无对应的远程 Windows + 四目标发布自动化通道。本轮同时保留三个 Playwright 引擎的完整 E2E 回归，见下节。

## Windows Playwright 引擎回归（2026-09-08）

这是本轮实施后、重建 `site-dist` 后的完整 Playwright 项目回归，不等同于上面的四目标 `browser-matrix.mjs` 发布矩阵：

- Chromium：74/74 通过。
- Firefox：58/58 个适用用例通过，另有 16 个明确标记为项目不适用的 Chromium-only 用例跳过。
- WebKit：58/58 个适用用例通过，另有 16 个明确标记为项目不适用的 Chromium-only 用例跳过。

它提供三个 Playwright 渲染引擎的 Windows 回归证据，但不证明 Edge、Safari.app、Windows 系统打印预览或真实打印机链路。完整四目标矩阵的 current-source 结果见下一节。

## Windows current-source 完整矩阵（2026-09-10）

运行命令：`node scripts/browser-matrix.mjs`，构建为当前 `site-dist`，源代码与 runner 对齐 `a4caf93857669e05d0d521567ecf5ab6f4389df5`。

- 结果：**88/88 通过，0 problem cells**；Chromium、branded Chrome、Firefox、WebKit 各 **22/22**。
- 覆盖：两个样本、`default`/`empty`/`one`/`45-rows`/`100-rows`/`500-rows`/`long-text`、以及 `zh-CN`/`ms-MY`/`ja-JP`/`vi-VN`（`en-MY` 由默认场景覆盖）。`empty` 是预期的 `blocked`，其余场景为 `ready`，无溢出、垂直溢出、对比度失败或丢行。
- runner 先完成 host admission；场景和语言通过真实 Editor UI 控件变更，保留人类批准边界。该静态 synthetic matrix 没有 live Provider 请求，因此不替代 direct-BYOK、Provider CORS/quota/reliability、Edge、Safari.app、系统打印或 physical printer evidence。

此前同一 current-source 尝试因 runner 未 admission、绕过 human-approved UI mutation 以及 Chrome 首次空 `srcdoc` race 而出现问题；本次用最小 runner/preview 修正后重跑通过，旧诊断不再作为当前失败结论。

## 对成熟度的影响

退出条件的字面要求（两模板在各浏览器**通过**全部场景）**已满足**：当前 Windows、历史 macOS 与 Linux 均有 88/88 记录，且跨引擎分页已收敛一致。

但**本记录不自行把成熟度改为 Production Ready**。Production Ready 是对外承诺，应由维护者显式宣布，不由一次自动化跑批的绿灯推导。宣布前仍需完成 P0 个案证据、direct-BYOK/provider 证据、目标平台系统打印检查与明确的发布批准。本矩阵在 macOS、Linux 和当前 Windows 已有记录，但 Edge、Safari.app、Windows 系统打印预览和真实打印机链路仍未认证。
