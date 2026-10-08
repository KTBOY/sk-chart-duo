import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoldBarChart, type FoldBarDatum } from '../src/index';

// Boundary regressions: post-fix behavior for hostile inputs.

const DATA = (values: number[]): FoldBarDatum[] =>
  values.map((v, i) => ({ label: `c${i}`, value: v }));

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const barOf = (el: HTMLElement, i: number): SVGRectElement =>
  el.querySelectorAll('g[data-i]')[i].children[1] as SVGRectElement;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('boundary regressions', () => {
  it('empty data renders without throwing; active stays -1 and keyboard is inert', () => {
    const el = host();
    const chart = new FoldBarChart(el, { data: [] });
    expect(el.querySelectorAll('g[data-i]').length).toBe(0);
    expect(chart.activeIndex).toBe(-1);
    const svg = el.querySelector('svg')!;
    expect(() => svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))).not.toThrow();
    expect(chart.activeIndex).toBe(-1);
    chart.destroy();
  });

  it('single column renders one bar and no flap', () => {
    const el = host();
    const chart = new FoldBarChart(el, { data: DATA([5]) });
    expect(el.querySelectorAll('g[data-i]').length).toBe(1);
    expect(el.querySelectorAll('path').length).toBe(0);
    chart.destroy();
  });

  it('invalid exponent warns once and falls back to linear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = host();
    const chart = new FoldBarChart(el, { data: DATA([1, 100]), scale: { exponent: 0 } });
    expect(warn).toHaveBeenCalledTimes(1);
    // linear fallback: t = 0.01 -> height = 0.01 * 192 + 30 stub region
    expect(Number(barOf(el, 0).getAttribute('height'))).toBeCloseTo(31.92, 1);
    expect(barOf(el, 1).getAttribute('height')).toBe('222');
    chart.destroy();
  });

  it('negative and NaN values warn once and render the zero stub', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = host();
    const chart = new FoldBarChart(el, {
      data: [
        { label: 'a', value: -5 },
        { label: 'b', value: NaN },
        { label: 'c', value: 10 },
      ],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(barOf(el, 0).getAttribute('height')).toBe('30');
    expect(barOf(el, 1).getAttribute('height')).toBe('30');
    chart.destroy();
  });

  it('out-of-range defaultActive is clamped into the data', () => {
    const el = host();
    const chart = new FoldBarChart(el, { data: DATA([1, 2, 3]), state: { defaultActive: 99 } });
    expect(chart.activeIndex).toBe(2);
    chart.destroy();
  });
});
