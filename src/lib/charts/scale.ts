/** A linear map from a data domain to a pixel range. */
export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Round tick values (1, 2, 2.5 or 5 times a power of ten) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const raw = (max - min) / Math.max(1, count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  // Keep going until a tick reaches max, so the axis always covers the data.
  for (let value = start; ticks.length < 50; value += step) {
    ticks.push(Number(value.toPrecision(12)));
    if (value >= max - step * 1e-9) break;
  }
  return ticks;
}
