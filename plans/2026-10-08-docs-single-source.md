# sk-chart 文档单真源改造（sk-chart ↔ sh-design 文档站）实施计划

**Goal:** 把 sk-chart 的 API 文档真源收敛到本仓库 `README.md`，文档站 `docs/chart/index.md` 用 VitePress `@include` 引入 README 的 `#region` 片段，自己只保留实时 demo 与站点风味排版；从此「代码/README/线上文档」三者由**已发布版本号**绑死，内容漂移与版本漂移在机制上不可同时发生。

**背景（为什么要改）:** 文档站在 `KTBOY/sh-design`（本地 `D:\my\git\sh-ui`），`docs/chart/index.md` 301 行里特性 / 安装 / 快速上手 / 三张 API 表基本是 sk-chart `README.md`（178 行）的手工复制品，真正站点专属的只有 6 个 `<ChartPreview>` demo 与 `<FoldBarDemo>`。两处独立手改已经产生实际漂移（见下表）。demo 走 npm 依赖 `sk-chart-duo@0.1.0`，所以线上文档文案写的是仓库 HEAD 的新行为、渲染的是旧包 —— 这是当前最危险的失真方向。

---

## 事实核对（已验证，不是推测）

| 事实 | 证据 | 对设计的影响 |
| --- | --- | --- |
| 内容漂移已发生：`tooltip.fixedWidth` 只在 README 有，线上文档站缺 | `README.md:81` 命中 1 次；`sh-ui/docs/chart/index.md` 命中 0 次 | 反向也成立，必须选一个真源，不能继续双写 |
| 文档站在「方法/事件」处比 README 更好（README 是散文，站点是 12 行表格） | `README.md:112-124` vs `docs/chart/index.md` 的 `### 事件` / `### 方法` 表 | 单真源方向必须是「README 吸收站点的表格」，否则 include 之后线上**内容回退** |
| VitePress `@include` 用 `fs.readFileSync` + `path.join(path.dirname(file), m1)` 解析 | `vitepress@1.5.0/dist/node/chunk-DMuPggCS.js:36291-36292` | 跟随 symlink，能直接读 `../node_modules/sk-chart-duo/README.md`，无需 vite alias |
| `@include` 支持 `#region` 片段，markdown 注释形式 `<!-- #region x -->` | 同文件 `36280`（regionRE）、`35353`（findRegion 的 `<!-- #region -->` 正则） | **不必新建 `docs/api.zh.md` 片段文件**——新建文件会和 README 二次漂移，这是对本会话上一轮提案的自我推翻 |
| `@include` **静默失败**：文件找不到就原样吐出注释文本 | 同文件 `36313-36318`（catch → `return m`） | 必须有构建后断言（Task 6），否则线上出现「看不见但存在」的空章节 |
| include 的文件会登记进 watch 依赖 | 同文件 `36310` `includes.push(...)` | dev 模式改 README 能热更新 |
| npm 包已发布 `README.md`，`files: ["dist","README.md","LICENSE"]` | `package.json` files 字段；实装目录 `docs/node_modules/sk-chart-duo/` = `LICENSE README.md dist package.json` | **不用改 `files`、不用加 `exports`**，改造零发布结构成本 |
| `sk-chart-duo` 的 `exports` 允许 `./package.json` | `package.json:24` | 站点可 build 期读已装版本，做「文档基于 v X.Y.Z」徽标 |
| caret 范围 `^0.1.0` 在 0.x 下等价 `>=0.1.0 <0.2.0` | semver 约定 | 发 0.2.0 后**必须**手动 bump 文档站依赖，否则 include 和 demo 都停在 0.1.0 |
| 文档站 push main 即自动部署 Pages | `sh-ui/.github/workflows/deploy-docs.yml:3-6` | 同步最后一公里不需要新自动化：bump 依赖 + 提交 main 就上线 |

---

## 机制选型（一句话）

README 加 3 个 `#region` 锚点当唯一真源 → 文档站 include 这 3 段 → 文档站的 `sk-chart-duo` 依赖版本决定「文案 + demo 运行时」同源 → 发包后手动 `pnpm update` 一次（写进 `RELEASING.md` 清单）。

**不做跨仓库自动 bump PR**：要 PAT、要密钥、失败会静默，收益只是省一行版本号，与这仓库「零依赖、可核实」的气质不符。

**README 的 GitHub 专属装饰**（徽章、`sk-chart-duo` 包名脚注、`./LICENSE` 与 `./RELEASING.md` 相对链接、License 全文块）全部留在 region 之外，不进站点。

---

## 文件结构与责任

| 文件 | 仓库 | 责任 | 动作 |
| --- | --- | --- | --- |
| `README.md` | sk-chart | 真源：特性 bullets、快速上手、`FoldBarChartConfig` 表、主题预设、**事件表（吸收站点版）**、**方法表（吸收站点版）**、交互与无障碍 | 加 3 对 `#region` 标记 + 事件/方法由散文改表格 |
| `RELEASING.md` | sk-chart | 发布清单 | 追加「发包后 bump 文档站依赖并跑 docs:build」一节 |
| `AGENTS.md` | sk-chart | 目录地图 | 新增一行说明 README 是文档真源、改动会被站点消费 |
| `docs/chart/index.md` | sh-design | 站点：frontmatter、自有 H2（保住 `#特性` 等锚点）、6 个 demo、相关链接、include 三行 | 删重复正文，换成 `@include` |
| `docs/.vitepress/theme/components/chart/ChartVersion.vue` | sh-design | 显示当前文档所依据的已装版本 | 新建（~10 行） |
| `docs/package.json` / `pnpm-lock.yaml` | sh-design | `sk-chart-duo` 版本锁定 | 发包后手动 bump |

---

## 分阶段任务

### P0：region 设计定稿（纯文本，不动代码）

3 个 region，边界规则：**region 内不含顶层 `##` 标题**，站点侧自己写 `## 特性` / `## 快速上手` / `## API`，这样 `/chart/#特性`、`#api` 等既有锚点一个都不变（用户给我的链接就是 `#特性`，锚点断掉是可感知的回归）。

- `#features`：README 的特性 bullets（需与站点版取并集、去重）
- `#quickstart`：快速上手代码块 + 一句「全量重绘」注释说明
- `#api`：`### FoldBarChartConfig` 表 → `### 主题预设` → `### 事件` → `### 方法` → `### 交互与无障碍`

验收标准：每个 region 内 `grep -c '](\./'` = 0（零相对链接）；region 标记在 GitHub / npm 页面渲染不可见（HTML 注释）。

### P1：README 吸收站点内容（sk-chart 仓库）

- **Step 1** 事件：`README.md:112-114` 的散文改成站点那张 3 行表（事件名 / 回调参数 / 触发时机）。
- **Step 2** 方法：`README.md:116-124` 改成站点那张 9 行表，含 `activeIndex` getter 与 `on/off`。
- **Step 3** 特性：站点有「主题系统」「导出与无障碍」两条、README 有「TypeScript strict，纯函数 + 单测」一条 → 取并集，每条都能在源码/测试里核实，不新增未实现卖点。
- **Step 4** 按 P0 加 `<!-- #region features|quickstart|api -->` / `<!-- #endregion ... -->` 三对标记。

验收标准：改造后 README 表格行数 ≥ 改造前站点行数；`npm run ci` 全绿（README 不参与构建，理应恒绿，跑一次排除手滑）；`git diff --stat` 只有 `README.md`。

### P2：站点接 include（sh-design 仓库）

`docs/chart/index.md` 的 `## 特性` / `## 快速上手` / `## API` 三节正文换成：

```markdown
<!--@include: ../node_modules/sk-chart-duo/README.md#features-->
```

demo 章节（`## 在线体验`、`## 示例`）、`## 相关链接`、frontmatter 原样保留。

**本地预览通路（决策点 D2）**：include 读的是已发布 tarball，P1 的改动要发包才可见。默认用「临时把路径改成 `../../../../sk-chart/README.md#api`（从 `docs/chart` 上跳 4 级到 `D:/my`）→ 本地看效果 → 提交前改回 node_modules 路径」，靠 P5 的守卫脚本兜住忘改。备选 `pnpm link ../sk-chart`，代价是把 `docs/package.json` 写成 `link:` 协议、还得还原。

验收标准：`docs/chart/index.md` 行数从 301 降到 ~120；文件内 `grep -c '^| \`'` = 0（表格全部来自 include）。

### P3：版本可见性（sh-design 仓库）

新建 `ChartVersion.vue`，build 期 `import pkg from 'sk-chart-duo/package.json'` 取 `version`，在页面 H1 下渲染一行「本页文档依据 `sk-chart-duo` v0.1.0 生成」。

验收标准：渲染出的数字 === `docs/node_modules/sk-chart-duo/package.json` 的 version；`exports` 已放行 `./package.json`，无需改 sk-chart。

### P4：发布清单接线（sk-chart 仓库）

`RELEASING.md` 追加发版后动作：`cd D:\my\git\sh-ui && pnpm --filter @sh-design/docs update sk-chart-duo && pnpm docs:build`，通过即提交 main（Pages 自动部署）。明确写下 caret 在 0.x 锁 minor 这条坑，避免下次以为「不用管」。

验收标准：按清单文字能一路做完，不需要回忆本计划。

### P5：守卫与门禁

在 sh-design 加一个极小的构建后校验（先手工命令行，不进 CI 也行；决策点 D6）：

1. `pnpm docs:build` → `EXIT=0`（注意管道会吞退出码，显式 `echo EXIT=$?`）
2. `docs/.vitepress/dist/chart/index.html` **不含** `@include:`（静默失败检测）
3. **含** `tooltip.fixedWidth`（证明 include 拿到的是 P1 改后的新真源）
4. **含** `<h2 id="特性"`（锚点未断）
5. **不含** `../../../../sk-chart`（临时路径没进 commit）
6. sk-chart 侧 `npm run ci` 全绿

验收标准：6 条都有实跑输出与退出码，不用「应该没问题」交差。

### P6：视觉核对（按需，默认要做）

`pnpm docs:preview` 起 4173，无头 Edge 截图改前/改后两张，比对：6 个实时 demo 仍在、表格排版没崩、`#特性` 锚点滚动位置正确。

验收标准：截图对比无回归；若不做，在状态表写「未执行（按既定偏好）」而不是留空。

---

## 决策点（原始提案，等你拍板）

- **D1（region 粒度）**：默认 3 个 region 且 region 内不含 `##` 标题，站点自己写标题以保住锚点。备选：把 README 的 `## API` 也包进 region（站点更瘦，但锚点/层级受 README 单一控制，站点改不动）。
- **D2（本地预览通路）**：默认「临时路径 + 构建守卫」。备选 `pnpm link`（demo 与文档同时跑本地 dist，更真，但污染 `docs/package.json`）。
- **D3（README 是否吸收站点的方法/事件表格）**：默认**吸收**，README 成为全集。代价：README 从 178 行涨到约 200 行，GitHub 首屏略长。不吸收的后果：include 后线上方法表从 9 行退化成一行散文，属可感知回归。
- **D4（README 是否瘦身成「入口 + 指向文档站」）**：默认**不瘦身**。上一轮我提过瘦身，现在 README 一旦当真源，瘦身就是把真源砍短；只把徽章和包名脚注留在 region 之外即可。
- **D5（安装段是否 include）**：默认**不 include**。站点的 `::: code-group`（npm/pnpm/yarn 三 tab）是站点风味，README 只留 `npm install` 一行 + 脚注；这段 4 行、几乎不变，重复成本低于耦合成本。
- **D6（守卫进 CI 还是命令行纪律）**：默认先命令行（本仓库无跨仓库 CI 凭据）；要进 CI 就在 `deploy-docs.yml` 加一步 grep，零新增密钥。
- **D7（plans 目录是否提交到公开仓库）**：默认**提交**，与 `sh-ui/plans/` 一致（那边是被 git 跟踪的）。不想要就把本文件加进 `.gitignore`。
- **D8（P3 版本徽标要不要）**：默认要（10 行，把「文档写新版、demo 跑旧版」这类失真变成肉眼可见）。嫌页面多一行字可砍。

---

## 风险与回退

| 风险 | 概率 | 应对 |
| --- | --- | --- |
| `@include` 静默失败导致章节空掉（catch 后原样吐注释） | 中（路径写错即触发） | P5 第 2 条断言；HTML 注释不可见但内容会缺，所以必须机器查 |
| include 内容带相对链接（`./LICENSE`）在站点 404 | 低（设计上已排除） | P0 的 `](\./` grep = 0 |
| README 的表格排版在 VitePress 与 GitHub 呈现不一致（GitHub 会对齐表格空格） | 中 | 本仓库既有约定：不跑 `prettier --write` 全文件；只做定点编辑，改完人工看两处渲染 |
| 发包前看不到新文档 | 确定发生 | D2 的本地通路就是为它准备的 |
| 站点 demo 与 include 版本不一致 | 机制上排除（同读 `node_modules` 的一份包） | —— |

---

## 当前状态

状态取值（不混用）：`待开始` / `进行中` / `已交付（本地）` / `已通过（带证据）` / `阻塞`

| 阶段 | 状态 |
| --- | --- |
| 事实核对与机制验证（VitePress include 源码 + 依赖落盘） | 已通过（带证据，见上表 file:line） |
| D1–D8 拍板 | 已通过（全选默认：叠加在未提交版本上改 / 提交 node_modules 路径 + 泄漏断言） |
| P0 region 设计定稿（3 段、region 内不含 `##` 标题、零相对链接） | 已通过（`grep '](\./'` 在三个 region 内均为 0） |
| P1 README 吸收站点表格 + 加 region | 已交付（本地）：197 行，表格行 35 ≥ 站点原 34；**顺带补了 `ariaLabel` 行**（`src/charts/fold-bar/types.ts:172` 有、README 与站点两边都没写，是第三处漂移） |
| P2 站点接 include（sh-design） | 已交付（本地）：`docs/chart/index.md` 301 → 206 行，表内 `^| \`` 行数 = 0 |
| P3 `ChartVersion.vue` + `theme/index.ts` 注册 | 已交付（本地）：eslint 零新增错误 |
| P4 RELEASING.md「文档站同步」一节 + AGENTS.md 真源约定 | 已交付（本地） |
| P5 守卫与门禁 | 已通过（证据见下） |
| P6 无头 Edge 视觉核对 | 已通过（带证据）：CDP 驱动无头 Edge 截 `/chart/` 整页 + 断崖章节放大图；DOM 层对照 `polygon`（0.1.0 直线折面，8 个 / `path` 0 个）vs `path` 贝塞尔（本地修复版，`M204.6,151.16 C215.6,...`） |
| 追加：文档站「示例」新增「大落差折痕自适应」两图（`SHARP_DROP` / `SPIKE_UP`，站点自有内容，不进 README 真源） | 已交付（本地） |
| 追加：第 3 层本地通路落地 —— `SK_CHART_LOCAL=1` 的 vite alias + `optimizeDeps.exclude` | 已交付（本地，默认关闭）。**踩到的坑**：只加 alias 不加 exclude 时预打包仍产出旧包，清 `docs/.vitepress/cache` 才生效（已写进 RELEASING） |
| 提交 / 推送（sk-chart） | 已通过：`7229a06` → `fd1d255` → `2f8a7ac` → `9ab0e3a` → `c376d51` 均已推 main |
| 发布 | **已通过**：`sk-chart-duo@0.1.1` 已上 npm（版本端点 HTTP 200，`license: GPL-3.0-only`，`repository` 已对齐新名），GitHub Release `v0.1.1` 已创建 |
| 文档站 bump 依赖 + 还原 include | 已交付（本地，未提交）：装到 `0.1.1`，三条 include 已还原为 node_modules 路径 |
| 最终门禁 `pnpm docs:build` | **已通过**：EXIT=0 / 12.74s；`@include:` 残留 0、徽章泄漏 0、`ariaLabel` 1、`id="特性"` 1、本地路径残留 0、`大落差折痕自适应` 1、版本徽标渲染 `v0.1.1` |
| 提交 / 推送（sh-design） | 未执行，等指令（该仓库另有你自己的在途改动，push main 会直接上线 Pages） |

### 发布这一步实际卡住的原因（与本文原计划不同）

原计划以为发包是一次动作；实测连挂 5 次，真因是 **npm Trusted Publisher 的 `Allow npm publish` 权限没勾** —— npm 页面上"stage publish 始终允许"那句话不覆盖 `npm publish` 的直接 PUT。我上一轮建议"两个 checkbox 都不勾"是错的。排查过程中顺带修掉的 `--provenance`、`repository.url` 对齐、node 24、去掉 `setup-node` 的 `registry-url` 都是必要条件，但都不是那几次失败的报错来源。全过程与依据记在 `RELEASING.md` 第二节。

定位手段值得留档：Actions 日志正文要登录才能读，匿名 API 只有步骤名与 annotation；因此给 Publish 步骤加了失败时把 npm 报错行抬进 `::error::` annotation 的兜底 —— 第 5 次就是靠它一句 `403 OIDC permission denied for this action` 收敛的。

### P5 实测证据（比原计划更硬，且推翻了我对失败模式的假设）

| 断言 | 结果 |
| --- | --- |
| 用**本地** sk-chart README（有 region）构建 | `BUILD_EXIT=0`，8.24s |
| dist 内 `@include:` 残留 | 0（三条全部真展开） |
| dist 内 `img.shields.io` 徽章泄漏 | 0（region 边界正确，装饰留在外面） |
| `ariaLabel` / `fixedWidth` / `id="特性"` 锚点 | 各 1 —— 新真源生效且旧锚点未断 |
| 版本徽标渲染 | `sk-chart-duo v0.1.0`（取自已装包，非手写） |
| 还原成 node_modules 路径后构建 | `BUILD_EXIT=1`，8 条 dead link |
| sk-chart `npm run ci` | `EXIT=0` 全绿 |

**原计划说"include 未命中会静默失败、线上无声空章节"——这条被证伪并升级了**：region 未命中时整份 README 被灌入页面，其中的 `./LICENSE`、`./RELEASING.md` 相对链接会撞上 VitePress **自带的 dead-link 门禁**，构建直接失败。所以不需要我另写 grep 断言来兜底，站点自带的检查就是那道闸（我把它写进 `RELEASING.md` 的「顺序红线」）。

### 阻塞项（下一步只有一个动作）

`KTBOY/sh-design` 的 main 一旦收到这份 include 改动就会 CI 红（当前 npm 上的 0.1.0 README 没有 region）。**必须先在 sk-chart 发一个 patch 版本（0.1.1，纯文档改动）**，再 `pnpm --filter @sh-design/docs update sk-chart-duo`，文档站才会绿。发包是需要你授权的动作（`npm version patch` + 推 tag 触发 OIDC，或本地 `npm publish --otp=`），我没有自行执行。
