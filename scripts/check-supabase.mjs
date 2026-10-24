import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envFile = existsSync('.env.local') ? '.env.local' : '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local first.')
  process.exit(1)
}
if (key.startsWith('sb_secret_')) {
  console.error('A privileged key cannot be used as the frontend public key.')
  process.exit(1)
}
if (key.startsWith('eyJ')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
    if (claims.role !== 'anon') throw new Error('Expected anon role')
  } catch {
    console.error('Expected a publishable key or legacy anon key, not a privileged JWT.')
    process.exit(1)
  }
}
const host = new URL(url).hostname
console.log(`Checking Supabase: ${host}`)
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const [settings, products] = await Promise.all([
  client.from('settings').select('key').limit(1),
  client.from('products').select('id', { count: 'exact' }).eq('status', 'published').limit(1),
])
let failed = false
for (const [name, result] of [['settings', settings], ['products', products]]) {
  if (result.error) {
    failed = true
    console.error(`${name}: ${result.error.code || 'CONNECTION_ERROR'} — ${result.error.message}`)
  } else console.log(`${name}: reachable with the public key`)
}
if (products.count !== null) console.log(`Published products: ${products.count}`)
process.exitCode = failed ? 1 : 0
