export function convertAmount(amount: number, base: string, target: string, rates: Record<string, number>): number | null {
  if (base === target) return amount
  if (!Number.isFinite(rates[base]) || rates[base] <= 0 || !Number.isFinite(rates[target]) || rates[target] <= 0) return null
  return amount * rates[target] / rates[base]
}
