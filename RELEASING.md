# 发布指南（Releasing）

本文档说明如何把 **sk-chart-duo** 发布到 npm，包含**首次发布**、**手动发布**与**自动发布（GitHub Actions + OIDC）**三种方式，以及本项目特有的注意事项。

> 维护者文档。使用者请看 [README](./README.md)。

## 包名说明（重要）

- **npm 包名：`sk-chart-duo`**；**GitHub 仓库同名：`sk-chart-duo`**（`https://github.com/KTBOY/sk-chart-duo`，原名 `sk-chart`，已改名，旧 URL 靠 GitHub 重定向仍可达）。本地目录名仍是 `sk-chart`。
- 为什么包名不用 `sk-chart`：npm 有防仿冒的**相似度校验**，会把包名归一化（转小写、去掉 `-_.`）后与既有包比对。`sk-chart` 归一化后正是 `skchart`，与已存在的 npm 包 `skchart` 完全同名，因此发布时被 `403 Package name too similar to existing package skchart` 拦截。`sk-chart-duo` 归一化为 `skchartduo`，与 `skchart` 有实质差异。
- 改名的连锁影响：`package.json > name` 与 `repository`/`homepage`/`bugs` 三处 URL、README 的安装/导入/徽标、工作流里的版本检查（`npm view "sk-chart-duo@$VERSION"`）、以及 **npm Trusted Publisher 里的 Repository 字段**（见第二节，仓库改名后这里必须跟着改，否则 OIDC 断言不匹配、发布被拒）。

## 前置条件

- Node.js >= 18（本项目开发环境为 v22）
- 拥有 npm 包 `sk-chart-duo` 的发布权限
- 本地校验全绿：`npm run ci`（typecheck + lint + test + build）

## registry 与登录（重要）

`package.json` 的 `publishConfig` 已把发布目标强制指向官方源，**无需手动切 registry**：

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

发布前确认已登录**官方源**（若本机全局 registry 指向镜像，必须显式指定官方源）：

```powershell
npm whoami --registry=https://registry.npmjs.org
# 未登录则执行：
npm login --registry=https://registry.npmjs.org
```

---

## 一、首次发布（建立 npm 包）

npm 的 Trusted Publisher 需要在**已存在的包**上配置，因此全新包必须先用本地命令发一次 `0.1.0`：

```powershell
# 1. 校验（typecheck + lint + test + build）
npm run ci

# 2. 发布（prepublishOnly 会再跑一遍 typecheck + test + build 并刷新 dist）
npm publish --access public --otp=<6 位验证码或恢复码>

# 3. 推送版本提交与 tag
git push --follow-tags
```

发布成功后再去 npmjs.com 为 `sk-chart-duo` 配置 Trusted Publisher（见第二节），之后所有版本都可以走全自动路径。

### ⚠️ 关于 2FA / OTP

若 npm 账户开启了双因素认证（尤其使用安全密钥 / passkey）：

- `--otp=` 需要传入**验证器 App 的 6 位验证码**，或一个**恢复码**（一次性使用）。
- 尖括号里的内容是**占位符**，必须替换成真实数字，照抄会报 `is not a legal HTTP header value`。
- 在自己终端里不加 `--otp` 直接 `npm publish`，npm 会**交互式提示**输入验证码，比手写更不易出错。
- 验证码约 30 秒过期，无法通过他人/CI 中转，必须在自己的终端完成。
- 恢复码属于敏感凭据，**不要提交到仓库或粘贴到公开场合**；如已暴露，去 npmjs.com 重新生成一组。

---

## 二、自动发布（推荐：Trusted Publishing / OIDC）

GitHub Actions 通过 OIDC 短期身份直接发布，**无需保存任何 NPM_TOKEN**，并自动附带发布溯源（provenance）。仅需一次性配置。

### 1. 在 npm 配置可信发布者（一次性）

登录 npmjs.com → 打开 `sk-chart-duo` 包的 **Settings** → **Trusted Publisher / 可信发布者** → 选择 **GitHub Actions**，填写：

- Organization or user：`KTBOY`
- Repository：`sk-chart-duo`（GitHub 仓库现名；填错或仓库改名后没跟着改，OIDC 断言对不上，发布直接被拒）
- Workflow filename：`publish-npm.yml`（只填文件名，不带 `.github/workflows/` 前缀）
- Environment：留空
- Allowed actions：**必须勾 `Allow npm publish`**。npm 页面上那句"npm stage publish is always allowed"只覆盖"暂存发布"这一步，而 `npm publish` 是直接 PUT 发布 —— 不勾就会拿到 `403 OIDC permission denied for this action`（provenance 都已成功写进 sigstore 透明日志，只差最后一步）。`Allow npm dist-tag` 不用勾，我们不单独改 dist-tag。

保存即可。注意 npm 的这条配置**创建后不可修改必填项**，改权限点 Edit 试试，不行就 Delete 再重建。

### 2. 工作流已就绪

[`.github/workflows/publish-npm.yml`](./.github/workflows/publish-npm.yml) 已配置为 OIDC 发布：`id-token: write` 权限 + 升级 npm 到最新（OIDC 需 npm >= 11.5.1）+ `npm publish --access public --provenance`，**无需任何密钥**。

`--provenance` 这个 flag **不能省**：npm 不会因为配了 Trusted Publisher 就自动走 OIDC，缺了它就退化成普通鉴权发布，而 CI 上没有 token，于是 `npm publish` 直接失败。

**首次 `v0.1.1` 连挂 5 次才定位到真因，过程记在这里免得重走**：前 4 次全是同一个 `exit 1`，而 Actions 的日志正文要登录才能读、匿名 API 只给步骤名和 annotation。于是给 Publish 步骤加了兜底 —— 失败时把 npm 的报错行抬进 `::error::` annotation（annotation 可匿名读），第 5 次直接拿到：

```
npm error 403 Forbidden - PUT https://registry.npmjs.org/sk-chart-duo
npm error OIDC permission denied for this action
```

就是上面 **Allowed actions 没勾 `Allow npm publish`** 那一条。当时 provenance 已经生成并写进 sigstore 透明日志，只差最后那个 PUT。

排查路上顺带修掉的三处**确实是要求**（不修也过不去，但都不是那 4 次的报错来源，别把它们当成病因）：`--provenance` flag；`package.json` 的 `repository.url` 对齐改名后的仓库；node 升到 24 且去掉 `setup-node` 的 `registry-url` —— 后者会自动生成 `.npmrc`，npm 优先读它去找 `_authToken` 从而跳过 OIDC 握手（npm/cli#8730 多人复现，且 node 20/22 自带 npm 低于 11.5.1）。

`publishConfig.provenance: true` 看着像"更保险"，但**别加**：它对本机手动发布路径（`npm publish --otp=`）无效甚至报错，因为 provenance 只在受支持的 CI 环境里才生成得了 —— 开关放在工作流的 flag + `NPM_CONFIG_PROVENANCE` 上就够。

工作流内置两重守卫：

- **tag 与 `package.json` 版本一致性校验**：不一致直接失败，避免打错 tag 发错版本；
- **版本已存在则跳过发布**：例如首次手动发布过、或工作流重跑，跳过 `npm publish` 只创建 Release，不会报 `EPUBLISHCONFLICT`。

### 3. 发版

```powershell
# 1. 升版本号（只改 package.json 一处）
npm version patch        # 或 minor / major

# 2. 推送版本提交与 tag（npm version 已自动 commit + tag）
git push --follow-tags
```

推送 `v*` tag 即自动触发工作流，它会依次：

1. 安装依赖、`npm run lint`
2. `npm publish`（`prepublishOnly` 自动执行 typecheck + test + build）
3. 发布成功后自动创建 GitHub Release（自动生成 release notes）

全程零手动点击。用 `release.bat` 发版时选 Y 即可走到这一步。

> 测试阶段也可在 Actions 页面手动触发该工作流（`workflow_dispatch`），但注意手动触发不会创建 Release。

---

## 三、手动发布（本地备用路径）

自动发布不可用时（例如 Trusted Publisher 未配置）：

```powershell
npm run ci                     # 本地校验
npm version patch              # 升版本号
npm publish --access public --otp=<验证码或恢复码>
git push --follow-tags
```

`prepublishOnly` 钩子会自动重新校验并构建，无需手动 build。

---

## 版本号规范（SemVer）

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：`主版本.次版本.修订号`

| 类型 | 命令 | 场景 |
| --- | --- | --- |
| patch | `npm version patch` | 修复 Bug，无 API 变化（0.1.0 → 0.1.1） |
| minor | `npm version minor` | 新增图表类型 / 向后兼容的功能（0.1.0 → 0.2.0） |
| major | `npm version major` | 破坏性变更（1.0.0 → 2.0.0） |

> 处于 `0.x` 阶段时 API 视为不稳定，可较灵活地用 minor 承载新功能。

---

## 发布后验证

```powershell
# 查看线上信息
npm view sk-chart-duo --registry=https://registry.npmjs.org

# 在临时目录试装
npm install sk-chart-duo --registry=https://registry.npmjs.org
```

同时确认 npm 包页面正常：https://www.npmjs.com/package/sk-chart-duo

---

## 文档站同步（发版后必做）

本仓库 `README.md` 里的 `<!-- #region features -->` / `#quickstart` / `#api` 三段是**文档站正文的唯一真源**。文档站（`KTBOY/sh-design`，本地 `D:\my\git\sh-ui`）的 `docs/chart/index.md` 不重写这些内容，而是用 VitePress 的 `@include` 从已安装的 npm 包里读这三段，页面自己只保留实时 demo 与站点排版。

因此发版后要走这一步，否则线上文档停在旧版本：

```powershell
cd D:\my\git\sh-ui
pnpm --filter @sh-design/docs add sk-chart-duo@^0.1.1   # 显式指定版本，见下方注意
pnpm docs:build                                          # 构建，EXIT 必须为 0
git add docs/package.json pnpm-lock.yaml pnpm-workspace.yaml && git commit && git push  # push main 即自动部署 Pages
```

**别用 `pnpm update sk-chart-duo`**：实测它会"跑成功"但装的仍是旧版本 —— pnpm 的 registry 元数据缓存和 `minimumReleaseAge` 供应链接入控制都会把刚发布的版本挡在外面。显式 `add sk-chart-duo@^<新版本>` 才会真的换掉，代价是 pnpm 会往 `pnpm-workspace.yaml` 写一条 `minimumReleaseAgeExclude` 放行记录（这个文件也要一起提交）。

**为什么必须显式 bump**：文档站原先锁 `^0.1.0`，而 caret 在 `0.x` 阶段等价 `>=0.1.0 <0.2.0`。发 `0.2.0` 后不 bump，`@include` 取到的旧包 README 与 demo 运行的旧 dist 会一起停在 0.1.0 —— 好在两者同源，不会互相打脸。

**顺序红线**：`@include` 引用的 region 必须**已经存在于已发布版本**里。若文档站先改了 `@include` 而 npm 上的 README 还没有 region 标记，VitePress 找不到片段名时不会报错，而是把**整份 README** 灌进页面（包括徽章、`./LICENSE` 相对链接与 License 全文）—— 这是 `vitepress@1.5.0` 里 `lines.slice(undefined, undefined)` 的行为。所以顺序恒为：README 改动 → 发包 → 文档站 bump。

**本地预览未发布的改动**：文档站有两条独立的本地通路，都要在提交前还原。

- 正文：把 `@include` 路径临时改成 `../../../../sk-chart/README.md#api`
- 运行时：`SK_CHART_LOCAL=1 pnpm docs:dev` 让 demo 加载 `../sk-chart/dist`（见 `docs/.vitepress/config.ts` 的 alias）

切换这个开关必须顺手删掉 `docs/.vitepress/cache`：Vite 的依赖预打包会缓存上一版的 `sk-chart-duo`，不清缓存就会拿着旧包继续渲染，图看起来"没变化"但其实测的是旧代码。配置里已给该包加 `optimizeDeps.exclude`，正是因为预打包会绕过 alias。

### 构建后断言

```bash
D=docs/.vitepress/dist/chart/index.html
grep -c '@include:' $D        # 期望 0 —— 三条 include 都真展开了
grep -c 'img.shields.io' $D   # 期望 0 —— 徽章没被灌进页面（region 未命中时会泄漏整份 README）
grep -c 'ariaLabel' $D        # 期望 >=1 —— 已发布版本的真源确实是新的
grep -cF '../../../../sk-chart' docs/chart/index.md   # 期望 0 —— 本地调试路径没被提交（CI 机上没有 D:\my\sk-chart）
```

---

## 发布检查清单

- [ ] `npm run ci` 全绿（typecheck / lint / test / build）
- [ ] README 的 API 表格与新能力同步（改动落在 `#region api` 内才会同步到文档站）
- [ ] 发版后按「文档站同步」一节 bump 依赖，三条构建后断言计数符合期望
- [ ] 按 SemVer 正确升级了版本号
- [ ] `npm publish` 成功（或 tag 触发的 OIDC 工作流成功）
- [ ] `git push --follow-tags` 已推送版本提交与 tag
- [ ] `npm view sk-chart-duo` 显示新版本

---

## 常见坑速查

| 现象 | 原因 | 解法 |
| --- | --- | --- |
| `403 Package name too similar to existing package` | npm 相似度校验（归一化后与既有包同名） | 改名（参考本文开头的「包名说明」），或改用 `@scope/name` |
| `EOTP` / 发布要求验证码 | 账户开启 2FA | `npm publish --otp=<验证码>`，或在自己终端直接跑让 npm 提示输入 |
| `is not a legal HTTP header value` | `--otp=` 后面照抄了占位符 | 换成真实的 6 位数字 |
| `E403` 无权限 / 404 源只读 | registry 指向了镜像源 | 用 `--registry=https://registry.npmjs.org`，或依赖 `publishConfig` |
| `EPUBLISHCONFLICT` 版本已存在 | 版本号没升 | `npm version patch` 后重发；工作流里已有守卫会自动跳过 |
| CI 发布报 OIDC 相关错误 | npm 版本过低 / Trusted Publisher 未配置 | 工作流已升级 npm；核对 Settings 里的仓库名与工作流文件名 |
| tag 已存在 | 版本号没升就重复发版 | 升 `package.json` 版本后重来 |
| 装到旧版本 | 本地走镜像源有缓存 | `npm install sk-chart-duo@latest --registry=https://registry.npmjs.org` |
