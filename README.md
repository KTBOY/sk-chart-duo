# sk-chart

[![npm version](https://img.shields.io/npm/v/sk-chart-duo.svg)](https://www.npmjs.com/package/sk-chart-duo)
[![license: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)

<!-- 图片用 raw.githubusercontent 绝对地址：README 会随 npm 包发布，相对路径在 npm 页面必然 404。 -->
![FoldBarChart 的四层构成：柱体竖向渐变 → 叠加斜纹 pattern → 折面与折棱 → 文字、浮标与选中态](https://raw.githubusercontent.com/KTBOY/sk-chart-duo/main/docs/assets/fold-chart-layers.png)

A lightweight, SVG-first chart library with handcrafted visual styles.

首版提供 **FoldBarChart**：折纸漏斗柱状图 —— 渐变柱体由"折面"相连，闲置列呈条纹纸感，高亮列浮起 wash 与 tooltip。源自 `payments-fold-chart.html` 效果 3 的组件化实现。

<!-- 下方 #region features / quickstart / api 三段是文档站 ktboy.github.io/sh-design/chart 的 @include 真源；
     GitHub 专属装饰（徽章、包名脚注、License 全文、相对链接）必须留在 region 之外，否则会在站点里 404。 -->

<!-- #region features -->
- **零依赖**，gzip ~8KB，直接引入构建产物（ESM / CJS）或 npm 安装
- **SVG 渲染**，viewBox 设计空间，任意容器宽度自适应；SVG 本身透明，底色由宿主页面控制
- **G2Plot 风格 API**：`new FoldBarChart(el, config)` + `update` / `resize` / `destroy` / `on`
- **多实例安全**：`defs` id 与样式按实例隔离，同页多图互不干扰
- **主题系统**：内置 `light` / `dark` 预设，`registerTheme` 注册自定义主题包，皮肤 / token / 格式化三层可配
- **导出与无障碍**：`toSVGString` / `getDataURL` / `download`；键盘 `←` `→` `Home` `End` 导航，`prefers-reduced-motion` 自动降级
- **TypeScript strict**，几何与比例尺全部纯函数 + 单测覆盖
<!-- #endregion features -->

## 安装

```bash
npm install sk-chart-duo
```

> npm 包名为 `sk-chart-duo`（`sk-chart` 已被 npm 相似度校验判定与既有包 `skchart` 冲突，无法使用），仓库名仍是 `sk-chart`。

或直接引入构建产物（`dist/index.js` ESM / `dist/index.cjs` CJS）。

## 快速上手

<!-- #region quickstart -->
```ts
import { FoldBarChart } from 'sk-chart-duo';

const chart = new FoldBarChart('#container', {
  data: [
    { label: '发起支付', value: 65.2 },
    { label: '授权支付', value: 54.8 },
    { label: '支付成功', value: 48.6 },
    { label: '商户打款', value: 38.3 },
    { label: '完成交易', value: 32.9 },
  ],
  scale: { exponent: 2 },        // 折纸漏斗轮廓；默认 1 = 线性
  state: { defaultActive: 2 },   // 闲置时高亮第 3 列
  title: { text: '支付' },
});

chart.on('column:click', ({ index, datum }) => console.log(index, datum));
chart.update({ data: nextData }); // 全量重绘
chart.resize(960, 430);           // 变更 viewBox 设计空间
chart.destroy();                  // 清理 DOM 与事件
```
<!-- #endregion quickstart -->

本地 demo：

```bash
npm install
npm run dev      # Vite，打开 examples/
```

## API

<!-- #region api -->
### `FoldBarChartConfig`

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `data` | `FoldBarDatum[]` | 必填 | `{ label, value, ...extra }` |
| `xField` / `yField` | `string` | `label` / `value` | 数据字段映射 |
| `width` / `height` | `number` | `860` / `386` | viewBox 设计空间 |
| `valueFormat` | `(v) => string` | `v => v.toFixed(1)+'k'` | 柱头数值格式 |
| `ariaLabel` | `string` | `'fold bar chart'` | SVG 根节点的 `aria-label` |
| `padding` | `Partial<{top,right,bottom,left}>` | `64/29/26/73` | 绘图区留白；启用 `xAxis.bottomLabels` 时底部自动扩高 |
| `stair` | `{ bottomOffset?, topOffset? }` | `30` / `74` | 柱顶阶梯锚点（value=0 与 max 的柱顶位置） |
| `scale.exponent` | `number` | `1` | 高度映射幂次；`2` 还原折纸漏斗轮廓 |
| `fold.run` | `number` | `20` | 折面水平跨度 |
| `fold.creaseColor/Width` | — | 白 / `1.2` | 折痕高光 |
| `axis.ticks` | `number[]` | 自动（nice） | y 轴刻度值；位置按 `barTopOf` 真实映射 |
| `axis.tickFormat` | `(v) => string` | `v => v+'k'` | 刻度文案 |
| `xAxis.labelFormat` | `(d, i, data) => string` | xField 值 | 顶部类目行文案 |
| `xAxis.bottomLabels` | `(d, i, data) => string \| string[]` | 无 | 底部语义行（如阶段序号 + 环节转化率），渲染在渐隐遮罩之外 |
| `xAxis.title` | `{ text?, x?, y? }` | 无 | X 轴标题，位于底部语义行之后的下一行，默认水平居中；`x`/`y` 可覆盖 |
| `xAxis.showLine/showTick` | `boolean` | `false` | 柱底基线 / 列中心刻度线（均在渐隐带下方） |
| `xAxis.showGrid` | `boolean` | `true` | 竖直分列线 |
| `tooltip.enabled` | `boolean` | `true` | |
| `tooltip.formatter` | `(datum, i, data) => TooltipPart[]` | 类目 + 数值 | 自定义 tooltip 内容 |
| `tooltip.fixedWidth` | `number` | — | 跳过文字测量（SSR/测试逃生口） |
| `state.defaultActive` | `number` | 最后一列 | 闲置高亮列 |
| `title` | `{ text?, x?, y? }` | 无标题 | 左上标题 |
| `style` | `FoldBarStyleConfig` | 原稿配色 | 条纹/渐变/pill/阴影/渐隐等全部可换肤；`stripePattern.enabled`、`pill.enabled`、`washEnabled`、`fadeMask.enabled` 可逐项关闭装饰，得到干净的普通柱状图观感 |
| `theme` | `'light' \| 'dark' \| ThemePack \| DeepPartialTokens` | 原稿外观（等价 `'light'`） | 预设名 / 内联主题包 / 旧版字体 token 局部，三种形态均可 |

SVG 本身透明、不画背景，底色由宿主页面控制（白底卡片或深色背景均可）。

折面水平跨度固定，因此相邻两列高差过大时折痕会很陡。此时折痕从直线渐变为 S 形曲线（水平切线进出两柱柱顶），折面高光带同步收拢到折痕附近；斜率 ≤ 1:1 时保持直线，与平缓漏斗观感一致。

### 主题预设

```ts
import { registerTheme, FoldBarChart } from 'sk-chart-duo';

registerTheme('brand', {
  style: { barGradient: { normal: myStops } }, // 视觉皮肤
  tokens: { title: { fill: '#0A0A0A' } },      // 字体/颜色/过渡 token
  formats: { valueFormat: (v) => `${v}k` },    // 默认数值/刻度格式化
});

new FoldBarChart(el, { data, theme: 'dark' });            // 内置预设
new FoldBarChart(el, { data, theme: 'brand' });           // 自定义预设
new FoldBarChart(el, { data, theme: { tokens: { ... } } }); // 内联主题包
```

- 内置 `light`（原稿折纸皮肤）与 `dark` 两个预设
- 解析顺序：内置默认 → 主题包 → config 显式字段（`style`、对象形态 `theme`、`valueFormat`、`axis.tickFormat`），后者优先
- 旧写法 `theme: { number: { fontSize: 22 } }`（直接传 token 局部）完全兼容
- 未知预设名回退默认并 `console.warn`

### 事件

| 事件名           | 回调参数             | 触发时机                                       |
| ---------------- | -------------------- | ---------------------------------------------- |
| `column:enter` | `{ index, datum }` | 鼠标 / 触摸进入某列                            |
| `column:leave` | `{ index, datum }` | 移出某列                                       |
| `column:click` | `{ index, datum }` | 点击列，或 SVG 聚焦后 `Enter` / `Space` 触发 |

### 方法

| 方法                                             | 说明                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `update(partial)`                              | 合并部分 config 并全量重绘                                                                        |
| `resize(width, height)`                        | 变更 viewBox 设计空间并重绘                                                                       |
| `on(event, handler)` / `off(event, handler)` | 绑定 / 解绑事件                                                                                   |
| `setActive(index)`                             | 编程式高亮指定列                                                                                  |
| `activeIndex`                                  | 当前高亮列下标（只读 getter）                                                                     |
| `toSVGString()`                                | 独立 SVG 文本（内嵌样式与 defs，含 xmlns / 宽高），可直接存 `.svg` 或内联                       |
| `getDataURL(options?)`                         | 当前图表 data URL，默认 PNG 2x；`options`：`type: 'png' \| 'svg'` / `scale` / `background`（缺省透明） |
| `download(options?)`                           | 触发浏览器下载，默认 `sk-chart.png`；`options` 同上另加 `filename`                             |
| `destroy()`                                    | 清理 DOM 与事件                                                                                   |

### 交互与无障碍

悬停/触摸切换高亮列；SVG 聚焦后 `←` / `→` / `Home` / `End` 导航，`Enter` / `Space` 触发 `column:click`；移出回落到 `defaultActive`。列具备 `role="listitem"` 与同步的 `aria-selected`；`prefers-reduced-motion: reduce` 下自动关闭过渡动画。
<!-- #endregion api -->

## 开发

```bash
npm test          # vitest（jsdom）
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # tsup → ESM/CJS/d.ts
```

## 路线图

- **M1**（进行中）：ResizeObserver 真实像素自适应、数据更新过渡动画、主题包；已交付：nice ticks 真刻度 Y 轴、xAxis 配置（顶部类目行 + 底部语义行）、装饰开关 + 中性默认文案、主题包注册（`registerTheme` + 内置 light/dark）
- **M2**：更多图表类型、框架封装（React/Vue）
- **M3**：文档站、视觉回归 CI、npm 发布

## 发布（维护者）

本仓库已接入 npm Trusted Publishing（GitHub Actions + OIDC，免 token），完整流程见 [RELEASING.md](./RELEASING.md)。日常发版：

```bash
npm version patch        # 或 minor / major
git push --follow-tags   # 推 v* tag → CI 自动发布 npm + 创建 GitHub Release
```

或直接双击根目录 `release.bat`（本地校验 → 提交推送 → 打 tag 发版一条龙）。

## License

GPL-3.0-only

```
Copyright (C) 2026 KTBOY

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
```

中文摘要（以 [LICENSE](./LICENSE) 与 [FSF 官方全文](https://www.gnu.org/licenses/gpl-3.0.html) 为准）：

- **可以**：免费使用、研究、修改、再分发，也可以收费交付商用项目。
- **条件**：只要你分发包含本库的作品（含打包进前端产物后对外发布、交付客户、开源），整体必须以 GPL-3.0-only 授权，提供完整对应源码，保留版权声明，并标注你做过的修改。
- **不分发就没有义务**：仅自己内部使用、或只在自己的服务器上运行对外提供服务，GPL-3.0 不要求开源（那是 AGPL 才管的场景）。
- **无担保**：作者不对适用性、无侵权等作任何承诺。
