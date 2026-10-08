export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FoldBarLayoutInput {
  /** viewBox design-space width. */
  width: number;
  /** viewBox design-space height. */
  height: number;
  padding: Padding;
  /** Distance from plot bottom up to the bar top of a zero value. */
  stairBottomOffset: number;
  /** Distance from plot top down to the tallest bar's top. */
  stairTopOffset: number;
  /** Horizontal run reserved for the paper fold between columns. */
  foldRun: number;
  /** Gap between a bar and its fold zone. */
  barGap: number;
  /** Power applied to normalized values when mapping to bar height. */
  exponent: number;
  /** Axis domain maximum; bars normalize against it so ticks map truthfully. */
  domainMax: number;
  values: number[];
}

export interface PlotRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FoldBarLayout {
  plot: PlotRect;
  count: number;
  colWidth: number;
  barWidth: number;
  /** Bar top y when value is 0. */
  stairBase: number;
  /** Bar top y of the domain maximum (top tick). */
  stairTop: number;
  /** Maximum data value. */
  maxValue: number;
  /** Axis domain maximum the bars normalize against. */
  domainMax: number;
  barTopOf: (value: number) => number;
}

export function computeLayout(input: FoldBarLayoutInput): FoldBarLayout {
  const left = input.padding.left;
  const right = input.width - input.padding.right;
  const top = input.padding.top;
  const bottom = input.height - input.padding.bottom;
  const count = input.values.length;
  const colWidth = count > 0 ? (right - left) / count : 0;
  const barWidth = colWidth - input.foldRun - input.barGap;
  const stairBase = bottom - input.stairBottomOffset;
  const stairTop = top + input.stairTopOffset;
  const maxValue = count > 0 ? Math.max(...input.values) : 0;
  const domainMax = Math.max(input.domainMax, maxValue);
  const span = stairBase - stairTop;

  const barTopOf = (value: number): number => {
    if (domainMax <= 0) return stairBase;
    const t = Math.pow(Math.max(0, value / domainMax), input.exponent);
    return stairBase - t * span;
  };

  return {
    plot: { left, right, top, bottom, width: right - left, height: bottom - top },
    count,
    colWidth,
    barWidth,
    stairBase,
    stairTop,
    maxValue,
    domainMax,
    barTopOf,
  };
}

export interface BarGeometry {
  /** Leading edge of the column band (hit area / grid line). */
  colStart: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

export function barGeometry(layout: FoldBarLayout, index: number, value: number): BarGeometry {
  const colStart = layout.plot.left + index * layout.colWidth;
  const x = colStart + 1;
  const y = layout.barTopOf(value);
  return {
    colStart,
    x,
    y,
    width: layout.barWidth,
    height: layout.plot.bottom - y,
    centerX: x + layout.barWidth / 2,
  };
}

export interface FlapGeometry {
  /** SVG path data for the flap body: the crease curve plus both sides down to the baseline. */
  d: string;
  /** The crease curve on its own, stroked as the lit fold edge. */
  creaseD: string;
  /** y range for the userSpaceOnUse fold gradient. */
  gradientY: [number, number];
}

/** Crease slope (drop per unit of fold run) up to which the fold stays a straight line. */
const STRAIGHT_SLOPE = 1;
/** Crease slope at which the fold reaches its fully rounded S shape. */
const FULL_CURVE_SLOPE = 4;
/** Share of the wall below the crease that keeps the fold gradient's falloff. */
const GRADIENT_TAIL = 0.35;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Fold flap connecting column index to column index+1. Null for the last column.
 *
 * The fold's horizontal run is fixed, so a large value gap would otherwise turn the crease
 * into a near-vertical slash. Past STRAIGHT_SLOPE the crease eases into an S curve and the
 * fold gradient tightens around it, both scaled by how far past that threshold it is.
 */
export function flapGeometry(
  layout: FoldBarLayout,
  index: number,
  values: number[],
): FlapGeometry | null {
  if (index >= values.length - 1) return null;
  const x0 = layout.plot.left + index * layout.colWidth + 1 + layout.barWidth;
  const x1 = layout.plot.left + (index + 1) * layout.colWidth + 2;
  const y0 = layout.barTopOf(values[index]);
  const y1 = layout.barTopOf(values[index + 1]);
  const bottom = layout.plot.bottom;
  const run = x1 - x0;
  const slope = run > 0 ? Math.abs(y1 - y0) / run : 0;
  const curve = clamp01((slope - STRAIGHT_SLOPE) / (FULL_CURVE_SLOPE - STRAIGHT_SLOPE));
  const bend = (run / 2) * curve;
  const creaseD =
    bend === 0
      ? `M${x0},${y0} L${x1},${y1}`
      : `M${x0},${y0} C${x0 + bend},${y0} ${x1 - bend},${y1} ${x1},${y1}`;
  const low = Math.max(y0, y1);
  const gradientY: [number, number] = [
    lerp(y0, Math.min(y0, y1), curve),
    lerp(bottom, low + (bottom - low) * GRADIENT_TAIL, curve),
  ];
  return {
    d: `${creaseD} L${x1},${bottom} L${x0},${bottom} Z`,
    creaseD,
    gradientY,
  };
}

export interface PillOptions {
  width: number;
  height: number;
  rx: number;
  /** Offset of the pill top relative to the bar top. */
  offsetY: number;
  shadow: { width: number; height: number; rx: number; offsetY: number };
}

export interface PillGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  shadowX: number;
  shadowY: number;
  shadowWidth: number;
  shadowHeight: number;
  shadowRx: number;
}

export function pillGeometry(
  centerX: number,
  barTop: number,
  pill: PillOptions,
): PillGeometry {
  return {
    x: centerX - pill.width / 2,
    y: barTop + pill.offsetY,
    width: pill.width,
    height: pill.height,
    rx: pill.rx,
    shadowX: centerX - pill.shadow.width / 2,
    shadowY: barTop + pill.shadow.offsetY,
    shadowWidth: pill.shadow.width,
    shadowHeight: pill.shadow.height,
    shadowRx: pill.shadow.rx,
  };
}

/** Vertical grid line x positions: one per column boundary. */
export function gridLineXs(layout: FoldBarLayout): number[] {
  return Array.from({ length: layout.count + 1 }, (_, i) => layout.plot.left + i * layout.colWidth);
}

export interface TooltipPlacementOptions {
  /** Horizontal anchor of the tooltip relative to bar width. */
  anchorRatio: number;
  /** Vertical offset of the tooltip top relative to the bar top (negative = above). */
  offsetY: number;
  /** The tooltip never moves above this y. */
  minY: number;
}

export function tooltipPlacement(
  layout: FoldBarLayout,
  bar: BarGeometry,
  tipWidth: number,
  options: TooltipPlacementOptions,
): { x: number; y: number } {
  const rawX = bar.x + bar.width * options.anchorRatio;
  const y = Math.max(bar.y + options.offsetY, options.minY);
  const { left, right } = layout.plot;
  // A tooltip wider than the plot is pinned to its left edge.
  const x = Math.min(Math.max(rawX, left), Math.max(left, right - tipWidth));
  return { x, y };
}

export interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Full-column hover hit area. */
export function hitRect(layout: FoldBarLayout, index: number): RectGeometry {
  return {
    x: layout.plot.left + index * layout.colWidth,
    y: layout.plot.top,
    width: layout.colWidth,
    height: layout.plot.height,
  };
}

/** Wash backdrop above an active bar; height clamped to non-negative. */
export function washRect(bar: BarGeometry, washTop: number): RectGeometry {
  return {
    x: bar.x,
    y: washTop,
    width: bar.width,
    height: Math.max(0, bar.y - washTop),
  };
}
