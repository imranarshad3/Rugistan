import test from 'node:test'
import assert from 'node:assert/strict'
import { convertAmount } from '../src/lib/currencyMath.ts'
const rates = { USD: 1, PKR: 280, INR: 84 }
test('converts base USD prices into Pakistani and Indian rupees', () => {
  assert.equal(convertAmount(100, 'USD', 'PKR', rates), 28000)
  assert.equal(convertAmount(100, 'USD', 'INR', rates), 8400)
})
test('converts a non-USD store base correctly without double conversion', () => {
  assert.equal(convertAmount(28000, 'PKR', 'USD', rates), 100)
  assert.equal(convertAmount(28000, 'PKR', 'INR', rates), 8400)
})
test('preserves same-currency and zero amounts', () => {
  assert.equal(convertAmount(299, 'USD', 'USD', {}), 299)
  assert.equal(convertAmount(0, 'USD', 'PKR', rates), 0)
})
test('rejects missing or invalid rates instead of displaying a wrong amount', () => {
  assert.equal(convertAmount(100, 'USD', 'EUR', rates), null)
  assert.equal(convertAmount(100, 'USD', 'PKR', {USD: 1, PKR: 0}), null)
  assert.equal(convertAmount(100, 'USD', 'PKR', {USD: NaN, PKR: 280}), null)
})
