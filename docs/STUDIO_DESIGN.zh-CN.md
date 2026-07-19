# PrintForm Studio — 产品设计文档

> 状态: v1.1 (已评审,开放问题已决议,Phase 1 开发中)
> 日期: 2026-07-19
> 前置阅读: [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md), [docs/CONFIGURATION.md](CONFIGURATION.md)

---

## 1. 背景与动机

PrintForm.js 目前的使用方式是"读文档 → 手改 `data-*` 属性 → 刷新浏览器看分页效果",一个循环下来几分钟,调一套模板要几十个循环。配置项有 42 个(32 主配置 + 10 PADDT),记不住、容易拼错、效果要跑完才知道。

**Studio 的目标:把这个循环从几分钟压缩到一秒,并且不需要记任何配置名。**

## 2. 目标与非目标

### 目标

- 可视化调整全部 42 个配置项,实时看到分页结果
- 内置现有 demo 作为起始模板
- 一键导出可直接使用的 HTML 模板
- 暴露分页决策过程(哪一行为什么被推到下一页)

### 非目标(明确不做)

- ❌ 自由画布式设计器(拖拽任意元素)——PrintForm 的区块分类是固定的,Studio 遵循这个约束
- ❌ 所见即所得的富文本编辑——Phase 2 只做区块级结构编辑
- ❌ 后端服务——纯静态页面,跟库本身一样零依赖部署
- ❌ 替代 Chromium 打印预览——Studio 预览用于快速迭代,最终验收仍以浏览器打印预览为准

## 3. 目标用户

| 用户 | 场景 | 主要用哪个 Phase |
|------|------|-----------------|
| 库作者(你) | 调试新 flag、复现 issue | Phase 1 + 检查器 |
| ERP 实施人员 | 给客户定制发票/DO 模板 | Phase 1 + 2 |
| 客户方 IT | 微调既有模板(改 logo、行高) | Phase 2 |
| 集成开发者 | 模板接真实数据 | Phase 3 |

## 4. 核心概念

```
模板 (Template)  = 一份含 .printform 容器的 HTML 文件(现有 demo 就是模板)
配置 (Config)    = 42 个 data-* 属性的取值集合
预览 (Preview)   = 模板 + 配置在 iframe 里跑 printform.js 的结果
会话 (Session)   = 用户当前的 模板 + 配置修改集,存 localStorage
```

## 5. 界面设计

### 5.1 总体布局(三栏)

```
┌────────────────────────────────────────────────────────────────┐
│  PrintForm Studio        [模板: demo001 ▼] [导出 HTML] [打印预览] │
├──────────────┬───────────────────────────────┬─────────────────┤
│ 配置面板      │  预览区 (iframe)               │ 检查器           │
│              │                               │                 │
│ ▸ 纸张尺寸(5) │  ┌─────────────────┐          │ 页数: 3          │
│ ▾ 重复元素(15)│  │   第 1 页        │          │ ┌─────────────┐ │
│   ☑ header   │  │   (750x1050)    │          │ │分页日志       │ │
│   ☑ docinfo  │  └─────────────────┘          │ │+12ms row 18  │ │
│   ☐ footer   │  ┌─────────────────┐          │ │ → page 2     │ │
│ ▸ 虚拟行(8)   │  │   第 2 页        │          │ │(debug.js 输出)│ │
│ ▸ N-Up(3)    │  └─────────────────┘          │ └─────────────┘ │
│ ▸ PADDT(10)  │       ...                     │ [复制配置 JSON]  │
│ ▸ 调试(1)    │                               │                 │
└──────────────┴───────────────────────────────┴─────────────────┘
```

- 左栏宽 ~280px,右栏 ~300px,可折叠;中间自适应
- 配置面板按 `config-reference.json` 的 `category` 分组折叠
- 每个配置项旁有 ⓘ 悬浮显示 `description`,修改过的项高亮 + "重置"按钮

### 5.2 配置控件映射规则

| descriptor.type | 控件 |
|-----------------|------|
| Boolean (y/n)   | 开关 toggle |
| Number          | 数字输入框(带默认值 placeholder) |
| String          | 文本输入框 |
| 多行 HTML(如 custom-dummy-row-item-content) | 代码文本域(collapsed by default) |

**控件全部由 `config-reference.json` 驱动生成,零硬编码。** 新增 flag 后跑 `npm run docs` 重新生成 JSON,Studio 自动出现新控件——文档、库、Studio 三者同源。

## 6. 技术架构

### 6.1 关键决策: 预览 = iframe 完全重载

`PrintFormFormatter.format()` 结束时会 `this.formEl.remove()`(删除原始容器,替换为分页结果),**已格式化的 DOM 无法二次格式化**。因此:

```
配置修改 → debounce 300ms → iframe.src = blob URL(模板 HTML + 注入配置) → 重新加载执行
```

- 模板原始 HTML 常驻 Studio 内存(fetch 一次)
- 每次重载时把当前配置序列化成 `data-*` 属性写进 `.printform` 标签,生成 blob URL
- 这样导出的 HTML 和预览的 HTML **字节级一致**,不存在"预览和导出不一样"的问题

### 6.2 检查器数据通道

`data-debug="y"` 时 `debug.js` 会把带时间戳的分页日志写入 console。Studio 在 iframe 里注入一段桥接脚本,把这些日志通过 `postMessage` 转发给检查器面板。页数、每页高度等指标同样由桥接脚本从格式化结果 DOM 读取后上报。

```
iframe 内: printform.js → console.log (debug.js 拦截) → bridge.js → postMessage
Studio 侧: window.onmessage → 检查器面板渲染
```

### 6.3 文件结构

```
studio/
├── index.html          # Studio 单页应用入口
├── studio.js           # 主逻辑(面板生成、iframe 管理、导出)
├── studio.css
├── bridge.js           # 注入 iframe 的桥接脚本
└── templates.json      # 内置模板清单(名称 → 相对路径,复用现有 demo)
```

- 纯 Vanilla JS,与库同栈,不引入框架
- 部署 = 静态文件,GitHub Pages 直接可用
- 不进 `dist/`,是独立工具不是库的一部分

### 6.4 数据流总览

```
templates.json ─┐
                ├→ 模板选择 → fetch 模板 HTML ─┐
config-reference.json → 生成配置面板 → 用户修改 ─┤
                                              ↓
                                   合成 HTML(注入 data-*)
                                              ↓
                              blob URL → iframe 重载 → printform.js 执行
                                              ↓                ↓
                                        预览呈现        bridge.js → 检查器
                                              ↓
                                    [导出 HTML] = 同一份合成 HTML 直接下载
```

## 7. 分阶段计划与验收标准

### Phase 1 — Config Playground(核心价值验证)

**范围:** 模板选择 + 自动生成配置面板 + iframe 实时预览 + 导出 HTML + 检查器(页数/日志)

**验收标准:**

1. 从 `templates.json` 选择任一 demo,预览正确渲染分页结果
2. 42 个配置项全部出现在面板中,分组、默认值、说明与 `config-reference.json` 一致
3. 修改任一配置(如 `data-repeat-header` y→n),1 秒内预览更新且效果正确
4. 导出的 HTML 双击打开,渲染结果与 Studio 预览一致
5. `data-debug="y"` 时检查器能显示分页日志
6. 修改过的配置项有视觉标记,可单项重置,刷新页面后会话不丢失(localStorage)
7. 新增一个 flag 到 `CONFIG_DESCRIPTORS` 并跑 `npm run docs` 后,Studio 无需改代码即出现新控件

**不做:** 编辑模板内容、数据绑定。

### Phase 2 — 区块编辑器

**范围:** 预览中点选区块高亮 → 侧栏编辑该区块 HTML → 增删/复制 `.prowitem` → 行数快捷调节(模拟不同数据量下的分页)

**验收标准:**

1. 点击预览中任一区块,能识别其类型(pheader/prowitem/...)并高亮
2. 编辑区块 HTML 后预览即时更新
3. "行数滑杆"可把 `.prowitem` 复制到 N 行,验证多页分页效果
4. 编辑后的模板可导出,且再次导入 Studio 能继续编辑

### Phase 3 — 数据绑定与集成导出

**范围:** `{{placeholder}}` 占位符 + 示例 JSON 数据面板 + 行项目循环 (`{{#items}}...{{/items}}`) + 导出"模板 + 注入脚本"包

**验收标准:**

1. 模板中的占位符被示例数据替换后预览
2. 修改示例 JSON(增减行项目)预览随之重新分页
3. 导出包在无 Studio 环境下,以 `PrintFormTemplate.render(data)` 一行代码完成注入+分页
4. 提供 ERP 集成示例文档(含 ColdFusion/后端输出 JSON 的对接说明)

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Studio 预览与 Chromium 打印预览有细微差异(字体/DPI) | 用户误信预览为最终效果 | 顶栏常驻"打印预览验证"按钮(window.open + window.print);文档明确预览定位 |
| 模板 HTML 很大(demo001 ~2500 行),blob 重载性能 | 低端机预览卡顿 | debounce 300ms;实测 demo001 重载 <200ms,可接受;必要时加"暂停自动刷新"开关 |
| iframe 沙箱下相对路径(img/)失效 | 图片不显示 | blob URL 中注入 `<base href>` 指向 Studio 同源根路径 |
| 42 个配置项面板过长 | 找不到想调的项 | 分组折叠 + 顶部搜索框(按 htmlAttr/description 过滤) |
| Phase 2 的 HTML 手工编辑破坏区块结构 | 分页失败 | 编辑后校验必需 class 是否仍存在,缺失时警告而不阻止 |

## 9. 里程碑估算

| 阶段 | 工作量(专注日) | 交付物 |
|------|---------------|--------|
| Phase 1 | 3–4 天 | studio/ 可用,覆盖验收 1–9(含双语与对比模式) |
| Phase 2 | 3–4 天 | 区块编辑 + 行数模拟 |
| Phase 3 | 3–5 天 | 数据绑定 + 集成导出包 + 对接文档 |

Phase 1 独立可用、独立有价值;做完先真实使用一段时间,再决定 Phase 2/3 是否调整方向。

## 10. 开放问题决议(2026-07-19 评审通过)

1. **界面语言:双语切换(zh/en)**。英文描述加入 `descriptor-metadata.js`(SSOT),经 `npm run docs` 透传到 `config-reference.json`,Studio 顶栏放 zh/en 切换按钮。翻译不单独维护文件,与中文描述同一条目。
2. **占位符语法:Mustache 风格 `{{x}}`**,循环用 `{{#items}}...{{/items}}`。后端(ColdFusion 或任何栈)只需输出 JSON。
3. **配置对比:Phase 1 就做**。顶栏"对比模式"开关:开启后预览区分裂为 A/B 两个 iframe,配置面板出现 A/B 选择器,修改只作用于当前选中侧;提供"复制 A→B"按钮快速建立基线。Phase 1 工作量估算相应 +1 天(2–3 天 → 3–4 天)。

### Phase 1 验收标准补充(由决议 1、3 新增)

8. 顶栏切换 zh/en,配置面板的分组名与描述即时切换语言,选择持久化到 localStorage
9. 开启对比模式后,A/B 两侧以不同配置渲染同一模板,两侧页数各自正确显示;关闭对比模式回到单预览且保留 A 侧配置
