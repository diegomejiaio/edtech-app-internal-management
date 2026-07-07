const CENTS_FACTOR = 100;
const PEN_CURRENCY_FORMATTER = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | null | undefined): string {
  return PEN_CURRENCY_FORMATTER.format(value ?? 0);
}

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
