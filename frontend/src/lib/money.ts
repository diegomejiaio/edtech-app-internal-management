const CENTS_FACTOR = 100;

export function toMoneyCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTS_FACTOR);
}

export function fromMoneyCents(cents: number): number {
  return cents / CENTS_FACTOR;
}

export function sumMoney(values: Iterable<number>): number {
  let totalCents = 0;
  for (const value of values) {
    totalCents += toMoneyCents(value);
  }
  return fromMoneyCents(totalCents);
}

export function subtractMoney(minuend: number, subtrahend: number): number {
  return fromMoneyCents(toMoneyCents(minuend) - toMoneyCents(subtrahend));
}
