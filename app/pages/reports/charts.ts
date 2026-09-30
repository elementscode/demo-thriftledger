/** Round tick values covering min to max, from zero unless told otherwise. */
export function niceTicks(min: number, max: number, count = 4, includeZero = true): number[] {
  let lo = includeZero ? Math.min(0, min) : min;
  let hi = includeZero ? Math.max(0, max) : max;

  if (hi === lo) {
    hi = lo + 1;
  }

  let raw = (hi - lo) / count;
  let magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  let start = Math.floor(lo / step) * step;
  let ticks: number[] = [];

  for (let v = start; v <= hi + step * 0.001; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }

  if (ticks[ticks.length - 1] < hi) {
    ticks.push(ticks[ticks.length - 1] + step);
  }

  return ticks;
}

/** $1.2K, $12K, $1.4M: tick labels, in dollars from cents. */
export function compactMoney(cents: number): string {
  let dollars = cents / 100;
  let abs = Math.abs(dollars);
  let sign = dollars < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}$${trim(abs / 1_000_000)}M`;
  }

  if (abs >= 1000) {
    return `${sign}$${trim(abs / 1000)}K`;
  }

  return `${sign}$${Math.round(abs)}`;
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}

/** A donut segment from angle a0 to a1 (radians, 0 at 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number): string {
  let sweep = a1 - a0;

  // A full circle cannot be drawn as one arc; stop just short of it.
  if (sweep >= Math.PI * 2 - 0.0001) {
    a1 = a0 + Math.PI * 2 - 0.0001;
  }

  let large = a1 - a0 > Math.PI ? 1 : 0;
  let p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;

  return [
    `M ${p(outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p(outer, a1)}`,
    `L ${p(inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)}`,
    "Z",
  ].join(" ");
}

/** A column rising from the baseline at y0 to y, rounded 4px at the data end only. */
export function columnPath(x: number, width: number, y0: number, y: number): string {
  let height = y0 - y;

  if (height <= 0) {
    return "";
  }

  let r = Math.min(4, width / 2, height);

  return [
    `M ${x} ${y0}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y0}`,
    "Z",
  ].join(" ");
}
