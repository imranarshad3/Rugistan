import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createStoreHandler } from '../server/store.ts'

const origin = 'https://rugistan.vercel.app'
const environment = { VERCEL: '1', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-server-key', RATE_LIMIT_SECRET: 'a'.repeat(64), CLERK_SECRET_KEY: 'private-clerk-key' }
async function fixture(run, options = {}) {
  const calls = []
  const handler = createStoreHandler({
    env: () => ({ ...environment, ...options.env }),
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'consume_store_quota') return options.quota ?? { data: { allowed: true }, error: null }
      return { data: { ok: true }, error: null }
    },
    verify: async (token) => { if (token !== 'valid-session') throw new Error('private verification details'); return { sub: 'user_Verified', sid: 'sess_Verified' } },
  })
  const server = createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const send = (changes = {}) => fetch(url, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.1', ...changes.headers },
    body: JSON.stringify({ action: 'newsletter', payload: { email: 'valid@example.test' } }),
    ...Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'headers')),
  })
  try { await run(send, calls) } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
test('guest submission is rate-limited before any persistence, with HMAC identity', () => fixture(async (send, calls) => {
  const response = await send()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(calls[0].name, 'consume_store_quota')
  assert.match(calls[0].args.p_key, /^[a-f0-9]{64}$/)
  assert.equal(calls[1].args.p_user_id, null)
  assert.ok(!JSON.stringify(calls).includes('203.0.113.1'))
}))
test('only verified session identity reaches database; payload user ID is ignored', () => fixture(async (send, calls) => {
  assert.equal((await send({ headers: { Authorization: 'Bearer valid-session' }, body: JSON.stringify({ action: 'checkout', payload: { p_user_id: 'user_Admin' } }) })).status, 200)
  assert.equal(calls[1].args.p_user_id, 'user_Verified')
}))
test('forged or expired session never becomes guest checkout', () => fixture(async (send, calls) => {
  const response = await send({ headers: { Authorization: 'Bearer forged' } })
  assert.equal(response.status, 401)
  assert.equal(calls.length, 1)
  assert.ok(!(await response.text()).includes('private'))
}))
test('quota rejection returns 429 and does not write', () => fixture(async (send, calls) => {
  const response = await send()
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '45')
  assert.equal(calls.length, 1)
}, { quota: { data: { allowed: false, retry_after: 45 }, error: null } }))
test('quota backend failure fails closed', () => fixture(async (send, calls) => {
  assert.equal((await send()).status, 503)
  assert.equal(calls.length, 1)
}, { quota: { data: null, error: { message: 'private SQL details' } } }))
test('cross-origin, non-JSON, non-POST, malformed and oversized requests do not reach database', () => fixture(async (send, calls) => {
  assert.equal((await send({ headers: { Origin: 'https://evil.example' } })).status, 403)
  assert.equal((await send({ headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal((await send({ method: 'GET', body: undefined })).status, 405)
  assert.equal((await send({ body: '{broken' })).status, 400)
  assert.equal((await send({ body: JSON.stringify({ action: 'newsletter', payload: { email: 'x'.repeat(40000) } }) })).status, 413)
  assert.equal(calls.length, 0)
}))
test('arbitrary forwarding headers cannot substitute missing Vercel IP', () => fixture(async (send, calls) => {
  const response = await send({ headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '1.1.1.1' } })
  assert.equal(response.status, 503)
  assert.equal(calls.length, 0)
}))
test('rotating caller email does not change the trusted quota identity', () => fixture(async (send, calls) => {
  await send()
  await send({ body: JSON.stringify({ action: 'newsletter', payload: { email: 'different@example.test' } }) })
  assert.equal(calls[0].args.p_key, calls[2].args.p_key)
}))
