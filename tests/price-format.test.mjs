import test from 'node:test'
import assert from 'node:assert/strict'
import {money, setCurrency} from '../src/lib/format.ts'
test('prices display rounded whole numbers without changing source amounts',()=>{
  const amount=299.75
  setCurrency('USD','$')
  assert.equal(money(amount),'$300')
  assert.equal(money(299),'$299')
  assert.equal(money(0),'$0')
  assert.equal(money(1234.4),'$1,234')
  assert.equal(amount,299.75)
  setCurrency('PKR','Rs ')
  assert.doesNotMatch(money(83017.84),/\.\d/)
  setCurrency('USD','$')
})
