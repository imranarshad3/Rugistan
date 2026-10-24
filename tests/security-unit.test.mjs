import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell } from '../src/lib/csv.ts'
import { normaliseCart } from '../src/lib/cart.ts'
const id='10000000-0000-4000-8000-000000000001'
const variant='20000000-0000-4000-8000-000000000001'
test('CSV formula cells are neutralized after whitespace and control characters', () => {
  for (const input of ['=1+1','+SUM(A1:A2)','-1+1','@SUM(A1:A2)','\t=1','\r\n =1']) assert.ok(csvCell(input).startsWith('"\''))
  assert.equal(csvCell(-12),'"-12"')
  assert.equal(csvCell('Handmade "rug", blue'),'"Handmade ""rug"", blue"')
})
test('untrusted saved carts reject corrupt IDs and quantities', () => {
  assert.deepEqual(normaliseCart([null,{productId:'bad',quantity:1},{productId:id,quantity:NaN},{productId:id,quantity:1.5},{productId:id,variantId:'bad',quantity:1}]),[])
  assert.deepEqual(normaliseCart({}),[])
})
test('cart normalization is bounded and merge retries cannot duplicate a line', () => {
  assert.deepEqual(normaliseCart([{productId:id,variantId:variant,quantity:2},{productId:id,variantId:variant,quantity:3}]),[{productId:id,variantId:variant,quantity:3}])
  assert.equal(normaliseCart([{productId:id,quantity:1000000}])[0].quantity,10)
})
