import type { CartLine } from './types.ts'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null)
export function normaliseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return []
  const result: CartLine[] = []
  for (const entry of value) {
    if (
      !entry ||
      !UUID.test(entry.productId) ||
      (entry.variantId != null && !UUID.test(entry.variantId)) ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1
    )
      continue
    const line = {
      productId: entry.productId,
      variantId: entry.variantId ?? null,
      quantity: Math.min(entry.quantity, 10),
    }
    const existing = result.find((x) => sameLine(x, line))
    if (existing) existing.quantity = Math.max(existing.quantity, line.quantity)
    else if (result.length < 50) result.push(line)
  }
  return result
}
