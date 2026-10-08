import { createSvgElement, scopedId, urlRef } from '../../core/svg-renderer';
import { buildScopedCss } from '../../theme/default-theme';
import type { FoldBarModel } from './defaults';
import { buildDefs } from './defs-builder';
import { gridLineXs, hitRect, pillGeometry, washRect } from './geometry';

export interface TooltipHandle {
  group: SVGGElement;
  rect: SVGRectElement;
  text: SVGTextElement;
}

export interface FoldBarRenderResult {
  svg: SVGSVGElement;
  columns: SVGGElement[];
  columnsLayer: SVGGElement;
  tooltip: TooltipHandle;
}

/** Builds the full SVG scene from a precomputed model. Pure DOM output, no event wiring. */
export function renderFoldBar(uid: string, model: FoldBarModel): FoldBarRenderResult {
  const { options, layout, bars, flaps, labels, values, data } = model;
  const { style, tokens } = options;

  const svg = createSvgElement('svg', {
    class: scopedId(uid, 'root'),
    viewBox: `0 0 ${options.width} ${options.height}`,
    role: 'img',
    'aria-label': options.ariaLabel,
  });

  const styleEl = createSvgElement('style');
  styleEl.textContent = buildScopedCss(uid, tokens);
  svg.appendChild(styleEl);

  svg.appendChild(
    buildDefs({
      uid,
      width: options.width,
      height: options.height,
      plotBottom: layout.plot.bottom,
      barCount: values.length,
      gradientIndex: options.state.defaultActive,
      flapGradientYs: flaps.map((flap) => (flap ? flap.gradientY : null)),
      fade: model.fade,
      style,
    }),
  );

  if (options.title.text) {
    const title = createSvgElement('text', {
      class: scopedId(uid, 'title'),
      x: options.title.x,
      y: options.title.y,
    });
    title.textContent = options.title.text;
    svg.appendChild(title);
  }

  // Y axis tick labels at truthful scale positions + optional vertical column dividers.
  const grid = createSvgElement('g');
  options.axis.ticks.forEach((tick) => {
    const label = createSvgElement('text', {
      class: scopedId(uid, 'axis'),
      x: layout.plot.left - 15,
      y: layout.barTopOf(tick) + 4,
      'text-anchor': 'end',
    });
    label.textContent = options.axis.tickFormat(tick);
    grid.appendChild(label);
  });
  if (options.xAxis.showGrid) {
    for (const x of gridLineXs(layout)) {
      grid.appendChild(
        createSvgElement('line', {
          x1: x,
          x2: x,
          y1: layout.plot.top,
          y2: layout.plot.bottom,
          stroke: tokens.grid.stroke,
          'stroke-width': tokens.grid.strokeWidth,
        }),
      );
    }
  }
  svg.appendChild(grid);

  // Columns layer: the fade mask dissolves the baseline unless opted out.
  const columnsLayer = createSvgElement(
    'g',
    style.fadeEnabled ? { mask: urlRef(uid, 'fade'), role: 'list' } : { role: 'list' },
  );
  svg.appendChild(columnsLayer);

  const columns: SVGGElement[] = [];
  values.forEach((value, i) => {
    const bar = bars[i];
    const col = createSvgElement('g', {
      class: scopedId(uid, 'col'),
      'data-i': i,
      role: 'listitem',
      'aria-selected': 'false',
      'aria-label': `${labels[i]} ${options.valueFormat(value)}`,
    });

    if (style.washEnabled) {
      col.appendChild(
        createSvgElement('rect', {
          class: scopedId(uid, 'wash'),
          ...washRect(bar, style.washTop),
          fill: urlRef(uid, 'wash'),
        }),
      );
    }

    col.appendChild(
      createSvgElement('rect', {
        x: bar.x,
        y: bar.y,
        width: bar.width,
        height: bar.height,
        fill: urlRef(uid, `bar${i}`),
      }),
    );

    if (style.stripePattern.enabled) {
      col.appendChild(
        createSvgElement('rect', {
          class: scopedId(uid, 'stripes'),
          x: bar.x,
          y: bar.y,
          width: bar.width,
          height: bar.height,
          fill: urlRef(uid, 'stripes'),
        }),
      );
    }

    const flap = flaps[i];
    if (flap) {
      col.appendChild(
        createSvgElement('path', { d: flap.d, fill: urlRef(uid, `fold${i}`) }),
      );
      col.appendChild(createSvgElement('path', { d: flap.d, fill: urlRef(uid, 'crease') }));
      col.appendChild(
        createSvgElement('path', {
          d: flap.creaseD,
          fill: 'none',
          stroke: options.fold.creaseColor,
          'stroke-width': options.fold.creaseWidth,
        }),
      );
    }

    if (style.pill.enabled) {
      const pill = pillGeometry(bar.centerX, bar.y, style.pill);
      col.appendChild(
        createSvgElement('rect', {
          x: pill.x,
          y: pill.y,
          width: pill.width,
          height: pill.height,
          rx: pill.rx,
          fill: urlRef(uid, 'pill'),
        }),
      );
      col.appendChild(
        createSvgElement('rect', {
          x: pill.shadowX,
          y: pill.shadowY,
          width: pill.shadowWidth,
          height: pill.shadowHeight,
          rx: pill.shadowRx,
          fill: style.pill.shadow.color,
          'fill-opacity': style.pill.shadow.opacity,
        }),
      );
    }

    const labelX = bar.centerX + style.labelXOffset;
    const label = createSvgElement('text', {
      class: scopedId(uid, 'lbl'),
      x: labelX,
      y: style.labelY,
      'text-anchor': 'middle',
    });
    label.textContent = labels[i];
    col.appendChild(label);

    const num = createSvgElement('text', {
      class: scopedId(uid, 'num'),
      x: labelX,
      y: style.numberY,
      'text-anchor': 'middle',
    });
    num.textContent = options.valueFormat(value);
    col.appendChild(num);

    col.appendChild(
      createSvgElement('rect', { class: scopedId(uid, 'hit'), ...hitRect(layout, i) }),
    );

    columnsLayer.appendChild(col);
    columns.push(col);
  });

  // X axis layer: outside the fade mask, non-interactive.
  const { xAxis } = options;
  if (xAxis.showLine || xAxis.showTick || xAxis.bottomLabels || xAxis.title.text) {
    const axisLayer = createSvgElement('g', {
      class: scopedId(uid, 'xaxis'),
      'pointer-events': 'none',
      'aria-hidden': 'true',
    });
    // Axis band hangs off plot.bottom so it never overlaps the dissolving bar tails.
    const axisLineY = layout.plot.bottom + 4;
    if (xAxis.showLine) {
      axisLayer.appendChild(
        createSvgElement('line', {
          x1: layout.plot.left,
          x2: layout.plot.right,
          y1: axisLineY,
          y2: axisLineY,
          stroke: tokens.grid.stroke,
          'stroke-width': tokens.grid.strokeWidth,
        }),
      );
    }
    const rowHeight = tokens.axis.fontSize + 4;
    if (xAxis.showTick) {
      for (const x of gridLineXs(layout)) {
        axisLayer.appendChild(
          createSvgElement('line', {
            x1: x,
            x2: x,
            y1: axisLineY,
            y2: axisLineY + 4,
            stroke: tokens.grid.stroke,
            'stroke-width': tokens.grid.strokeWidth,
          }),
        );
      }
    }
    let bottomRows = 0;
    if (xAxis.bottomLabels) {
      const format = xAxis.bottomLabels;
      bars.forEach((bar, i) => {
        const out = format(data[i], i, data);
        const lines = Array.isArray(out) ? out : [out];
        bottomRows = Math.max(bottomRows, lines.length);
        lines.forEach((line, row) => {
          const text = createSvgElement('text', {
            class: scopedId(uid, 'axis'),
            x: bar.centerX,
            y: layout.plot.bottom + 20 + row * rowHeight,
            'text-anchor': 'middle',
          });
          text.textContent = line;
          axisLayer.appendChild(text);
        });
      });
    }
    if (xAxis.title.text) {
      const title = createSvgElement('text', {
        class: scopedId(uid, 'axis'),
        x: xAxis.title.x ?? (layout.plot.left + layout.plot.right) / 2,
        y: xAxis.title.y ?? layout.plot.bottom + 26 + bottomRows * rowHeight,
        'text-anchor': 'middle',
      });
      title.textContent = xAxis.title.text;
      axisLayer.appendChild(title);
    }
    svg.appendChild(axisLayer);
  }

  const group = createSvgElement('g', {
    class: scopedId(uid, 'tip'),
    filter: urlRef(uid, 'soft'),
  });
  const rect = createSvgElement('rect', {
    x: 0,
    y: 0,
    height: options.tooltip.height,
    rx: options.tooltip.radius,
    fill: tokens.tooltip.bg,
    stroke: tokens.tooltip.stroke,
  });
  const text = createSvgElement('text', { x: 0, y: 0, 'text-anchor': 'middle' });
  group.appendChild(rect);
  group.appendChild(text);
  svg.appendChild(group);

  return { svg, columns, columnsLayer, tooltip: { group, rect, text } };
}
