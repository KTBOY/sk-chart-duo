# AGENTS.md

## 项目定位

sk-chart：轻量 SVG 优先图表库。首版提供 **FoldBarChart**（折纸漏斗柱状图），G2Plot 风格 API，零依赖。

> npm 包名为 **`sk-chart-duo`**（`sk-chart` 归一化后与既有包 `skchart` 同名，被 npm 相似度校验拦截），仓库名仍为 `sk-chart`。

## 目录地图

- `src/core/` — ChartBase 生命周期（泛型事件总线）、SVG 工具（uid 隔离）、基础类型
- `src/scale/` — 纯函数比例尺：linear / power / band
- `src/theme/` — 默认主题 tokens、主题包注册（`presets.ts`：registerTheme/getTheme，内置 light/dark）、scoped CSS 生成（含 prefers-reduced-motion 降级）
- `src/charts/fold-bar/` — geometry（纯函数几何）/ defs-builder / render / interaction / defaults / types
- `tests/` — vitest（jsdom）；`tests/probe-boundary.test.ts` 为边界回归
- `examples/` — Vite demo（双实例 + 事件日志 + 控制按钮）
- `payments-fold-chart.html` — 原稿，视觉基准（效果 3 为对照目标）
- `docs/assets/` — README 配图（二进制直存仓库，无 LFS）。README 里用 `raw.githubusercontent.com/KTBOY/sk-chart-duo/main/...` 绝对地址引用，因为 README 随包发布，相对路径在 npm 页面必然 404
- `.github/workflows/` — `ci.yml`（门禁）+ `publish-npm.yml`（OIDC 可信发布 + 自动 Release）
- `release.bat` / `RELEASING.md` — 一键提交发布助手 / 维护者发布指南

## 常用命令

```bash
npm run dev        # Vite demo
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # tsup → ESM/CJS/d.ts
npm run ci         # 门禁四连：typecheck + lint + test + build
```

## 验证路线

1. 门禁：typecheck + lint + test + build 全绿
2. 运行时：无头 Edge CDP 脚本截图/探针（hover、键盘、reduced-motion、aria），与原稿效果 3 对比
3. 边界：空数据 / 单列 / 全 0 / 负值 / NaN / 非法 exponent 的回归断言

## 关键约定

- 实例隔离：uid 前缀覆盖 defs id、class 名、scoped CSS
- update/resize 全量重建（userSpaceOnUse 坐标耦合）；增量 diff 属 M1
- `scale.exponent` 默认 1（线性），2 还原折纸轮廓；非法值钳制并 warn
- README 的 `#region features / quickstart / api` 三段是**文档站正文唯一真源**：`KTBOY/sh-design` 的 `docs/chart/index.md` 用 VitePress `@include` 从已安装的 npm 包里读这三段，站点自己只留实时 demo。改这三段 = 改线上文档，且**必须发包后**站点才生效（顺序与断言见 `RELEASING.md`「文档站同步」）
- 折痕自适应：`flapGeometry` 按斜率 `Δy / fold.run` 把直线折痕弯成 S 形（≤1 保持直线、≥4 完全成型），折面渐变区间随同一系数从 `[y0, plot.bottom]` 收拢到折痕带；平缓数据逐点退化为旧行为
- Y 轴刻度为真映射：原稿效果 3 的刻度是手摆装饰位，实现按 `barTopOf(tickValue)` 定位，差异为有意偏离；刻度由 `niceScale` 生成，`axis.ticks` 可覆盖
- `xAxis.bottomLabels` 渲染在无渐隐遮罩的独立 `axisLayer`（pointer-events:none），并按行数自动扩底部留白

## 路线图

M1：ResizeObserver 自适应 / 更新动画 / 主题包（已交付：nice ticks 真刻度 Y 轴 + xAxis 配置 + 装饰开关与中性默认文案 + 主题包注册 light/dark）；M2：更多图表类型 + React/Vue 封装；M3：文档站 + 视觉回归 CI + npm 发布。
